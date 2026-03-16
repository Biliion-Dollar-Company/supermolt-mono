'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Crown, Copy, Check } from 'lucide-react';
import { useLeaderboard } from '@/hooks/useArenaData';
import { AgentProfileModal } from './AgentProfileModal';
import type { Agent } from '@/lib/types';

// ─── Helpers ───────────────────────────────────────────────

function shortenAddress(addr: string): string {
  if (addr.length <= 11) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatHandle(handle?: string, name?: string): string {
  if (handle) return handle.startsWith('@') ? handle : `@${handle}`;
  return name || '???';
}

function getAvatarSrc(avatarUrl?: string, twitterHandle?: string): string | null {
  if (avatarUrl) return avatarUrl;
  if (!twitterHandle) return null;
  const normalized = twitterHandle.replace(/^@/, '').trim();
  if (!normalized) return null;
  return `https://unavatar.io/twitter/${normalized}`;
}

function isActiveAgent(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() < 3_600_000;
}

// ─── Medal config ───────────────────────────────────────────

const MEDALS = {
  1: {
    ring: '#F59E0B',
    glow: 'rgba(245,158,11,0.4)',
    cardBg: 'linear-gradient(160deg,#1f1400 0%,#2d1e00 60%,#1a1000 100%)',
    border: 'rgba(245,158,11,0.3)',
    label: '#F59E0B',
    shimmer: true,
    pulse: true,
  },
  2: {
    ring: '#9CA3AF',
    glow: 'rgba(156,163,175,0.15)',
    cardBg: 'linear-gradient(160deg,#111318 0%,#1c1f27 100%)',
    border: 'rgba(156,163,175,0.2)',
    label: '#9CA3AF',
    shimmer: false,
    pulse: false,
  },
  3: {
    ring: '#CD7C2F',
    glow: 'rgba(205,124,47,0.15)',
    cardBg: 'linear-gradient(160deg,#150900 0%,#211200 100%)',
    border: 'rgba(205,124,47,0.2)',
    label: '#CD7C2F',
    shimmer: false,
    pulse: false,
  },
} as const;

// ─── CSS animations ─────────────────────────────────────────

const ANIMATIONS = `
  @keyframes ar-shimmer {
    0%   { transform: translateX(-120%) skewX(-15deg); }
    100% { transform: translateX(350%)  skewX(-15deg); }
  }
  @keyframes ar-breathe {
    0%, 100% { opacity: 1;   transform: scale(1);    }
    50%       { opacity: 0.3; transform: scale(0.65); }
  }
  @keyframes ar-gold-pulse {
    0%, 100% { box-shadow: 0 0 18px rgba(245,158,11,0.35), 0 0 50px rgba(245,158,11,0.08); }
    50%       { box-shadow: 0 0 30px rgba(245,158,11,0.55), 0 0 80px rgba(245,158,11,0.14); }
  }
  @keyframes ar-slide-in {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
`;

// ─── Sub-components ─────────────────────────────────────────

function ActiveDot({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
  const cls = size === 'sm' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  return (
    <span
      className={`${cls} rounded-full bg-green-400 border border-black/60 absolute -bottom-0.5 -right-0.5`}
      style={{ animation: 'ar-breathe 2.4s ease-in-out infinite' }}
    />
  );
}

function Avatar({
  src,
  label,
  size,
  ring,
}: {
  src: string | null;
  label: string;
  size: number;
  ring: string;
}) {
  return (
    <div
      className="relative rounded-full overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, border: `2px solid ${ring}` }}
    >
      {src ? (
        <Image src={src} alt={label} fill className="object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/5">
          <span className="text-xs font-bold" style={{ color: ring }}>
            {label[0]?.toUpperCase() || '?'}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Podium card (top 3) ────────────────────────────────────

function PodiumCard({
  agent,
  rank,
  onClick,
}: {
  agent: Agent;
  rank: 1 | 2 | 3;
  onClick: () => void;
}) {
  const m = MEDALS[rank];
  const avatarSrc = getAvatarSrc(agent.avatarUrl, agent.twitterHandle);
  const label = formatHandle(agent.twitterHandle, agent.agentName);
  const active = isActiveAgent(agent.updatedAt);
  const isFirst = rank === 1;

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-1 p-2 rounded-lg border overflow-hidden w-full cursor-pointer transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97]"
      style={{
        background: m.cardBg,
        borderColor: m.border,
        minHeight: isFirst ? 108 : 86,
        animation: isFirst ? 'ar-gold-pulse 3s ease-in-out infinite' : undefined,
      }}
    >
      {/* Shimmer sweep — gold only */}
      {m.shimmer && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg,transparent 0%,rgba(255,210,0,0.14) 50%,transparent 100%)',
            animation: 'ar-shimmer 3.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Crown icon for #1 */}
      {isFirst && (
        <Crown
          className="absolute top-1.5 right-1.5 opacity-50"
          style={{ width: 10, height: 10, color: m.ring }}
        />
      )}

      {/* Rank number */}
      <span className="text-[8px] font-mono font-bold tracking-wider opacity-70" style={{ color: m.ring }}>
        #{String(rank).padStart(2, '0')}
      </span>

      {/* Avatar with optional active dot */}
      <div className="relative">
        <Avatar src={avatarSrc} label={label} size={isFirst ? 36 : 28} ring={m.ring} />
        {active && <ActiveDot size="sm" />}
      </div>

      {/* Name */}
      <span
        className="text-[8px] font-mono text-center leading-tight w-full px-0.5 truncate"
        style={{ color: m.label }}
        title={label}
      >
        {label.length > 10 ? label.slice(0, 9) + '…' : label}
      </span>

      {/* Trade count */}
      <span className="text-[11px] font-mono font-bold text-white/80">{agent.trade_count}</span>
    </button>
  );
}

// ─── Terminal row (rank 4+) ──────────────────────────────────

function TerminalRow({
  agent,
  rank,
  maxTrades,
  delay,
  copiedId,
  onCopy,
  onClick,
}: {
  agent: Agent;
  rank: number;
  maxTrades: number;
  delay: number;
  copiedId: string | null;
  onCopy: (id: string, addr: string) => void;
  onClick: () => void;
}) {
  const avatarSrc = getAvatarSrc(agent.avatarUrl, agent.twitterHandle);
  const label = formatHandle(agent.twitterHandle, agent.agentName);
  const active = isActiveAgent(agent.updatedAt);
  const volumePct = Math.round((agent.trade_count / maxTrades) * 100);
  const winRate = agent.win_rate > 1 ? agent.win_rate : agent.win_rate * 100;
  const winning = winRate >= 50;

  return (
    <button
      onClick={onClick}
      className="relative w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.04] transition-colors group cursor-pointer text-left"
      style={{ animation: `ar-slide-in 0.18s ease-out ${delay}ms both` }}
    >
      {/* Rank */}
      <span className="text-[9px] font-mono text-white/35 w-7 flex-shrink-0 text-right tabular-nums">
        #{String(rank).padStart(2, '0')}
      </span>

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-7 h-7 rounded-full overflow-hidden border border-white/10 relative">
          {avatarSrc ? (
            <Image src={avatarSrc} alt={label} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/5">
              <span className="text-[8px] font-bold text-white/35">
                {label[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>
        {active && <ActiveDot size="xs" />}
      </div>

      {/* Name + volume bar */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono text-white/35 truncate group-hover:text-white/55 transition-colors">
          {label}
        </div>
        {/* Relative volume bar */}
        <div className="mt-1 h-[2px] w-full bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${volumePct}%`,
              background: 'linear-gradient(90deg,rgba(99,102,241,0.6),rgba(139,92,246,0.4))',
            }}
          />
        </div>
      </div>

      {/* Trade count + WIN/LOSE indicator */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          role="button"
          className="text-[9px] font-mono text-white/35 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded tabular-nums hover:bg-white/[0.1] transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(agent.agentId, agent.walletAddress);
          }}
          title="Copy wallet"
        >
          {copiedId === agent.agentId ? (
            <Check className="w-2.5 h-2.5 text-green-400 inline" />
          ) : (
            agent.trade_count
          )}
        </span>
        <span
          className={`text-[7px] font-mono font-bold px-1 py-0.5 rounded-sm leading-none tracking-wider ${
            winning
              ? 'bg-green-500/15 text-green-400 border border-green-500/20'
              : 'bg-red-500/15 text-red-400 border border-red-500/20'
          }`}
        >
          {winning ? 'YES' : 'NO'}
        </span>
      </div>
    </button>
  );
}

// ─── Loading skeleton ────────────────────────────────────────

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5 mb-4 items-end">
        {[86, 108, 86].map((h, i) => (
          <div
            key={i}
            className="rounded-lg bg-white/[0.03] animate-pulse"
            style={{ height: h }}
          />
        ))}
      </div>
      <div className="h-px bg-white/[0.06]" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-7 h-3 bg-white/[0.03] animate-pulse rounded" />
          <div className="w-7 h-7 bg-white/[0.03] animate-pulse rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-16 bg-white/[0.03] animate-pulse rounded" />
            <div className="h-[2px] w-full bg-white/[0.02] animate-pulse rounded" />
          </div>
          <div className="w-8 h-5 bg-white/[0.03] animate-pulse rounded" />
          <div className="w-6 h-4 bg-white/[0.02] animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export function ArenaLeaderboard() {
  const { data: rawAgents, error, isLoading } = useLeaderboard();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const agents = useMemo(
    () => (rawAgents || []).sort((a, b) => b.trade_count - a.trade_count).slice(0, 50),
    [rawAgents],
  );

  const maxTrades = agents[0]?.trade_count || 1;

  // Podium display order: silver (2nd) — gold (1st) — bronze (3rd)
  const podiumSlots: Array<{ rank: 1 | 2 | 3; agent: (typeof agents)[number] | null }> = [
    { rank: 2, agent: agents[1] ?? null },
    { rank: 1, agent: agents[0] ?? null },
    { rank: 3, agent: agents[2] ?? null },
  ];

  function handleCopy(id: string, addr: string) {
    navigator.clipboard.writeText(addr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <>
      <style>{ANIMATIONS}</style>

      {/* Wrapper — relative for scanline positioning */}
      <div className="relative">

        {/* Scanline texture */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-lg"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.018) 2px,rgba(255,255,255,0.018) 3px)',
            backgroundSize: '100% 4px',
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-2 mb-3 px-0.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"
            style={{ animation: 'ar-breathe 2.4s ease-in-out infinite' }}
          />
          <span className="text-[9px] font-mono font-bold tracking-[0.28em] text-white/35 uppercase">
            Agent Rankings
          </span>
        </div>

        {isLoading && <LeaderboardSkeleton />}

        {!isLoading && (error || agents.length === 0) && (
          <div className="text-center py-8 text-white/35 text-[10px] font-mono tracking-widest">
            NO DATA AVAILABLE
          </div>
        )}

        {!isLoading && agents.length > 0 && (
          <>
            {/* ── Podium ── */}
            <div className="grid grid-cols-3 gap-1.5 mb-3 items-end">
              {podiumSlots.map(({ rank, agent }) =>
                agent ? (
                  <PodiumCard
                    key={agent.agentId}
                    agent={agent}
                    rank={rank}
                    onClick={() => setSelectedAgentId(agent.agentId)}
                  />
                ) : (
                  <div key={rank} />
                ),
              )}
            </div>

            {/* Separator */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-2" />

            {/* ── Terminal rows ── */}
            {agents.length > 3 && (
              <div className="max-h-[240px] sm:max-h-[300px] overflow-y-auto scrollbar-custom">
                {agents.slice(3).map((agent, idx) => (
                  <TerminalRow
                    key={agent.agentId}
                    agent={agent}
                    rank={idx + 4}
                    maxTrades={maxTrades}
                    delay={idx * 25}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                    onClick={() => setSelectedAgentId(agent.agentId)}
                  />
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-1.5 text-[9px] font-mono tracking-[0.18em] uppercase text-white/35 hover:text-accent-soft transition-colors group"
              >
                View Full Leaderboard
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </>
        )}
      </div>

      {selectedAgentId && (
        <AgentProfileModal
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
        />
      )}
    </>
  );
}
