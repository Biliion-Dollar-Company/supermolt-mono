import { FlatList, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, CardSkeleton } from '@/components/ui';
import { FeedTradeCard } from '@/components/feed/FeedTradeCard';
import { useTradeFeed } from '@/hooks/useTradeFeed';
import { colors } from '@/theme/colors';
import { useState, useCallback } from 'react';

export default function FeedTab() {
  const { items, isLoading, error, refresh } = useTradeFeed();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.surface.primary }}
      edges={['top']}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text variant="h2" color="primary">
          Trade Feed
        </Text>
      </View>

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
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.primary}
            />
          }
          renderItem={({ item }) => <FeedTradeCard item={item} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <Text variant="body" color="muted">No trades yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
