'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Briefcase, DollarSign, Target, Activity } from 'lucide-react';
import { Button, Card, Badge, Chip, AnimatedSection } from '@/components/colosseum';
import { getAllPositions } from '@/lib/api';
import { Position } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/design-system';

type FilterType = 'all' | 'positive' | 'negative';

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchPositions = async () => {
    try {
      const data = await getAllPositions();
      setPositions(data);
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  // Filter positions
  const filteredPositions = useMemo(() => {
    return positions.filter(position => {
      if (filter === 'positive' && position.pnl <= 0) return false;
      if (filter === 'negative' && position.pnl >= 0) return false;
      return true;
    });
  }, [positions, filter]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalValue = filteredPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnl = filteredPositions.reduce((sum, p) => sum + p.pnl, 0);
    const positiveCount = filteredPositions.filter(p => p.pnl > 0).length;
    const negativeCount = filteredPositions.filter(p => p.pnl < 0).length;

    return { totalValue, totalPnl, positiveCount, negativeCount, count: filteredPositions.length };
  }, [filteredPositions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary py-16">
        <div className="container-colosseum">
          <div className="animate-pulse space-y-8">
            <div className="h-16 bg-card rounded-xl w-1/3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-card rounded-card" />)}
            </div>
            <div className="grid-colosseum">
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-card rounded-card" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary py-16">
      <div className="container-colosseum">
        
        {/* Header */}
        <AnimatedSection className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Briefcase className="w-10 h-10 text-accent-soft" />
            <h1 className="text-5xl md:text-6xl font-bold text-gradient-gold">
              Live Positions
            </h1>
          </div>
          <p className="text-text-secondary text-lg">
            Real-time view of all agent holdings
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
            <span className="text-sm text-text-muted uppercase tracking-wide">
              Auto-updating every 10s
            </span>
          </div>
        </AnimatedSection>

        {/* Filter Tabs */}
        <AnimatedSection delay={0.1} className="flex justify-center gap-3 mb-12">
          <Button
            variant={filter === 'all' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setFilter('all')}
          >
            <Target className="w-4 h-4" />
            All ({positions.length})
          </Button>
          <Button
            variant={filter === 'positive' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setFilter('positive')}
          >
            <TrendingUp className="w-4 h-4" />
            Winning ({stats.positiveCount})
          </Button>
          <Button
            variant={filter === 'negative' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setFilter('negative')}
          >
            <TrendingDown className="w-4 h-4" />
            Losing ({stats.negativeCount})
          </Button>
        </AnimatedSection>

        {/* Summary Stats */}
        <AnimatedSection delay={0.2} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-accent-primary/10">
                <Activity className="w-5 h-5 text-accent-soft" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-primary mb-1">
              {stats.count}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Open Positions
            </div>
          </Card>

          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-accent-primary/10">
                <DollarSign className="w-5 h-5 text-accent-soft" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-primary mb-1">
              {formatCurrency(stats.totalValue)}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Total Value
            </div>
          </Card>

          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-accent-primary/10">
                <TrendingUp className="w-5 h-5 text-accent-soft" />
              </div>
            </div>
            <div className={`text-2xl font-bold mb-1 ${stats.totalPnl >= 0 ? 'text-success' : 'text-error'}`}>
              {formatCurrency(stats.totalPnl)}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Total P&L
            </div>
          </Card>

          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-accent-primary/10">
                <Target className="w-5 h-5 text-accent-soft" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-primary mb-1">
              {stats.positiveCount}/{stats.count}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Win Rate
            </div>
          </Card>
        </AnimatedSection>

        {/* Positions Grid */}
        {filteredPositions.length === 0 ? (
          <Card variant="elevated" className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold text-text-primary mb-2">
              No Positions Found
            </h3>
            <p className="text-text-secondary">
              {filter === 'all' ? 'No open positions yet' : `No ${filter} positions`}
            </p>
          </Card>
        ) : (
          <div className="grid-colosseum">
            {filteredPositions.map((position, index) => {
              const isProfitable = position.pnl >= 0;
              return (
                <AnimatedSection key={position.id} delay={0.3 + index * 0.05}>
                  <Card variant="hover" className="h-full">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-text-primary truncate mb-1">
                          {position.tokenSymbol}
                        </h3>
                        <Link 
                          href={`/agents/${position.agentPubkey}`}
                          className="text-sm text-text-muted hover:text-accent-soft transition-colors truncate block"
                        >
                          {position.agentName}
                        </Link>
                      </div>
                      <Badge variant={isProfitable ? 'success' : 'error'} size="sm">
                        {position.status || 'OPEN'}
                      </Badge>
                    </div>

                    {/* Metrics */}
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-text-muted">Entry</span>
                        <span className="text-sm font-mono text-text-primary">
                          {formatCurrency(position.entryPrice)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-text-muted">Current</span>
                        <span className="text-sm font-mono text-text-primary">
                          {formatCurrency(position.currentPrice)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-text-muted">Size</span>
                        <span className="text-sm font-mono text-text-primary">
                          {position.amount?.toFixed(2)} {position.tokenSymbol}
                        </span>
                      </div>
                    </div>

                    {/* P&L Display */}
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-muted uppercase tracking-wide">
                          Unrealized P&L
                        </span>
                        <div className="flex items-center gap-2">
                          <Chip variant={isProfitable ? 'success' : 'error'}>
                            {formatCurrency(position.pnl)}
                          </Chip>
                          <Chip variant={isProfitable ? 'success' : 'error'}>
                            {formatPercent(position.pnlPercent)}
                          </Chip>
                        </div>
                      </div>
                    </div>
                  </Card>
                </AnimatedSection>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
