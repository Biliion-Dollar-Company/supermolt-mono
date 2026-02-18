import { FlatList, View, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, CardSkeleton } from '@/components/ui';
import { FeedTradeCard } from '@/components/feed/FeedTradeCard';
import { HotTokensBar } from '@/components/feed/HotTokensBar';
import { useTradeFeed } from '@/hooks/useTradeFeed';
import { useActiveTokens } from '@/hooks/useActiveTokens';
import type { ActivityType } from '@/hooks/useTradeFeed';
import { colors } from '@/theme/colors';
import { useState, useCallback, useMemo } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';

type FilterType = 'all' | ActivityType;

const FILTERS: { key: FilterType; label: string; color: string }[] = [
  { key: 'all', label: 'ALL', color: colors.text.primary },
  { key: 'trade', label: 'TRADES', color: '#22c55e' },
  { key: 'conversation', label: 'CHATS', color: '#22d3ee' },
  { key: 'task', label: 'TASKS', color: colors.brand.primary },
  { key: 'vote', label: 'VOTES', color: '#a78bfa' },
];

export default function FeedTab() {
  const { items, isLoading, error, refresh } = useTradeFeed();
  const { tokens: hotTokens, refresh: refreshTokens } = useActiveTokens();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedTokenMint, setSelectedTokenMint] = useState<string | null>(null);

  // Get the symbol for the selected token (for matching feed items)
  const selectedTokenSymbol = useMemo(() => {
    if (!selectedTokenMint) return null;
    return hotTokens.find((t) => t.tokenMint === selectedTokenMint)?.tokenSymbol ?? null;
  }, [selectedTokenMint, hotTokens]);

  const filteredItems = useMemo(() => {
    let result = items;

    // Filter by token if one is selected
    if (selectedTokenSymbol) {
      result = result.filter((i) => i.tokenSymbol === selectedTokenSymbol);
    }

    // Filter by activity type
    if (activeFilter !== 'all') {
      result = result.filter((i) => i.type === activeFilter);
    }

    return result;
  }, [items, activeFilter, selectedTokenSymbol]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshTokens()]);
    setRefreshing(false);
  }, [refresh, refreshTokens]);

  const counts = useMemo(() => {
    // Count from the token-filtered set (before type filter)
    const base = selectedTokenSymbol
      ? items.filter((i) => i.tokenSymbol === selectedTokenSymbol)
      : items;
    const c: Record<string, number> = { all: base.length };
    for (const item of base) {
      c[item.type] = (c[item.type] || 0) + 1;
    }
    return c;
  }, [items, selectedTokenSymbol]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.void[900] }}
      edges={['top']}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text variant="h2" color="primary" style={{ fontWeight: '800', letterSpacing: -0.5 }}>
            Activity
          </Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            const count = counts[f.key] || 0;
            return (
              <Pressable
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: `${f.color}18`, borderColor: `${f.color}30` },
                ]}
              >
                <Text style={[
                  styles.filterLabel,
                  { color: isActive ? f.color : colors.text.muted },
                ]}>
                  {f.label}
                </Text>
                {count > 0 && (
                  <Text style={[
                    styles.filterCount,
                    { color: isActive ? f.color : colors.text.muted },
                  ]}>
                    {count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Hot Tokens Bar */}
      {hotTokens.length > 0 && (
        <View style={styles.hotTokensSection}>
          <HotTokensBar
            tokens={hotTokens}
            selectedMint={selectedTokenMint}
            onSelect={setSelectedTokenMint}
          />
        </View>
      )}

      {isLoading && items.length === 0 ? (
        <View style={{ padding: 16, gap: 8 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text variant="body" color="error">{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 6 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.primary}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeIn.delay(Math.min(index * 30, 300)).duration(200)}>
              <FeedTradeCard item={item} />
            </Animated.View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <Text variant="body" color="muted">
                {selectedTokenSymbol
                  ? `No ${activeFilter === 'all' ? 'activity' : `${activeFilter}s`} for $${selectedTokenSymbol}`
                  : activeFilter === 'all' ? 'No activity yet' : `No ${activeFilter}s yet`}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hotTokensSection: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.status.success,
  },
  liveText: {
    color: colors.status.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filterCount: {
    fontSize: 9,
    fontWeight: '600',
    opacity: 0.7,
  },
});
