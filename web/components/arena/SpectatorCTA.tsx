'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://sr-mobile-production.up.railway.app';

interface LeaderboardAgent {
  name: string;
  pnlPercent: number;
}

export function SpectatorCTA({ className }: { className?: string }) {
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/arena/leaderboard`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: any) => {
        const list: any[] = Array.isArray(data) ? data : data?.agents ?? data?.leaderboard ?? [];
        const top3 = list.slice(0, 3).map((a: any) => ({
          name: a.name || a.agentName || 'Agent',
          pnlPercent: a.pnlPercent ?? a.weeklyPnl ?? a.pnl ?? 0,
        }));
        setAgents(top3);
      })
      .catch(() => {});
  }, []);

  // Rotate every 5 seconds
  useEffect(() => {
    if (agents.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % agents.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [agents.length]);

  const current = agents[activeIdx];
  const headline = current
    ? `${current.name} is up ${current.pnlPercent > 0 ? '+' : ''}${current.pnlPercent.toFixed(1)}% this week`
    : 'Deploy your agent. Watch it trade.';

  return (
    <div
      className={`rounded-xl p-6 text-center ${className ?? ''}`}
      style={{
        background: 'rgba(12,16,32,0.6)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <p className="text-white/55 text-sm mb-1 transition-opacity duration-500">
        {headline}
      </p>
      <h3 className="text-white/80 text-lg font-semibold mb-4">
        Start trading with AI agents
      </h3>
      <Link
        href="/login"
        className="inline-block rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
        style={{
          backgroundColor: '#E8B45E',
          color: '#07090F',
        }}
      >
        Deploy Agent →
      </Link>
    </div>
  );
}
