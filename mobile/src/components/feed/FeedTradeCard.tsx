/**
 * ActivityCard - Unified feed item card
 * Renders trades, conversations, tasks, and votes with type-specific styling
 */

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import type { FeedItem, ActivityType } from '@/hooks/useTradeFeed';

const TYPE_CONFIG: Record<ActivityType, { label: string; color: string; prefix: string }> = {
  trade: { label: 'TRADE', color: '#22c55e', prefix: '' },
  conversation: { label: 'CHAT', color: '#22d3ee', prefix: '' },
  task: { label: 'TASK', color: colors.brand.primary, prefix: '' },
  vote: { label: 'VOTE', color: '#a78bfa', prefix: '' },
};

interface FeedTradeCardProps {
  item: FeedItem;
}

export function FeedTradeCard({ item }: FeedTradeCardProps) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.trade;

  // Trade-specific: red for sells
  const accentColor =
    item.type === 'trade' && item.action === 'SELL'
      ? colors.status.error
      : config.color;

  const showPnl = item.type === 'trade' && item.pnl != null && item.pnl !== 0;

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <View style={styles.topRow}>
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: `${accentColor}18` }]}>
          <Text style={[styles.typeLabel, { color: accentColor }]}>{config.label}</Text>
        </View>

        {/* Token symbol */}
        {item.tokenSymbol && (
          <Text style={styles.tokenSymbol}>${item.tokenSymbol}</Text>
        )}

        {/* Time */}
        <Text style={styles.time}>{item.time}</Text>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={1}>{item.title}</Text>

      {/* Description + PnL row */}
      <View style={styles.bottomRow}>
        <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
        {showPnl && (
          <Text style={[
            styles.pnl,
            { color: item.pnl! >= 0 ? colors.status.success : colors.status.error },
          ]}>
            {item.pnl! >= 0 ? '+' : ''}{formatPnl(item.pnl!)}
          </Text>
        )}
      </View>
    </View>
  );
}

function formatPnl(v: number): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  return abs < 0.1 ? v.toFixed(2) : v.toFixed(1);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tokenSymbol: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  time: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 'auto',
  },
  title: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  description: {
    color: colors.text.muted,
    fontSize: 12,
    flex: 1,
  },
  pnl: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
  },
});
