'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, ArrowRight } from 'lucide-react';
import { getLeaderboard } from '@/lib/api';
import { Agent } from '@/lib/types';
import { Badge } from '@/components/colosseum';

export function ArenaLeaderboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getLeaderboard();
      setAgents((data || []).slice(0, 15));
      setLoading(false);
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
                  <span className="text-xs text-text-muted font-mono">{agent.walletAddress}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-accent-primary">{agent.sortino_ratio.toFixed(2)}</div>
                  <div className="text-xs text-text-muted">{agent.win_rate.toFixed(0)}% WR</div>
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
