import { ScrollView, View, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui';
import { AgentCard, PortfolioHero, PnLChart, TerminalLog, WatchlistChips } from '@/components/home';
import { PositionCard } from '@/components/trading';
import { useMyAgent } from '@/hooks/useMyAgent';
import { usePnLHistory } from '@/hooks/usePnLHistory';
import { usePositions } from '@/hooks/usePositions';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useAgentLiveStore } from '@/store/agentLive';
import { useAuthStore } from '@/store/auth';
import { TradeRecommendationAlert } from '@/components/trading/TradeRecommendationAlert';
import { colors } from '@/theme/colors';
import { useState, useCallback } from 'react';

export default function HomeTab() {
  const { agent, refresh: refreshAgent } = useMyAgent();
  const pnl = usePnLHistory();
  const { positions, refresh: refreshPositions } = usePositions();
  const { watchlist } = useWatchlist();
  const agentLive = useAgentLiveStore();
  const agentProfile = useAuthStore((s) => s.agentProfile);
  const stats = useAuthStore((s) => s.stats);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshAgent(), refreshPositions()]);
    setRefreshing(false);
  }, [refreshAgent, refreshPositions]);

  const topPositions = positions.slice(0, 3);
  const latestDecision = agentLive.decisions[0];
  const agentName = agentProfile?.name || agent?.name || 'SuperRouter';
  const isActive = agentLive.status === 'active';

  // Stats for cards
  const totalTrades = agentProfile?.totalTrades ?? stats?.totalTrades ?? 0;
  const winRate = agentProfile?.winRate ?? stats?.winRate ?? 0;
  const totalPnl = agentProfile?.totalPnl ?? stats?.totalPnl ?? 0;
  const sortinoRatio = stats?.sortinoRatio ?? 0;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.void[900] }}
      edges={['top']}
    >
      {/* Background gradient — stronger orange glow */}
      <LinearGradient
        colors={['rgba(249, 115, 22, 0.08)', 'rgba(249, 115, 22, 0.02)', '#0f0f0f']}
        locations={[0, 0.3, 0.7]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Trade Recommendation Alert */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <TradeRecommendationAlert />
        </View>

        {/* Agent Identity Bar */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <AgentCard
            name={agentName}
            handle={agentProfile?.twitterHandle ?? undefined}
            avatarUrl={agentProfile?.avatarUrl ?? undefined}
            isActive={isActive}
            level={agentProfile?.level}
            levelName={agentProfile?.levelName}
            xp={agentProfile?.xp}
            xpForNextLevel={agentProfile?.xpForNextLevel}
          />
        </View>

        {/* Giant P&L Hero */}
        <PortfolioHero
          totalValue={pnl.currentValue}
          pnlChange={pnl.pnlChange}
          pnlPercent={pnl.currentValue > 0 ? (pnl.pnlChange / pnl.currentValue) * 100 : 0}
          todayTrades={agentLive.stats.todayTrades}
        />

        {/* Stat Cards */}
        <View style={cardStyles.row}>
          <View style={cardStyles.card}>
            <Text style={cardStyles.cardValue}>{totalTrades}</Text>
            <Text style={cardStyles.cardLabel}>TRADES</Text>
          </View>
          <View style={cardStyles.card}>
            <Text style={[cardStyles.cardValue, { color: colors.brand.primary }]}>
              {(winRate * 100).toFixed(0)}%
            </Text>
            <Text style={cardStyles.cardLabel}>WIN RATE</Text>
          </View>
          <View style={cardStyles.card}>
            <Text
              style={[
                cardStyles.cardValue,
                { color: sortinoRatio >= 1 ? colors.status.success : sortinoRatio > 0 ? colors.brand.accent : colors.status.error },
              ]}
            >
              {sortinoRatio.toFixed(2)}
            </Text>
            <Text style={cardStyles.cardLabel}>SORTINO</Text>
          </View>
        </View>

        {/* Activity Feed */}
        <View style={{ paddingHorizontal: 16 }}>
          <TerminalLog
            message={latestDecision?.reason || 'Scanning for alpha...'}
            type={latestDecision?.action === 'buy' ? 'trading' : latestDecision?.action === 'sell' ? 'trading' : 'scanning'}
            decisions={agentLive.decisions}
          />
        </View>

        {/* Performance Chart */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <PnLChart
            data={pnl.data}
            timeframe={pnl.timeframe}
            onTimeframeChange={pnl.changeTimeframe}
            currentValue={pnl.currentValue}
            pnlChange={pnl.pnlChange}
          />
        </View>

        {/* Watchlist */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <WatchlistChips tokens={watchlist} />
        </View>

        {/* Active Positions */}
        {topPositions.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 8 }}>
            <View style={sectionStyles.header}>
              <Text style={sectionStyles.label}>ACTIVE POSITIONS</Text>
              <View style={sectionStyles.countBadge}>
                <Text style={sectionStyles.countText}>{positions.length}</Text>
              </View>
              <View style={sectionStyles.headerLine} />
            </View>
            {topPositions.map((pos) => (
              <PositionCard key={pos.id} position={pos} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const cardStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
  },
  cardValue: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardLabel: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  label: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  countBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    color: colors.brand.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
});
