import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card } from '@/components/ui';
import { colors } from '@/theme/colors';

export interface FeedItem {
  id: string;
  type: 'trade' | 'tp_hit' | 'sl_hit' | 'alert';
  title: string;
  description: string;
  time: string;
  pnl?: number;
  action?: 'BUY' | 'SELL';
  agentName?: string;
  tokenSymbol?: string;
}

interface FeedTradeCardProps {
  item: FeedItem;
}

export function FeedTradeCard({ item }: FeedTradeCardProps) {
  const isBuy = item.action === 'BUY' || item.title.startsWith('Bought');
  const iconName = isBuy ? 'arrow-down-circle' : 'arrow-up-circle';
  const iconColor = isBuy ? colors.status.success : colors.status.error;

  return (
    <Card variant="default" padding="md">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Icon */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isBuy ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={iconName} size={22} color={iconColor} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
            {item.title}
          </Text>
          <Text variant="caption" color="muted">
            {item.description}
          </Text>
        </View>

        {/* PnL + Time */}
        <View style={{ alignItems: 'flex-end' }}>
          {item.pnl != null && item.pnl !== 0 && (
            <Text
              variant="bodySmall"
              style={{
                fontWeight: '600',
                color: item.pnl >= 0 ? colors.status.success : colors.status.error,
              }}
            >
              {item.pnl >= 0 ? '+' : ''}{item.pnl.toFixed(4)}
            </Text>
          )}
          <Text variant="caption" color="muted">{item.time}</Text>
        </View>
      </View>

      {/* Agent Name */}
      {item.agentName && (
        <Text variant="caption" color="muted" style={{ marginTop: 6 }}>
          by {item.agentName}
        </Text>
      )}
    </Card>
  );
}
