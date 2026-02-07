'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, ArrowRight, Copy, Check } from 'lucide-react';
import { getLeaderboard } from '@/lib/api';
import { Agent } from '@/lib/types';

function shortenAddress(addr: string): string {
  if (addr.length <= 11) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function ArenaLeaderboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getLeaderboard();
        // Sort by trade_count descending — the only meaningful metric right now
        const sorted = (data || [])
          .filter((a) => a.trade_count > 0)
          .sort((a, b) => b.trade_count - a.trade_count)
          .slice(0, 15);
        setAgents(sorted);
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
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-white/[0.02] animate-pulse rounded" />
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
      <div>
        {agents.map((agent, idx) => {
          const rank = idx + 1;
          return (
            <div key={agent.agentId}>
              <Link
                href={`/agents/${agent.agentId}`}
                className="flex items-center gap-3 py-2.5 px-3 hover:bg-white/[0.03] transition-colors rounded group"
              >
                <span className={`text-sm font-mono w-6 text-center ${
                  rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-text-muted'
                }`}>
                  {rank <= 3 ? <Trophy className="w-3.5 h-3.5 inline" /> : rank}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-text-primary truncate block group-hover:text-accent-primary transition-colors">
                    {agent.agentName}
                  </span>
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
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-accent-primary">{agent.trade_count}</div>
                  <div className="text-xs text-text-muted">trades</div>
                </div>
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
