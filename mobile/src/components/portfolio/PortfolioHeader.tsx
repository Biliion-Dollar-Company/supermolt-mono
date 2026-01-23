import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PortfolioHeaderProps {
  totalValue: number;
  pnl: {
    value: number;
    percentage: number;
  };
  isLoading: boolean;
}

export function PortfolioHeader({
  totalValue,
  pnl,
  isLoading,
}: PortfolioHeaderProps) {
  const isPositive = pnl.value >= 0;

  return (
    <View className="px-4 pt-4">
      {/* Title row */}
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground text-2xl font-bold">Portfolio</Text>
        <View className="flex-row items-center gap-2">
          <Ionicons name="notifications-outline" size={24} color="#a1a1aa" />
          <Ionicons name="settings-outline" size={24} color="#a1a1aa" />
        </View>
      </View>

      {/* Total value card */}
      <View className="bg-card rounded-xl p-5 mt-4">
        <Text className="text-foreground-muted text-sm">Total Value</Text>

        {isLoading ? (
          <View className="h-10 mt-2 bg-background rounded animate-pulse" />
        ) : (
          <View className="flex-row items-baseline mt-1">
            <Text className="text-foreground text-3xl font-bold">
              {totalValue.toFixed(2)}
            </Text>
            <Text className="text-foreground-secondary text-lg ml-2">SOL</Text>
          </View>
        )}

        {/* PnL row */}
        {!isLoading && (
          <View className="flex-row items-center mt-2">
            <View
              className={`flex-row items-center px-2 py-1 rounded ${
                isPositive ? 'bg-success/20' : 'bg-error/20'
              }`}
            >
              <Ionicons
                name={isPositive ? 'trending-up' : 'trending-down'}
                size={14}
                color={isPositive ? '#22C55E' : '#EF4444'}
              />
              <Text
                className={`ml-1 text-sm font-medium ${
                  isPositive ? 'text-success' : 'text-error'
                }`}
              >
                {isPositive ? '+' : ''}
                {pnl.value.toFixed(2)} SOL ({pnl.percentage.toFixed(1)}%)
              </Text>
            </View>
            <Text className="text-foreground-muted text-sm ml-2">today</Text>
          </View>
        )}
      </View>
    </View>
  );
}
