import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePositions } from '@/hooks/usePositions';
import { PositionCard } from '@/components/portfolio/PositionCard';
import { PortfolioHeader } from '@/components/portfolio/PortfolioHeader';

export default function PortfolioScreen() {
  const { positions, totalValue, pnl, isLoading, refresh } = usePositions();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8B5CF6"
          />
        }
      >
        {/* Header with total value */}
        <PortfolioHeader
          totalValue={totalValue}
          pnl={pnl}
          isLoading={isLoading}
        />

        {/* Positions list */}
        <View className="px-4 mt-4">
          <Text className="text-foreground-secondary text-sm font-medium mb-3">
            Active Positions ({positions.length})
          </Text>

          {positions.length === 0 && !isLoading ? (
            <View className="bg-card rounded-xl p-6 items-center">
              <Text className="text-foreground-muted text-center">
                No active positions.{'\n'}
                Your AI agent is watching the market.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {positions.map((position) => (
                <PositionCard key={position.id} position={position} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
