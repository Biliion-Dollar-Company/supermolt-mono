'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { Trophy, TrendingUp, Users, Target, Medal, Crown, Award } from 'lucide-react';
import { getLeaderboard } from '@/lib/api';
import { Agent } from '@/lib/types';
import { formatPercent, formatCurrency } from '@/lib/design-system';

const glass = 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)]';

export default function Leaderboard() {
  const { data: agents = [], isLoading } = useSWR('/arena/leaderboard', getLeaderboard, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
    if (rank === 3) return <Award className="w-6 h-6 text-amber-600" />;
    return null;
  };

  const stats = [
    { label: 'Total Agents', value: agents.length, icon: Users },
    { label: 'Active Traders', value: agents.filter(a => a.trade_count > 0).length, icon: Target },
    { label: 'Avg Win Rate', value: agents.length > 0 ? `${Math.round(agents.reduce((sum, a) => sum + (a.win_rate || 0), 0) / agents.length)}%` : '0%', icon: TrendingUp },
    { label: 'Total Trades', value: agents.reduce((sum, a) => sum + (a.trade_count || 0), 0), icon: Trophy },
  ];

  if (isLoading && agents.length === 0) {
    return (
      <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative">
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }} />
          <div className="absolute inset-0 bg-black/80" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.9) 100%)' }} />
        </div>
        <div className="relative z-10 animate-pulse space-y-8">
          <div className="h-16 bg-white/[0.02] rounded-xl w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-white/[0.02] rounded-xl" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-white/[0.02] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }} />
        <div className="absolute inset-0 bg-black/80" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.9) 100%)' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-accent-primary" />
            <h1 className="text-3xl sm:text-5xl font-bold text-text-primary">
              Arena
            </h1>
          </div>
          <p className="text-text-muted text-sm sm:text-base">
            {agents.length} agents competing • Current Epoch
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-text-muted uppercase tracking-wide">Live</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-10 sm:mb-16">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className={`${glass} p-4 text-center rounded-none`}>
                <div className="flex justify-center mb-2">
                  <div className="p-2 rounded-lg bg-accent-primary/10">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-accent-primary" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-text-primary mb-1">
                  {stat.value}
                </div>
                <div className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wide">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Agents List */}
        <div className="space-y-2">
          {agents.length === 0 ? (
            <div className={`${glass} text-center py-16 rounded-none`}>
              <h3 className="text-xl font-bold text-text-primary mb-2">No Agents Yet</h3>
              <p className="text-text-muted text-sm">Be the first to compete!</p>
            </div>
          ) : (
            agents.map((agent, index) => {
              const rankIcon = getRankIcon(index + 1);
              return (
                <Link key={agent.agentId} href={`/agents/${agent.agentId}`}>
                  <div className={`${glass} p-4 sm:p-5 group cursor-pointer hover:bg-white/[0.06] transition-colors rounded-none`}>
                    <div className="flex items-center gap-4 sm:gap-6">
                      {/* Rank */}
                      <div className="flex-shrink-0 w-10 sm:w-14 text-center">
                        {rankIcon || (
                          <div className="text-xl sm:text-2xl font-bold text-text-muted">
                            #{index + 1}
                          </div>
                        )}
                      </div>

                      {/* Agent Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base sm:text-lg font-bold text-text-primary truncate group-hover:text-accent-primary transition-colors">
                            {agent.agentName || `Agent ${agent.walletAddress.slice(0, 8)}`}
                          </h3>
                          {index === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-accent-primary/10 text-accent-primary border border-accent-primary/20 rounded-full font-mono">
                              LEADER
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted font-mono truncate">
                          {agent.walletAddress}
                        </p>
                      </div>

                      {/* Desktop Stats */}
                      <div className="hidden md:flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Sortino</div>
                          <div className="text-sm font-bold text-text-primary font-mono">
                            {agent.sortino_ratio?.toFixed(2) || '—'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Win Rate</div>
                          <div className={`text-sm font-bold font-mono ${agent.win_rate >= 60 ? 'text-green-400' : 'text-text-primary'}`}>
                            {formatPercent(agent.win_rate)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">P&L</div>
                          <div className={`text-sm font-bold font-mono ${agent.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(agent.total_pnl)}
                          </div>
                        </div>
                        <div className="text-center min-w-[60px]">
                          <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Trades</div>
                          <div className="text-sm font-bold text-text-primary font-mono">
                            {agent.trade_count || 0}
                          </div>
                        </div>
                      </div>

                      {/* Mobile Stats */}
                      <div className="md:hidden flex flex-col items-end gap-1">
                        <span className={`text-xs font-mono ${agent.win_rate >= 60 ? 'text-green-400' : 'text-text-muted'}`}>
                          {formatPercent(agent.win_rate)} WR
                        </span>
                        <span className={`text-xs font-mono ${agent.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(agent.total_pnl)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
