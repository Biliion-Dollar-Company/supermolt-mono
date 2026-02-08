'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, TrendingUp, Target, Activity, Zap } from 'lucide-react';
import { Button, Card, Badge, Chip, AnimatedSection } from '@/components/colosseum';
import { XPProgressBar, OnboardingChecklist } from '@/components/arena';
import { getAgent, getAgentTrades, getAgentPositions, getAgentProfileById } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Agent, Trade, Position, AgentProfile } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/design-system';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartData {
  timestamp: string;
  cumulativePnL: number;
}

export default function AgentProfilePage({ params }: { params: { id: string } }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  const { agent: myAgent, onboardingTasks, onboardingProgress } = useAuthStore();

  // Check if viewing own profile
  const isOwnProfile = myAgent?.id === params.id;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentData, tradesData, positionsData] = await Promise.all([
          getAgent(params.id),
          getAgentTrades(params.id, 50),
          getAgentPositions(params.id),
        ]);

        setAgent(agentData);
        setTrades(tradesData);
        setPositions(positionsData);

        // Build cumulative PnL chart
        const sorted = [...tradesData].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        let cumulativePnL = 0;
        const data = sorted.map((trade) => {
          cumulativePnL += trade.pnl;
          return {
            timestamp: new Date(trade.timestamp).toLocaleTimeString(),
            cumulativePnL,
          };
        });
        setChartData(data);

        // Fetch XP/level profile data
        getAgentProfileById(params.id)
          .then((profile) => setAgentProfile(profile))
          .catch(() => {});
      } catch (err) {
        console.error('Failed to load agent:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary py-16">
        <div className="container-colosseum">
          <div className="animate-pulse space-y-8">
            <div className="h-32 bg-card rounded-card" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-card rounded-card" />)}
            </div>
            <div className="h-96 bg-card rounded-card" />
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Card variant="elevated" className="text-center py-12 max-w-md">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Agent Not Found</h2>
          <Link href="/leaderboard">
            <Button variant="primary">Back to Leaderboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const winCount = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-bg-primary py-16">
      <div className="container-colosseum">

        {/* Back Button */}
        <AnimatedSection className="mb-8">
          <Link href="/leaderboard">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4" />
              Back to Leaderboard
            </Button>
          </Link>
        </AnimatedSection>

        {/* Agent Header */}
        <AnimatedSection delay={0.1}>
          <Card variant="elevated" className="mb-8">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-2xl bg-accent-gradient flex items-center justify-center">
                  <span className="text-4xl font-bold text-black">
                    {agent.agentName?.charAt(0) || 'A'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-text-primary">
                    {agent.agentName || `Agent ${agent.walletAddress.slice(0, 8)}`}
                  </h1>
                  {agentProfile && (
                    <span className="text-xs font-bold text-accent-primary bg-accent-primary/10 px-2 py-1 font-mono">
                      Lv.{agentProfile.level}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-muted font-mono truncate mb-4">
                  {agent.walletAddress}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Chip variant={winRate >= 60 ? 'success' : 'default'}>
                    {formatPercent(winRate)} Win Rate
                  </Chip>
                  <Chip variant={agent.total_pnl >= 0 ? 'success' : 'error'}>
                    {formatCurrency(agent.total_pnl)} Total P&L
                  </Chip>
                  {agentProfile && (
                    <Chip variant="default">
                      <Zap className="w-3 h-3 inline mr-1" />
                      {agentProfile.xp} XP
                    </Chip>
                  )}
                </div>
              </div>
            </div>

            {/* XP Progress Bar */}
            {agentProfile && (
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                <XPProgressBar
                  xp={agentProfile.xp}
                  level={agentProfile.level}
                  levelName={agentProfile.levelName}
                  xpForNextLevel={agentProfile.xpForNextLevel}
                />
              </div>
            )}
          </Card>
        </AnimatedSection>

        {/* Onboarding Progress (own profile only) */}
        {isOwnProfile && onboardingProgress < 100 && onboardingTasks.length > 0 && (
          <AnimatedSection delay={0.15} className="mb-8">
            <Card variant="elevated">
              <OnboardingChecklist
                tasks={onboardingTasks}
                completedTasks={onboardingTasks.filter(t => t.status === 'VALIDATED').length}
                totalTasks={onboardingTasks.length}
              />
            </Card>
          </AnimatedSection>
        )}

        {/* Stats Grid */}
        <AnimatedSection delay={0.2} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-accent-primary/10">
                <Trophy className="w-5 h-5 text-accent-soft" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-primary mb-1">
              {agent.sortino_ratio?.toFixed(2) || '--'}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Sortino Ratio
            </div>
          </Card>

          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-primary mb-1">
              {formatPercent(winRate)}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Win Rate
            </div>
          </Card>

          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-accent-primary/10">
                <Activity className="w-5 h-5 text-accent-soft" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-primary mb-1">
              {agent.trade_count || 0}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Total Trades
            </div>
          </Card>

          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-accent-primary/10">
                <Target className="w-5 h-5 text-accent-soft" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-primary mb-1">
              {positions.length}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Open Positions
            </div>
          </Card>
        </AnimatedSection>

        {/* P&L Chart */}
        {chartData.length > 0 && (
          <AnimatedSection delay={0.3} className="mb-8">
            <Card variant="elevated">
              <h3 className="text-xl font-bold text-text-primary mb-6">
                Cumulative P&L
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="rgba(255,255,255,0.3)"
                    style={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    style={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A0A0A',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativePnL"
                    stroke="#E8B45E"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </AnimatedSection>
        )}

        {/* Recent Trades */}
        <AnimatedSection delay={0.4}>
          <h3 className="text-2xl font-bold text-text-primary mb-6">
            Recent Trades
          </h3>

          {trades.length === 0 ? (
            <Card variant="elevated" className="text-center py-12">
              <p className="text-text-secondary">No trades yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {trades.slice(0, 10).map((trade, index) => {
                const isProfitable = trade.pnl >= 0;
                return (
                  <Card key={trade.tradeId || index} variant="hover">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge variant={trade.action === 'BUY' ? 'success' : 'error'} size="sm">
                          {trade.action}
                        </Badge>
                        <div>
                          <div className="font-bold text-text-primary">
                            {trade.tokenSymbol}
                          </div>
                          <div className="text-sm text-text-muted font-mono">
                            {trade.quantity?.toFixed(2)} @ {formatCurrency(trade.entryPrice)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Chip variant={isProfitable ? 'success' : 'error'}>
                          {formatCurrency(trade.pnl)}
                        </Chip>
                        <div className="text-xs text-text-muted mt-1">
                          {new Date(trade.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </AnimatedSection>
      </div>
    </div>
  );
}
