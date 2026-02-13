'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, Trophy, TrendingUp, Activity, Zap, ExternalLink } from 'lucide-react';
import {
  getAgent,
  getAgentTrades,
  getAgentProfileById,
} from '@/lib/api';
import { Agent, Trade, AgentProfile } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/design-system';
import { XPProgressBar } from './XPProgressBar';

function getAvatarSrc(avatarUrl?: string, twitterHandle?: string): string | null {
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

interface AgentProfileModalProps {
  agentId: string;
  onClose: () => void;
}

export function AgentProfileModal({ agentId, onClose }: AgentProfileModalProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    overlay.offsetHeight;
    overlay.style.opacity = '1';
    panel.style.opacity = '1';
    panel.style.transform = 'scale(1) translateY(0)';
  }, []);

  const handleClose = useCallback(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) { onClose(); return; }

    overlay.style.opacity = '0';
    panel.style.opacity = '0';
    panel.style.transform = 'scale(0.92) translateY(24px)';
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentData, tradesData] = await Promise.all([
          getAgent(agentId),
          getAgentTrades(agentId, 10),
        ]);
        setAgent(agentData);
        setTrades(tradesData);

        getAgentProfileById(agentId)
          .then((p) => setProfile(p))
          .catch(() => {});
      } catch (err) {
        console.error('Failed to load agent:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [agentId]);

  const winCount = trades.filter((t) => t.pnl > 0).length;
  const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50"
      style={{ opacity: 0, transition: 'opacity 200ms ease-out' }}
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative flex items-center justify-center h-full p-4 pointer-events-none">
        <div
          ref={panelRef}
          className="w-full max-w-lg max-h-[85vh] overflow-y-auto scrollbar-custom pointer-events-auto bg-bg-primary border border-white/[0.08] shadow-[0_0_60px_-12px_rgba(232,180,94,0.15)]"
          style={{
            opacity: 0,
            transform: 'scale(0.92) translateY(24px)',
            transition: 'opacity 200ms ease-out, transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="p-6 space-y-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/[0.04]" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-32 bg-white/[0.04] rounded" />
                  <div className="h-3 w-24 bg-white/[0.03] rounded" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-white/[0.04] rounded" />
                ))}
              </div>
            </div>
          ) : !agent ? (
            <div className="p-8 text-center">
              <div className="flex items-center justify-between mb-4">
                <span />
                <button onClick={handleClose} className="p-2 hover:bg-white/[0.05] transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>
              <p className="text-text-muted">Agent not found</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/[0.08] flex items-start justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  {(() => {
                    const avatarSrc = getAvatarSrc(agent.avatarUrl, agent.twitterHandle);
                    return avatarSrc ? (
                      <div className="relative w-14 h-14 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                        <Image src={avatarSrc} alt={agent.agentName} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-text-muted">
                          {agent.agentName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-text-primary truncate">
                        {agent.twitterHandle
                          ? (agent.twitterHandle.startsWith('@') ? agent.twitterHandle : `@${agent.twitterHandle}`)
                          : agent.agentName}
                      </h2>
                      {agent.twitterHandle && (
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 22 22" fill="none">
                          <circle cx="11" cy="11" r="11" fill="#1D9BF0" />
                          <path d="M9.5 14.25L6.75 11.5L7.8 10.45L9.5 12.15L14.2 7.45L15.25 8.5L9.5 14.25Z" fill="white" />
                        </svg>
                      )}
                      {profile && (
                        <span className="text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 font-mono flex-shrink-0">
                          Lv.{profile.level}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted font-mono mt-0.5">
                      {shortenAddress(agent.walletAddress)}
                    </p>
                    {profile && (
                      <div className="flex items-center gap-1 mt-1">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        <span className="text-xs font-mono text-yellow-400">{profile.xp} XP</span>
                        <span className="text-[10px] text-text-muted ml-1">{profile.levelName}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-white/[0.05] transition-colors cursor-pointer flex-shrink-0"
                >
                  <X className="w-5 h-5 text-text-muted hover:text-text-primary transition-colors" />
                </button>
              </div>

              {/* XP Progress */}
              {profile && (
                <div className="px-5 py-3 border-b border-white/[0.08]">
                  <XPProgressBar
                    xp={profile.xp}
                    level={profile.level}
                    levelName={profile.levelName}
                    xpForNextLevel={profile.xpForNextLevel}
                  />
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-px bg-white/[0.06]">
                {[
                  { label: 'Trades', value: agent.trade_count || 0, icon: Activity, color: 'text-accent-primary' },
                  { label: 'Win Rate', value: formatPercent(winRate), icon: TrendingUp, color: winRate >= 50 ? 'text-green-400' : 'text-red-400' },
                  { label: 'P&L', value: formatCurrency(agent.total_pnl), icon: Trophy, color: agent.total_pnl >= 0 ? 'text-green-400' : 'text-red-400' },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-bg-primary p-3 text-center">
                      <Icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
                      <div className="text-sm font-bold text-text-primary font-mono">{stat.value}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider">{stat.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Recent Trades */}
              <div className="px-5 py-4">
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  Recent Trades
                </div>
                {trades.length === 0 ? (
                  <div className="text-sm text-text-muted text-center py-4">No trades yet</div>
                ) : (
                  <div className="space-y-1.5">
                    {trades.slice(0, 8).map((trade, i) => (
                      <div
                        key={trade.tradeId || i}
                        className="flex items-center justify-between py-1.5 px-2 bg-white/[0.02] border border-white/[0.04]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 ${
                              trade.action === 'BUY'
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            {trade.action}
                          </span>
                          <span className="text-sm font-medium text-text-primary">{trade.tokenSymbol}</span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-xs font-mono font-bold ${
                              trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {formatCurrency(trade.pnl)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-white/[0.08] flex items-center justify-end">
                <a
                  href={`/agents/${agentId}`}
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-primary transition-colors"
                >
                  Full profile
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
