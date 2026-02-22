import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Position } from '@/store/portfolio';
import { MilestoneProgress } from './MilestoneProgress';

interface PositionCardProps {
  position: Position;
}

export function PositionCard({ position }: PositionCardProps) {
  const isPositive = position.unrealizedPnlPct >= 0;

  return (
    <View className="bg-card rounded-xl p-4">
      {/* Header row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {/* Token icon placeholder */}
          <View className="w-10 h-10 rounded-full bg-brand-primary/20 items-center justify-center">
            <Text className="text-brand-primary font-bold">
              {position.tokenSymbol.slice(0, 2)}
            </Text>
          </View>
          <View>
            <Text className="text-foreground font-semibold">
              {position.tokenSymbol}
            </Text>
            <Text className="text-foreground-muted text-sm">
              {position.buyCount} buy · {position.sellCount} sell
            </Text>
          </View>
        </View>

        {/* P&L badge */}
        <View
          className={`px-3 py-1 rounded-full ${
            isPositive ? 'bg-success/20' : 'bg-error/20'
          }`}
        >
          <Text
            className={`font-semibold ${
              isPositive ? 'text-success' : 'text-error'
            }`}
          >
            {isPositive ? '+' : ''}
            {position.unrealizedPnlPct.toFixed(0)}%
          </Text>
        </View>
      </View>

      {/* Value row */}
      <View className="flex-row justify-between mt-3">
        <View>
          <Text className="text-foreground-muted text-xs">Entry</Text>
          <Text className="text-foreground">{position.entrySol.toFixed(3)} SOL</Text>
        </View>
        <View className="items-center">
          <Ionicons name="arrow-forward" size={16} color="#71717a" />
        </View>
        <View className="items-end">
          <Text className="text-foreground-muted text-xs">Current</Text>
          <Text className="text-foreground">
            {position.currentValueSol.toFixed(3)} SOL
          </Text>
        </View>
      </View>

      {/* Milestone progress */}
      <MilestoneProgress
        currentMultiplier={position.unrealizedPnlPct / 100 + 1}
        targetsHit={position.targetsHit}
        nextTarget={position.nextTargetMultiplier}
        progress={position.targetProgress}
      />
    </View>
  );
}
