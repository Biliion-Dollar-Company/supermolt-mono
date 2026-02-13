import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card } from '@/components/ui';
import { colors } from '@/theme/colors';
import type { EpochReward } from '@/types/arena';

interface EpochRewardCardProps {
  rewards: EpochReward;
}

export function EpochRewardCard({ rewards }: EpochRewardCardProps) {
  const { epoch, allocations, treasury } = rewards;

  if (!epoch) return null;

  const topAllocations = allocations.slice(0, 3);

  return (
    <Card variant="default" padding="md">
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Ionicons name="trophy" size={20} color={colors.status.warning} />
        <View style={{ flex: 1 }}>
          <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
            {epoch.name}
          </Text>
          <Text variant="caption" color="muted">
            Epoch #{epoch.number} | {epoch.status}
          </Text>
        </View>
        <Text variant="h3" color="primary" style={{ fontWeight: '700' }}>
          ${epoch.usdcPool.toFixed(0)}
        </Text>
      </View>

      {/* Treasury */}
      <View
        style={{
          backgroundColor: colors.surface.tertiary,
          borderRadius: 8,
          padding: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <Text variant="caption" color="muted">Balance</Text>
          <Text variant="bodySmall" color="primary">${treasury.balance.toFixed(2)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text variant="caption" color="muted">Distributed</Text>
          <Text variant="bodySmall" color="success">${treasury.distributed.toFixed(2)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text variant="caption" color="muted">Available</Text>
          <Text variant="bodySmall" color="brand">${treasury.available.toFixed(2)}</Text>
        </View>
      </View>

      {/* Top Allocations */}
      {topAllocations.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text variant="caption" color="muted">Top Allocations</Text>
          {topAllocations.map((alloc) => (
            <View
              key={alloc.agentId}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text variant="caption" color="muted">#{alloc.rank}</Text>
                <Text variant="bodySmall" color="primary">{alloc.agentName}</Text>
              </View>
              <Text
                variant="bodySmall"
                color="success"
                style={{ fontWeight: '600' }}
              >
                ${alloc.usdcAmount.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
