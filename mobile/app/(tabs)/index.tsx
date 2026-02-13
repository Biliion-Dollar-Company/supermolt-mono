import { ScrollView, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { AgentCard, PnLChart, TerminalLog, WatchlistChips } from '@/components/home';
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
  const { agent, isLoading: agentLoading, refresh: refreshAgent } = useMyAgent();
  const pnl = usePnLHistory();
  const { positions, isLoading: positionsLoading, refresh: refreshPositions } = usePositions();
  const { watchlist } = useWatchlist();
  const agentLive = useAgentLiveStore();
  const agentProfile = useAuthStore((s) => s.agentProfile);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshAgent(), refreshPositions()]);
    setRefreshing(false);
  }, [refreshAgent, refreshPositions]);

  // Show top 3 positions
  const topPositions = positions.slice(0, 3);

  // Latest decision for terminal log
  const latestDecision = agentLive.decisions[0];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.surface.primary }}
      edges={['top']}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Trade Recommendation Alert */}
        <TradeRecommendationAlert />

        {/* Header */}
        <Text variant="h2" color="primary">
          {agentProfile?.name || agent?.name || 'SuperRouter'}
        </Text>

        {/* Agent Status */}
        <AgentCard
          name={agentProfile?.name || agent?.name || 'SuperRouter'}
          isActive={agentLive.status === 'active'}
        />

        {/* PnL Chart */}
        <PnLChart
          data={pnl.data}
          timeframe={pnl.timeframe}
          onTimeframeChange={pnl.changeTimeframe}
          currentValue={pnl.currentValue}
          pnlChange={pnl.pnlChange}
        />

        {/* Watchlist */}
        <WatchlistChips tokens={watchlist} />

        {/* Terminal Log */}
        <TerminalLog
          message={latestDecision?.reason || 'Scanning for opportunities...'}
          type={latestDecision?.action === 'buy' ? 'trading' : latestDecision?.action === 'sell' ? 'trading' : 'scanning'}
        />

        {/* Top Positions */}
        {topPositions.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text variant="h3" color="primary">
              Active Positions
            </Text>
            {topPositions.map((pos) => (
              <PositionCard key={pos.id} position={pos} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
