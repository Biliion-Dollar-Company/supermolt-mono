'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import {
  getAgent,
  getAgentTrades,
  getAgentProfileById,
  getAgentPositions,
  getAgentTaskCompletions,
  getAgentConversations,
} from '@/lib/api';
import {
  Agent,
  Trade,
  AgentProfile,
  Position,
  AgentTaskCompletionDetail,
  AgentConversationSummary,
} from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/design-system';
import { XPProgressBar } from './XPProgressBar';

// ── Helpers ──

function getAvatarSrc(avatarUrl?: string | null, twitterHandle?: string | null): string | null {
  if (avatarUrl) return avatarUrl;
  if (!twitterHandle) return null;
  const normalized = twitterHandle.replace(/^@/, '').trim();
  if (!normalized) return null;
  return `https://unavatar.io/twitter/${normalized}`;
}

function shortenAddress(addr: string): string {
  if (addr.length <= 11) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ── Gold gradient separator ──

function GoldSeparator() {
  return (
    <div className="h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent my-1" />
  );
}

// ── Corner brackets (outer frame decoration) ──

function CornerBrackets() {
  const corner = 'absolute w-3 h-3 border-accent-primary/30';
  return (
    <>
      <div className={`${corner} top-0 left-0 border-t border-l`} />
      <div className={`${corner} top-0 right-0 border-t border-r`} />
      <div className={`${corner} bottom-0 left-0 border-b border-l`} />
      <div className={`${corner} bottom-0 right-0 border-b border-r`} />
    </>
  );
}

// ── Activity item type (merged tasks + conversations) ──

type ActivityItem =
  | { kind: 'task'; title: string; xp: number; date: string }
  | { kind: 'conversation'; topic: string; messageCount: number; date: string };

function mergeActivity(
  tasks: AgentTaskCompletionDetail[],
  conversations: AgentConversationSummary[],
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...tasks
      .filter((t) => t.status === 'VALIDATED')
      .map((t) => ({
        kind: 'task' as const,
        title: t.title,
        xp: t.xpAwarded ?? t.xpReward,
        date: t.submittedAt ?? new Date().toISOString(),
      })),
    ...conversations.map((c) => ({
      kind: 'conversation' as const,
      topic: c.topic,
      messageCount: c.agentMessageCount,
      date: c.lastMessageAt,
    })),
  ];
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items.slice(0, 5);
}

// ── Main component ──

interface AgentProfileModalProps {
  agentId: string;
  onClose: () => void;
}

export function AgentProfileModal({ agentId, onClose }: AgentProfileModalProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [taskCompletions, setTaskCompletions] = useState<AgentTaskCompletionDetail[]>([]);
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Animate in
  useEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;
    overlay.offsetHeight; // force reflow
    overlay.style.opacity = '1';
    panel.style.opacity = '1';
    panel.style.transform = 'scale(1) translateY(0)';
  }, []);

  // Animate out
  const handleClose = useCallback(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) {
      onClose();
      return;
    }
    overlay.style.opacity = '0';
    panel.style.opacity = '0';
    panel.style.transform = 'scale(0.95) translateY(16px)';
    setTimeout(onClose, 200);
  }, [onClose]);

  // Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose]);

  // Fetch all data in parallel
  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      try {
        const [agentData, tradesData, positionsData, tasksData, convoData] =
          await Promise.all([
            getAgent(agentId),
            getAgentTrades(agentId, 10),
            getAgentPositions(agentId).catch(() => [] as Position[]),
            getAgentTaskCompletions(agentId).catch(() => [] as AgentTaskCompletionDetail[]),
            getAgentConversations(agentId).catch(() => [] as AgentConversationSummary[]),
          ]);
        if (cancelled) return;
        setAgent(agentData);
        setTrades(tradesData);
        setPositions(positionsData);
        setTaskCompletions(tasksData);
        setConversations(convoData);

        // Profile can fail silently
        getAgentProfileById(agentId)
          .then((p) => { if (!cancelled) setProfile(p); })
          .catch(() => {});
      } catch (err) {
        console.error('Failed to load agent:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [agentId]);

  // Derived
  const winRate = agent ? agent.win_rate : 0;
  const activity = mergeActivity(taskCompletions, conversations);
  const openPositions = positions.filter((p) => !p.closedAt);

  // Copy wallet
  const copyWallet = () => {
    if (!agent) return;
    navigator.clipboard.writeText(agent.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50"
      style={{ opacity: 0, transition: 'opacity 200ms ease-out' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Centered panel */}
      <div className="relative flex items-center justify-center h-full p-4 pointer-events-none">
        <div
          ref={panelRef}
          className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto scrollbar-custom pointer-events-auto bg-bg-primary border border-white/[0.06] shadow-[0_0_80px_-16px_rgba(232,180,94,0.12)]"
          style={{
            opacity: 0,
            transform: 'scale(0.95) translateY(16px)',
            transition:
              'opacity 200ms ease-out, transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <CornerBrackets />

          {loading ? (
            <SkeletonLoading />
          ) : !agent ? (
            <div className="p-8 text-center">
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 p-2 hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
              <p className="text-text-muted">Agent not found</p>
            </div>
          ) : (
            <div>
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 z-10 p-2 hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-text-muted hover:text-text-primary transition-colors" />
              </button>

              {/* ── SECTION 1: Hero Header ── */}
              <section
                className="px-5 pt-5 pb-4"
                style={{ animation: 'fadeIn 0.4s ease-out both' }}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar with gradient ring */}
                  {(() => {
                    const src = getAvatarSrc(agent.avatarUrl, agent.twitterHandle);
                    return src ? (
                      <div className="relative w-14 h-14 rounded-full ring-2 ring-accent-primary/40 flex-shrink-0 overflow-hidden">
                        <Image src={src} alt={agent.agentName} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full ring-2 ring-accent-primary/40 bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                        <span className="text-xl font-bold text-text-muted">
                          {agent.agentName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="min-w-0 flex-1">
                    {/* Name + badge + level */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-text-primary truncate">
                        {agent.twitterHandle
                          ? (agent.twitterHandle.startsWith('@')
                              ? agent.twitterHandle
                              : `@${agent.twitterHandle}`)
                          : agent.agentName}
                      </h2>
                      {agent.twitterHandle && (
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 22 22" fill="none">
                          <circle cx="11" cy="11" r="11" fill="#1D9BF0" />
                          <path
                            d="M9.5 14.25L6.75 11.5L7.8 10.45L9.5 12.15L14.2 7.45L15.25 8.5L9.5 14.25Z"
                            fill="white"
                          />
                        </svg>
                      )}
                      {profile && (
                        <span className="text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 font-mono flex-shrink-0">
                          Lv.{profile.level} {profile.levelName}
                        </span>
                      )}
                    </div>

                    {/* Wallet */}
                    <button
                      onClick={copyWallet}
                      className="flex items-center gap-1 mt-1 text-xs text-text-muted font-mono hover:text-text-secondary transition-colors cursor-pointer"
                    >
                      {shortenAddress(agent.walletAddress)}
                      {copied ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>

                    {/* Bio */}
                    {profile?.bio && (
                      <p className="text-xs text-text-muted italic mt-1.5 line-clamp-1">
                        {profile.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* XP bar */}
                {profile && (
                  <div className="mt-3">
                    <XPProgressBar
                      xp={profile.xp}
                      level={profile.level}
                      levelName={profile.levelName}
                      xpForNextLevel={profile.xpForNextLevel}
                    />
                  </div>
                )}
              </section>

              <GoldSeparator />

              {/* ── SECTION 2: Stats Row ── */}
              <section
                className="px-5 py-4"
                style={{ animation: 'fadeIn 0.4s ease-out 60ms both' }}
              >
                <div className="flex items-center">
                  {[
                    {
                      label: 'Trades',
                      value: String(agent.trade_count || 0),
                      color: 'text-text-primary',
                    },
                    {
                      label: 'Win Rate',
                      value: formatPercent(winRate),
                      color: winRate >= 50 ? 'text-green-400' : 'text-red-400',
                    },
                    {
                      label: 'Total P&L',
                      value: formatCurrency(agent.total_pnl),
                      color: agent.total_pnl >= 0 ? 'text-green-400' : 'text-red-400',
                    },
                    {
                      label: 'Avg Win',
                      value: formatCurrency(agent.average_win),
                      color: 'text-green-400',
                    },
                    {
                      label: 'Sortino',
                      value: agent.sortino_ratio?.toFixed(2) ?? '—',
                      color: 'text-text-primary',
                    },
                  ].map((stat, i) => (
                    <div key={stat.label} className="flex items-center flex-1 min-w-0">
                      {i > 0 && (
                        <div className="w-px h-8 bg-white/[0.06] flex-shrink-0" />
                      )}
                      <div className="flex-1 text-center px-1">
                        <div
                          className={`text-sm font-bold font-mono truncate ${stat.color}`}
                        >
                          {stat.value}
                        </div>
                        <div className="text-[9px] text-text-muted uppercase tracking-wider mt-0.5">
                          {stat.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── SECTION 3: Positions ── */}
              {openPositions.length > 0 && (
                <>
                  <GoldSeparator />
                  <section
                    className="px-5 py-4"
                    style={{ animation: 'fadeIn 0.4s ease-out 120ms both' }}
                  >
                    <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                      Positions
                    </div>
                    <div className="space-y-0">
                      {openPositions.slice(0, 5).map((pos, i) => (
                        <div key={pos.positionId}>
                          {i > 0 && (
                            <div className="h-px bg-white/[0.04] my-2" />
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-bold text-text-primary">
                                {pos.tokenSymbol}
                              </span>
                              <span className="text-xs text-text-muted font-mono">
                                {pos.quantity.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span
                                className={`text-sm font-mono font-bold ${
                                  pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}
                              >
                                {pos.pnl >= 0 ? '+' : ''}
                                {formatCurrency(pos.pnl)}
                              </span>
                              <span
                                className={`text-[10px] font-mono ml-1.5 ${
                                  pos.pnlPercent >= 0
                                    ? 'text-green-400/60'
                                    : 'text-red-400/60'
                                }`}
                              >
                                {pos.pnlPercent >= 0 ? '+' : ''}
                                {pos.pnlPercent.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {openPositions.length > 5 && (
                      <a
                        href={`/agents/${agentId}`}
                        className="inline-block text-xs text-text-muted hover:text-accent-primary transition-colors mt-2"
                      >
                        View all {openPositions.length} positions →
                      </a>
                    )}
                  </section>
                </>
              )}

              <GoldSeparator />

              {/* ── SECTION 4: Recent Trades ── */}
              <section
                className="px-5 py-4"
                style={{ animation: 'fadeIn 0.4s ease-out 180ms both' }}
              >
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Recent Trades
                </div>
                {trades.length === 0 ? (
                  <div className="text-sm text-text-muted text-center py-3">
                    No trades yet
                  </div>
                ) : (
                  <div className="space-y-0">
                    {trades.slice(0, 8).map((trade, i) => (
                      <div key={trade.tradeId || i}>
                        {i > 0 && (
                          <div className="h-px bg-white/[0.04] my-1.5" />
                        )}
                        <div className="flex items-center justify-between py-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 ${
                                trade.action === 'BUY'
                                  ? 'bg-green-500/10 text-green-400'
                                  : 'bg-red-500/10 text-red-400'
                              }`}
                            >
                              {trade.action}
                            </span>
                            <span className="text-sm font-medium text-text-primary truncate">
                              {trade.tokenSymbol}
                            </span>
                            <span className="text-[10px] text-text-muted font-mono">
                              {timeAgo(trade.timestamp || trade.createdAt)}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-mono font-bold flex-shrink-0 ${
                              trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {trade.pnl >= 0 ? '+' : ''}
                            {formatCurrency(trade.pnl)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── SECTION 5: Activity ── */}
              {activity.length > 0 && (
                <>
                  <GoldSeparator />
                  <section
                    className="px-5 py-4"
                    style={{ animation: 'fadeIn 0.4s ease-out 240ms both' }}
                  >
                    <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                      Activity
                    </div>
                    <div className="space-y-0">
                      {activity.map((item, i) => (
                        <div key={i}>
                          {i > 0 && (
                            <div className="h-px bg-white/[0.04] my-1.5" />
                          )}
                          <div className="flex items-center gap-2 py-0.5">
                            {item.kind === 'task' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                <span className="text-sm text-text-primary truncate flex-1">
                                  {item.title}
                                </span>
                                <span className="text-[10px] font-mono text-accent-primary flex-shrink-0">
                                  +{item.xp} XP
                                </span>
                              </>
                            ) : (
                              <>
                                <MessageSquare className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                <span className="text-sm text-text-primary truncate flex-1">
                                  {item.topic}
                                </span>
                                <span className="text-[10px] text-text-muted flex-shrink-0">
                                  {item.messageCount} msgs
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {/* ── SECTION 6: Footer ── */}
              <GoldSeparator />
              <div
                className="px-5 py-3 flex items-center justify-end"
                style={{ animation: 'fadeIn 0.4s ease-out 300ms both' }}
              >
                <a
                  href={`/agents/${agentId}`}
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-primary transition-colors"
                >
                  Full profile
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Skeleton ──

function SkeletonLoading() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      {/* Hero skeleton */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-white/[0.04]" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-36 bg-white/[0.04] rounded" />
          <div className="h-3 w-24 bg-white/[0.03] rounded" />
          <div className="h-2 w-full bg-white/[0.03] rounded mt-2" />
        </div>
      </div>
      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {/* Stats row skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex-1 text-center space-y-1">
            <div className="h-4 w-10 bg-white/[0.04] rounded mx-auto" />
            <div className="h-2 w-8 bg-white/[0.03] rounded mx-auto" />
          </div>
        ))}
      </div>
      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {/* Trades skeleton */}
      <div className="space-y-2">
        <div className="h-2 w-20 bg-white/[0.03] rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-24 bg-white/[0.04] rounded" />
            <div className="h-3 w-12 bg-white/[0.04] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
