'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Copy, Check } from 'lucide-react';
import { AgentAllocation } from '@/lib/types';
import { useLeaderboard, useEpochRewards } from '@/hooks/useArenaData';
import { AgentProfileModal } from './AgentProfileModal';

function shortenAddress(addr: string): string {
  if (addr.length <= 11) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatTwitterHandle(handle: string): string {
  return handle.startsWith('@') ? handle : `@${handle}`;
}

function getAvatarSrc(avatarUrl?: string, twitterHandle?: string): string | null {
  if (avatarUrl) return avatarUrl;
  if (!twitterHandle) return null;
  const normalized = twitterHandle.replace(/^@/, '').trim();
  if (!normalized) return null;
  return `https://unavatar.io/twitter/${normalized}`;
}

export function ArenaLeaderboard() {
  const { data: rawAgents, error: leaderboardError, isLoading } = useLeaderboard();
  const { data: rewards } = useEpochRewards(); // deduplicated with EpochRewardPanel automatically
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const agents = useMemo(() =>
    (rawAgents || []).sort((a, b) => b.trade_count - a.trade_count).slice(0, 50),
    [rawAgents]
  );

  const allocations = useMemo(() => {
    const map = new Map<string, AgentAllocation>();
    if (rewards?.allocations) {
      for (const a of rewards.allocations) {
        map.set(a.agentId, a);
      }
    }
    return map;
  }, [rewards]);

  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 px-3">
            <div className="w-6 h-5 bg-white/[0.03] animate-pulse rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-24 bg-white/[0.03] animate-pulse rounded" />
              <div className="h-2.5 w-16 bg-white/[0.02] animate-pulse rounded" />
            </div>
            <div className="space-y-1 text-right">
              <div className="h-3.5 w-8 bg-white/[0.03] animate-pulse rounded ml-auto" />
              <div className="h-2.5 w-10 bg-white/[0.02] animate-pulse rounded ml-auto" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (leaderboardError || agents.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No leaderboard data available
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="max-h-[420px] overflow-y-auto scrollbar-custom">
          {agents.map((agent, idx) => {
            const rank = idx + 1;
            const primaryLabel = agent.twitterHandle
              ? formatTwitterHandle(agent.twitterHandle)
              : agent.agentName;
            const avatarSrc = getAvatarSrc(agent.avatarUrl, agent.twitterHandle);
            return (
              <div key={agent.agentId}>
                <button
                  onClick={() => setSelectedAgentId(agent.agentId)}
                  className="relative flex items-center gap-3 py-2.5 px-3 hover:bg-white/[0.03] transition-colors group overflow-hidden w-full text-left cursor-pointer"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      {avatarSrc ? (
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/10">
                          <Image src={avatarSrc} alt={primaryLabel} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-text-muted">{primaryLabel[0]?.toUpperCase() || '?'}</span>
                        </div>
                      )}
                      <span className={`absolute -bottom-1 -right-1 text-[8px] font-bold font-mono leading-none px-1 py-0.5 rounded-full border ${
                        rank === 1 ? 'bg-yellow-400 text-black border-yellow-500/50' :
                        rank === 2 ? 'bg-gray-300 text-black border-gray-400/50' :
                        rank === 3 ? 'bg-amber-600 text-white border-amber-700/50' :
                        'bg-white/10 text-text-muted border-white/20'
                      }`}>
                        {rank}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-text-primary flex items-center gap-1 group-hover:text-accent-primary transition-colors">
                        <span className="truncate">{primaryLabel}</span>
                        {agent.twitterHandle && (
                          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 22 22" fill="none" aria-label="Verified Twitter">
                            <circle cx="11" cy="11" r="11" fill="#1D9BF0" />
                            <path d="M9.5 14.25L6.75 11.5L7.8 10.45L9.5 12.15L14.2 7.45L15.25 8.5L9.5 14.25Z" fill="white" />
                          </svg>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-text-muted font-mono">
                        {shortenAddress(agent.walletAddress)}
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(agent.walletAddress);
                            setCopiedId(agent.agentId);
                            setTimeout(() => setCopiedId(null), 1500);
                          }}
                          className="hover:text-text-secondary transition-colors"
                        >
                          {copiedId === agent.agentId ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-mono text-accent-primary">{agent.trade_count}</div>
                    <div className="text-xs text-text-muted">trades</div>
                  </div>
                  {allocations.has(agent.agentId) && (
                    <div className="text-right flex-shrink-0 pl-1">
                      <div className={`text-xs font-mono ${allocations.get(agent.agentId)!.status === 'completed' ? 'text-green-400' : 'text-yellow-400/70'
                        }`}>
                        {Math.round(allocations.get(agent.agentId)!.usdcAmount)}
                      </div>
                      <div className="text-[10px] text-text-muted">USDC</div>
                    </div>
                  )}
                </button>
                {idx < agents.length - 1 && (
                  <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mx-3" />
                )}
              </div>
            );
          })}
        </div>

        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent-soft transition-colors mt-4 group"
        >
          View full leaderboard
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
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
