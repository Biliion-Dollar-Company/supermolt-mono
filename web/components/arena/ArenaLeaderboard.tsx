'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trophy, ArrowRight, Copy, Check } from 'lucide-react';
import { getLeaderboard, getEpochRewards } from '@/lib/api';
import { Agent, AgentAllocation } from '@/lib/types';

function shortenAddress(addr: string): string {
  if (addr.length <= 11) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function ArenaLeaderboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allocations, setAllocations] = useState<Map<string, AgentAllocation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [data, rewards] = await Promise.all([
          getLeaderboard(),
          getEpochRewards().catch(() => null),
        ]);
        // Sort by trade_count descending — the only meaningful metric right now
        const sorted = (data || [])
          .filter((a) => a.trade_count > 0)
          .sort((a, b) => b.trade_count - a.trade_count)
          .slice(0, 15);
        setAgents(sorted);

        // Build allocation lookup map
        if (rewards?.allocations) {
          const map = new Map<string, AgentAllocation>();
          for (const a of rewards.allocations) {
            map.set(a.agentId, a);
          }
          setAllocations(map);
        }

        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
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

  if (error || agents.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No leaderboard data available
      </div>
    );
  }

  return (
    <div>
      <div className="max-h-[420px] overflow-y-auto scrollbar-custom">
        {agents.map((agent, idx) => {
          const rank = idx + 1;
          return (
            <div key={agent.agentId}>
              <Link
                href={`/agents/${agent.agentId}`}
                className="flex items-center gap-3 py-2.5 px-3 hover:bg-white/[0.03] transition-colors rounded group"
              >
                <span className={`text-sm font-mono w-6 text-center ${rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-text-muted'
                  }`}>
                  {rank <= 3 ? <Trophy className="w-3.5 h-3.5 inline" /> : rank}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  {agent.avatarUrl ? (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                      <Image src={agent.avatarUrl} alt={agent.agentName} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-text-muted">{agent.agentName[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-text-primary truncate block group-hover:text-accent-primary transition-colors">
                      {agent.agentName}
                    </span>
                    {agent.twitterHandle ? (
                      <span className="text-xs text-blue-400 hover:text-blue-300 transition-colors block truncate">
                        @{agent.twitterHandle}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-text-muted font-mono">
                        {shortenAddress(agent.walletAddress)}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigator.clipboard.writeText(agent.walletAddress);
                            setCopiedId(agent.agentId);
                            setTimeout(() => setCopiedId(null), 1500);
                          }}
                          className="hover:text-text-secondary transition-colors"
                        >
                          {copiedId === agent.agentId ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </span>
                    )}
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
                      {allocations.get(agent.agentId)!.usdcAmount.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-text-muted">USDC</div>
                  </div>
                )}
              </Link>
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
  );
}
