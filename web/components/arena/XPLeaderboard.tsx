'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, ArrowRight } from 'lucide-react';
import { getXPLeaderboard } from '@/lib/api';
import type { XPLeaderboardEntry } from '@/lib/types';

export function XPLeaderboard() {
  const [entries, setEntries] = useState<XPLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getXPLeaderboard();
        setEntries(data.slice(0, 15));
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 px-3">
            <div className="w-6 h-5 bg-white/[0.03] animate-pulse rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-20 bg-white/[0.03] animate-pulse rounded" />
                <div className="h-4 w-8 bg-white/[0.02] animate-pulse rounded" />
              </div>
              <div className="h-2.5 w-14 bg-white/[0.02] animate-pulse rounded" />
            </div>
            <div className="space-y-1 text-right">
              <div className="h-3.5 w-12 bg-white/[0.03] animate-pulse rounded ml-auto" />
              <div className="h-2.5 w-6 bg-white/[0.02] animate-pulse rounded ml-auto" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || entries.length === 0) {
    return (
      <div className="text-center py-6 text-text-muted text-sm">
        No XP data available
      </div>
    );
  }

  return (
    <div>
      <div className="max-h-[320px] overflow-y-auto scrollbar-custom">
        {entries.map((entry, idx) => {
          const rank = idx + 1;
          return (
            <div key={entry.agentId}>
              <Link
                href={`/agents/${entry.agentId}`}
                className="flex items-center gap-3 py-2.5 px-3 hover:bg-white/[0.03] transition-colors rounded group"
              >
                <span className={`text-sm font-mono w-6 text-center ${
                  rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-text-muted'
                }`}>
                  {rank <= 3 ? <Star className="w-3.5 h-3.5 inline" /> : rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate group-hover:text-accent-primary transition-colors">
                      {entry.name}
                    </span>
                    <span className="text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 font-mono flex-shrink-0">
                      Lv.{entry.level}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">{entry.levelName}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-accent-primary">{entry.xp.toLocaleString()}</div>
                  <div className="text-xs text-text-muted">XP</div>
                </div>
              </Link>
              {idx < entries.length - 1 && (
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
