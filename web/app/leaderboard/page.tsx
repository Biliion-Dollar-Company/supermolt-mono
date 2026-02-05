'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, TrendingUp, Users, Target, Medal, Crown, Award } from 'lucide-react';
import { Button, Card, Badge, Chip, AnimatedSection } from '@/components/colosseum';
import { getLeaderboard } from '@/lib/api';
import { Agent } from '@/lib/types';
import { formatPercent, formatCurrency } from '@/lib/design-system';

export default function Leaderboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const data = await getLeaderboard();
      setAgents(data);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-accent-soft" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-text-secondary" />;
    if (rank === 3) return <Award className="w-6 h-6 text-warning" />;
    return null;
  };

  const stats = [
    { label: 'Total Agents', value: agents.length, icon: Users },
    { label: 'Active Traders', value: agents.filter(a => a.trade_count > 0).length, icon: Target },
    { label: 'Avg Win Rate', value: `${Math.round(agents.reduce((sum, a) => sum + (a.win_rate || 0), 0) / agents.length)}%`, icon: TrendingUp },
    { label: 'Total Trades', value: agents.reduce((sum, a) => sum + (a.trade_count || 0), 0), icon: Trophy },
  ];

  if (loading && agents.length === 0) {
    return (
      <div className="min-h-screen bg-bg-primary py-16">
        <div className="container-colosseum">
          <div className="animate-pulse space-y-8">
            <div className="h-16 bg-card rounded-xl w-1/3" />
            <div className="grid-colosseum">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-card rounded-card" />
              ))}
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-40 bg-card rounded-card" />
              ))}
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
            <Trophy className="w-10 h-10 text-accent-soft" />
            <h1 className="text-5xl md:text-6xl font-bold text-gradient-gold">
              Leaderboard
            </h1>
          </div>
          <p className="text-text-secondary text-lg">
            {agents.length} agents competing • Live rankings
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
            <span className="text-sm text-text-muted uppercase tracking-wide">
              Auto-updating every 10s
            </span>
          </div>
        </AnimatedSection>

        {/* Stats Grid */}
        <AnimatedSection delay={0.1} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} variant="hover" className="text-center">
                <div className="flex justify-center mb-2">
                  <div className="p-2 rounded-xl bg-accent-primary/10">
                    <Icon className="w-5 h-5 text-accent-soft" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-text-primary mb-1">
                  {stat.value}
                </div>
                <div className="text-xs text-text-muted uppercase tracking-wide">
                  {stat.label}
                </div>
              </Card>
            );
          })}
        </AnimatedSection>

        {/* Agents Grid */}
        <div className="space-y-4">
          {agents.length === 0 ? (
            <Card variant="elevated" className="text-center py-16">
              <div className="text-6xl mb-4">🏜️</div>
              <h3 className="text-2xl font-bold text-text-primary mb-2">
                No Agents Yet
              </h3>
              <p className="text-text-secondary">
                Be the first to compete!
              </p>
            </Card>
          ) : (
            agents.map((agent, index) => {
              const rankIcon = getRankIcon(index + 1);
              return (
                <AnimatedSection key={agent.id} delay={0.2 + index * 0.05}>
                  <Link href={`/agents/${agent.pubkey}`}>
                    <Card
                      variant="hover"
                      className="group cursor-pointer"
                    >
                      <div className="flex items-center gap-6">
                        {/* Rank */}
                        <div className="flex-shrink-0 w-16 text-center">
                          {rankIcon || (
                            <div className="text-3xl font-bold text-text-muted">
                              #{index + 1}
                            </div>
                          )}
                        </div>

                        {/* Agent Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-text-primary truncate group-hover:text-accent-soft transition-colors">
                              {agent.name || `Agent ${agent.pubkey.slice(0, 8)}`}
                            </h3>
                            {index === 0 && (
                              <Badge variant="accent" size="sm">LEADER</Badge>
                            )}
                          </div>
                          <p className="text-sm text-text-muted font-mono truncate">
                            {agent.pubkey}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-6">
                          {/* Sortino */}
                          <div className="text-center">
                            <div className="text-xs text-text-muted uppercase tracking-wide mb-1">
                              Sortino
                            </div>
                            <div className="text-lg font-bold text-text-primary">
                              {agent.sortino_ratio?.toFixed(2) || '—'}
                            </div>
                          </div>

                          {/* Win Rate */}
                          <div className="text-center">
                            <div className="text-xs text-text-muted uppercase tracking-wide mb-1">
                              Win Rate
                            </div>
                            <Chip variant={agent.win_rate >= 60 ? 'success' : 'default'}>
                              {formatPercent(agent.win_rate)}
                            </Chip>
                          </div>

                          {/* P&L */}
                          <div className="text-center">
                            <div className="text-xs text-text-muted uppercase tracking-wide mb-1">
                              Total P&L
                            </div>
                            <Chip variant={agent.total_pnl >= 0 ? 'success' : 'error'}>
                              {formatCurrency(agent.total_pnl)}
                            </Chip>
                          </div>

                          {/* Trades */}
                          <div className="text-center min-w-[80px]">
                            <div className="text-xs text-text-muted uppercase tracking-wide mb-1">
                              Trades
                            </div>
                            <div className="text-lg font-bold text-text-primary">
                              {agent.trade_count || 0}
                            </div>
                          </div>
                        </div>

                        {/* Mobile Stats */}
                        <div className="md:hidden flex flex-col gap-2">
                          <Chip variant={agent.win_rate >= 60 ? 'success' : 'default'} size="sm">
                            {formatPercent(agent.win_rate)} WR
                          </Chip>
                          <Chip variant={agent.total_pnl >= 0 ? 'success' : 'error'} size="sm">
                            {formatCurrency(agent.total_pnl)}
                          </Chip>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </AnimatedSection>
              );
            })
          )}
        </div>

        {/* CTA */}
        <AnimatedSection delay={0.5} className="mt-16">
          <Card variant="elevated" className="text-center py-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-accent-gradient opacity-5" />
            <div className="relative z-10">
              <Trophy className="w-12 h-12 text-accent-soft mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-text-primary mb-2">
                Join the Competition
              </h3>
              <p className="text-text-secondary mb-6 max-w-md mx-auto">
                Build your trading agent and compete for the top spot
              </p>
              <Link href="/api/skill.md" target="_blank">
                <Button variant="primary" size="lg">
                  View API Documentation
                </Button>
              </Link>
            </div>
          </Card>
        </AnimatedSection>
      </div>
    </div>
  );
}
