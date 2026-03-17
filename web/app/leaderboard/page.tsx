'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Trophy, TrendingUp, Users, Target } from 'lucide-react';
import { getLeaderboard } from '@/lib/api';
import { Agent } from '@/lib/types';
import { formatPercent, formatCurrency } from '@/lib/design-system';
import { AgentProfileModal } from '@/components/arena/AgentProfileModal';

const GOLD  = '#E8B45E';
const YES_C = '#4ade80';
const NO_C  = '#f87171';
const BG    = '#07090F';
const SURF  = '#0C1020';

function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  return (
    <div
      className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-[11px] font-black font-mono"
      style={{
        background: isTop3 ? `rgba(232,180,94,${0.15 - (rank - 1) * 0.04})` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isTop3 ? `rgba(232,180,94,${0.3 - (rank - 1) * 0.08})` : 'rgba(255,255,255,0.07)'}`,
        color: isTop3 ? GOLD : 'rgba(255,255,255,0.22)',
      }}
    >
      {rank}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const hue = ((name.charCodeAt(0) ?? 0) * 41 + (name.charCodeAt(1) ?? 0) * 17) % 360;
  return (
    <div
      className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-[11px] font-bold font-mono"
      style={{
        background: `hsl(${hue},35%,10%)`,
        border: `1px solid hsl(${hue},35%,20%)`,
        color: `hsl(${hue},60%,58%)`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function Leaderboard() {
  const [profileAgentId, setProfileAgentId] = useState<string | null>(null);
  const { data: agents = [], isLoading } = useSWR('/arena/leaderboard', getLeaderboard, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  const stats = [
    { label: 'Total Agents', value: agents.length, icon: Users },
    { label: 'Active Traders', value: agents.filter(a => a.trade_count > 0).length, icon: Target },
    { label: 'Avg Win Rate', value: agents.length > 0 ? `${Math.round(agents.reduce((sum, a) => sum + (a.win_rate || 0), 0) / agents.length)}%` : '0%', icon: TrendingUp },
    { label: 'Total Trades', value: agents.reduce((sum, a) => sum + (a.trade_count || 0), 0), icon: Trophy },
  ];

  if (isLoading && agents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="flex flex-col items-center gap-5">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(232,180,94,0.15)', borderTopColor: GOLD }} />
          <p className="text-[10px] font-mono uppercase tracking-[0.35em] opacity-40" style={{ color: GOLD }}>
            Loading leaderboard
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen" style={{ background: BG }}>

      {/* Sticky header */}
      <div className="sticky top-0 z-30 pt-16 sm:pt-[64px]"
        style={{ background: BG, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-4 px-4 sm:px-6 py-3">
          <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(232,180,94,0.55)' }} />
          <h1 className="text-base font-black tracking-tight text-white font-mono">LEADERBOARD</h1>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: YES_C }} />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Live</span>
          </div>
          <span className="ml-auto text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{agents.length} agents</span>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="flex flex-col items-center py-3 px-2"
                style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div className="text-[15px] font-black font-mono tabular-nums" style={{ color: GOLD }}>
                  {stat.value}
                </div>
                <div className="text-[9px] font-mono uppercase tracking-[0.15em] mt-0.5"
                  style={{ color: 'rgba(255,255,255,0.22)' }}>
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent rows */}
      <div>
        {agents.length === 0 ? (
          <div className="py-20 text-center">
            <Trophy className="w-8 h-8 mx-auto mb-4 opacity-8 text-white" />
            <p className="text-[13px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>No agents yet — be first</p>
          </div>
        ) : (
          agents.map((agent, index) => (
            <div key={agent.agentId} onClick={() => setProfileAgentId(agent.agentId)} className="cursor-pointer">
              <div
                className="flex items-center gap-3 px-4 sm:px-6 py-4 group transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <RankBadge rank={index + 1} />
                <Avatar name={agent.agentName || agent.walletAddress} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[13px] font-semibold text-white/75 truncate group-hover:text-white/95 transition-colors">
                      {agent.agentName || `Agent ${agent.walletAddress.slice(0, 8)}`}
                    </p>
                    {index === 0 && (
                      <span className="text-[9px] font-black font-mono px-1.5 py-0.5 flex-shrink-0 tracking-wider"
                        style={{ color: GOLD, background: 'rgba(232,180,94,0.1)', border: '1px solid rgba(232,180,94,0.25)' }}>
                        LEADER
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-[100px] overflow-hidden"
                      style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full transition-all duration-700"
                        style={{ width: `${Math.min(100, agent.win_rate || 0)}%`, background: 'rgba(232,180,94,0.5)' }} />
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(232,180,94,0.55)' }}>
                      {formatPercent(agent.win_rate)}
                    </span>
                  </div>
                </div>

                {/* Desktop stats */}
                <div className="hidden md:flex items-center gap-6">
                  {[
                    { label: 'Sortino', val: agent.sortino_ratio?.toFixed(2) || '—', color: undefined },
                    { label: 'P&L', val: formatCurrency(agent.total_pnl), color: agent.total_pnl >= 0 ? YES_C : NO_C },
                    { label: 'Trades', val: String(agent.trade_count || 0), color: undefined },
                  ].map((s) => (
                    <div key={s.label} className="text-right">
                      <div className="text-[13px] font-black font-mono"
                        style={{ color: s.color || 'rgba(255,255,255,0.7)' }}>{s.val}</div>
                      <div className="text-[9px] font-mono uppercase tracking-[0.15em] mt-0.5"
                        style={{ color: 'rgba(255,255,255,0.2)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Mobile: just P&L */}
                <div className="md:hidden text-right flex-shrink-0">
                  <div className="text-[13px] font-black font-mono"
                    style={{ color: agent.total_pnl >= 0 ? YES_C : NO_C }}>
                    {formatCurrency(agent.total_pnl)}
                  </div>
                  <div className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>P&L</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

    {profileAgentId && (
      <AgentProfileModal agentId={profileAgentId} onClose={() => setProfileAgentId(null)} />
    )}
  </>
  );
}
