import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTradeFeed } from '@/hooks/useTradeFeed';

interface FeedItem {
  id: string;
  type: 'trade' | 'tp_hit' | 'sl_hit' | 'alert';
  title: string;
  description: string;
  time: string;
  pnl?: number;
}

export default function FeedScreen() {
  const { items, isLoading } = useTradeFeed();

  const getIcon = (type: FeedItem['type']) => {
    switch (type) {
      case 'trade':
        return { name: 'swap-horizontal' as const, color: '#8B5CF6' };
      case 'tp_hit':
        return { name: 'checkmark-circle' as const, color: '#22C55E' };
      case 'sl_hit':
        return { name: 'alert-circle' as const, color: '#EF4444' };
      case 'alert':
        return { name: 'notifications' as const, color: '#F59E0B' };
    }
  };

  const renderItem = ({ item }: { item: FeedItem }) => {
    const icon = getIcon(item.type);

    return (
      <View className="mx-4 mb-3 bg-card rounded-xl p-4">
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 rounded-full bg-background items-center justify-center">
            <Ionicons name={icon.name} size={20} color={icon.color} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground font-medium">{item.title}</Text>
              <Text className="text-foreground-muted text-sm">{item.time}</Text>
            </View>
            <Text className="text-foreground-secondary text-sm mt-1">
              {item.description}
            </Text>
            {item.pnl !== undefined && (
              <Text
                className={`text-sm font-medium mt-2 ${
                  item.pnl >= 0 ? 'text-success' : 'text-error'
                }`}
              >
                {item.pnl >= 0 ? '+' : ''}
                {item.pnl.toFixed(4)} SOL
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-foreground text-2xl font-bold">Activity Feed</Text>
        <Text className="text-foreground-secondary mt-1">
          Real-time trading updates
        </Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="mx-4 bg-card rounded-xl p-6 items-center">
            <Ionicons name="pulse-outline" size={48} color="#71717a" />
            <Text className="text-foreground-muted text-center mt-4">
              No activity yet.{'\n'}
              Trade updates will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
