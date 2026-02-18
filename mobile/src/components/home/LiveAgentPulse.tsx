/**
 * LiveAgentPulse — Real-time arena activity feed
 * Card-style items with icons, XP badges, and type-specific styling
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { useTradeFeed } from '@/hooks/useTradeFeed';
import type { FeedItem, ActivityType } from '@/hooks/useTradeFeed';

const ICON_COLOR = 'rgba(255, 255, 255, 0.55)';

const TYPE_CONFIG: Record<ActivityType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  trade: { icon: 'swap-horizontal', color: ICON_COLOR },
  conversation: { icon: 'chatbubble-outline', color: ICON_COLOR },
  task: { icon: 'radio-button-off', color: ICON_COLOR },
  vote: { icon: 'hand-left-outline', color: ICON_COLOR },
};

function PulseCard({ item, index, isLast }: { item: FeedItem; index: number; isLast?: boolean }) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.trade;
  const iconColor = config.color;
  const xp = item.meta?.xp as number | undefined;
  const isCompleted = item.meta?.completions && (item.meta.completions as number) > 0;
  const taskIcon = isCompleted ? 'checkmark-circle' : config.icon;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(200).springify()}
      style={[styles.card, isLast && { borderBottomWidth: 0 }]}
    >
      {/* Icon */}
      <Ionicons
        name={item.type === 'task' ? taskIcon : config.icon}
        size={18}
        color={iconColor}
      />

      {/* Content */}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
      </View>

      {/* Right side: XP badge or time */}
      <View style={styles.cardRight}>
        {xp ? (
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>+{xp}xp</Text>
          </View>
        ) : (
          item.tokenSymbol ? (
            <Text style={styles.tokenText}>${item.tokenSymbol}</Text>
          ) : null
        )}
        <Text style={styles.timeText}>{item.time}</Text>
      </View>
    </Animated.View>
  );
}

export function LiveAgentPulse() {
  const { items } = useTradeFeed();
  const router = useRouter();
  const recent = items.slice(0, 6);

  if (recent.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.headerLabel}>MISSIONS</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{items.length}</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/feed')}>
          <Text style={styles.viewAll}>VIEW ALL</Text>
        </Pressable>
      </View>

      {/* Cards */}
      <View style={styles.cards}>
        {recent.map((item, i) => (
          <PulseCard key={item.id} item={item} index={i} isLast={i === recent.length - 1} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Glass container
  container: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    // Top highlight line for glass effect
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success,
  },
  headerLabel: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  countBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  countText: {
    color: colors.brand.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  viewAll: {
    color: colors.brand.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Cards — transparent, separated by subtle dividers
  cards: {
    gap: 0,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  cardDesc: {
    color: colors.text.muted,
    fontSize: 11,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  xpBadge: {
    backgroundColor: 'transparent',
  },
  xpText: {
    color: colors.brand.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  tokenText: {
    color: colors.brand.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 9,
    fontWeight: '600',
  },
});
