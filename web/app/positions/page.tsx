'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Briefcase, DollarSign, Target, Activity } from 'lucide-react';
import { getAllPositions } from '@/lib/api';
import { Position } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/design-system';

const glass = 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)]';

type FilterType = 'all' | 'positive' | 'negative';

export default function PositionsPage() {
  const { data: positions = [], isLoading } = useSWR('/arena/positions', getAllPositions, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredPositions = useMemo(() => {
    return positions.filter(position => {
      if (filter === 'positive' && position.pnl <= 0) return false;
      if (filter === 'negative' && position.pnl >= 0) return false;
      return true;
    });
  }, [positions, filter]);

  const stats = useMemo(() => {
    const totalValue = filteredPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnl = filteredPositions.reduce((sum, p) => sum + p.pnl, 0);
    const positiveCount = filteredPositions.filter(p => p.pnl > 0).length;
    const negativeCount = filteredPositions.filter(p => p.pnl < 0).length;
    return { totalValue, totalPnl, positiveCount, negativeCount, count: filteredPositions.length };
  }, [filteredPositions]);

  const filterBtnClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors flex items-center gap-1.5 ${
      active
        ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
        : 'bg-white/[0.04] text-text-muted border border-white/[0.1] hover:bg-white/[0.06]'
    }`;

  if (isLoading && positions.length === 0) {
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
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white/[0.02] rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-white/[0.02] rounded-xl" />)}
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
            <Briefcase className="w-8 h-8 sm:w-10 sm:h-10 text-accent-primary" />
            <h1 className="text-3xl sm:text-5xl font-bold text-text-primary">
              Live Positions
            </h1>
          </div>
          <p className="text-text-muted text-sm sm:text-base">
            Real-time view of all agent holdings
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-text-muted uppercase tracking-wide">Live</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-center gap-2 mb-8 sm:mb-12">
          <button className={filterBtnClass(filter === 'all')} onClick={() => setFilter('all')}>
            <Target className="w-3.5 h-3.5" /> All ({positions.length})
          </button>
          <button className={filterBtnClass(filter === 'positive')} onClick={() => setFilter('positive')}>
            <TrendingUp className="w-3.5 h-3.5" /> Winning ({stats.positiveCount})
          </button>
          <button className={filterBtnClass(filter === 'negative')} onClick={() => setFilter('negative')}>
            <TrendingDown className="w-3.5 h-3.5" /> Losing ({stats.negativeCount})
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-10 sm:mb-16">
          {[
            { icon: Activity, label: 'Open Positions', value: stats.count, color: 'text-accent-primary' },
            { icon: DollarSign, label: 'Total Value', value: formatCurrency(stats.totalValue), color: 'text-accent-primary' },
            { icon: TrendingUp, label: 'Total P&L', value: formatCurrency(stats.totalPnl), color: stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400' },
            { icon: Target, label: 'Win Rate', value: `${stats.positiveCount}/${stats.count}`, color: 'text-text-primary' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className={`${glass} p-4 text-center rounded-none`}>
                <div className="flex justify-center mb-2">
                  <div className="p-2 rounded-lg bg-accent-primary/10">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-accent-primary" />
                  </div>
                </div>
                <div className={`text-xl sm:text-2xl font-bold mb-1 ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wide">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Positions Grid */}
        {filteredPositions.length === 0 ? (
          <div className={`${glass} text-center py-16 rounded-none`}>
            <h3 className="text-xl font-bold text-text-primary mb-2">No Positions Found</h3>
            <p className="text-text-muted text-sm">
              {filter === 'all' ? 'No open positions yet' : `No ${filter} positions`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredPositions.map((position) => {
              const isProfitable = position.pnl >= 0;
              return (
                <div key={position.positionId} className={`${glass} p-4 sm:p-5 rounded-none`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-text-primary truncate mb-1">
                        {position.tokenSymbol}
                      </h3>
                      <Link
                        href={`/agents/${position.agentId}`}
                        className="text-xs text-text-muted hover:text-accent-primary transition-colors truncate block"
                      >
                        {position.agentName}
                      </Link>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-accent-primary/10 text-accent-primary border border-accent-primary/20 rounded-full font-mono">
                      OPEN
                    </span>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-text-muted">Entry</span>
                      <span className="text-xs font-mono text-text-primary">{formatCurrency(position.entryPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-text-muted">Current</span>
                      <span className="text-xs font-mono text-text-primary">{formatCurrency(position.currentPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-text-muted">Size</span>
                      <span className="text-xs font-mono text-text-primary">
                        {position.quantity?.toFixed(2)} {position.tokenSymbol}
                      </span>
                    </div>
                  </div>

                  {/* P&L */}
                  <div className="pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted uppercase tracking-wide">
                        Unrealized P&L
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(position.pnl)}
                        </span>
                        <span className={`text-xs font-mono ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPercent(position.pnlPercent)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
