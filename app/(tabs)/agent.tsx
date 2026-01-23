import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAgent } from '@/hooks/useAgent';

export default function AgentScreen() {
  const { status, stats, decisions, toggleAgent, isLoading } = useAgent();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="pb-6">
        {/* Header */}
        <View className="px-4 pt-4">
          <Text className="text-foreground text-2xl font-bold">AI Agent</Text>
          <Text className="text-foreground-secondary mt-1">
            SuperRouter Trading Bot
          </Text>
        </View>

        {/* Status Card */}
        <View className="mx-4 mt-6 bg-card rounded-xl p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                className={`w-3 h-3 rounded-full ${
                  status === 'active' ? 'bg-success' : 'bg-foreground-muted'
                }`}
              />
              <Text className="text-foreground font-semibold">
                {status === 'active' ? 'Active' : 'Paused'}
              </Text>
            </View>
            <Pressable
              onPress={toggleAgent}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg ${
                status === 'active' ? 'bg-error/20' : 'bg-success/20'
              }`}
            >
              <Text
                className={`font-medium ${
                  status === 'active' ? 'text-error' : 'text-success'
                }`}
              >
                {status === 'active' ? 'Pause' : 'Start'}
              </Text>
            </Pressable>
          </View>

          <Text className="text-foreground-muted text-sm mt-2">
            Monitoring 234 tokens on Pump.fun
          </Text>
        </View>

        {/* Stats Grid */}
        <View className="mx-4 mt-4 flex-row gap-3">
          <View className="flex-1 bg-card rounded-xl p-4">
            <Text className="text-foreground-muted text-sm">Today's Trades</Text>
            <Text className="text-foreground text-2xl font-bold mt-1">
              {stats.todayTrades}
            </Text>
          </View>
          <View className="flex-1 bg-card rounded-xl p-4">
            <Text className="text-foreground-muted text-sm">Win Rate</Text>
            <Text className="text-success text-2xl font-bold mt-1">
              {stats.winRate}%
            </Text>
          </View>
        </View>

        <View className="mx-4 mt-3 flex-row gap-3">
          <View className="flex-1 bg-card rounded-xl p-4">
            <Text className="text-foreground-muted text-sm">Today's P&L</Text>
            <Text
              className={`text-2xl font-bold mt-1 ${
                stats.todayPnl >= 0 ? 'text-success' : 'text-error'
              }`}
            >
              {stats.todayPnl >= 0 ? '+' : ''}
              {stats.todayPnl.toFixed(2)} SOL
            </Text>
          </View>
          <View className="flex-1 bg-card rounded-xl p-4">
            <Text className="text-foreground-muted text-sm">Avg Hold Time</Text>
            <Text className="text-foreground text-2xl font-bold mt-1">
              {stats.avgHoldTime}
            </Text>
          </View>
        </View>

        {/* Recent Decisions */}
        <View className="mx-4 mt-6">
          <Text className="text-foreground font-semibold mb-3">
            Recent Decisions
          </Text>

          <View className="gap-3">
            {decisions.map((decision, index) => (
              <View key={index} className="bg-card rounded-xl p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name={
                        decision.action === 'buy'
                          ? 'arrow-down-circle'
                          : decision.action === 'sell'
                          ? 'arrow-up-circle'
                          : 'close-circle'
                      }
                      size={20}
                      color={
                        decision.action === 'buy'
                          ? '#22C55E'
                          : decision.action === 'sell'
                          ? '#EF4444'
                          : '#71717a'
                      }
                    />
                    <Text className="text-foreground font-medium">
                      {decision.action === 'buy'
                        ? 'Bought'
                        : decision.action === 'sell'
                        ? 'Sold'
                        : 'Skipped'}{' '}
                      {decision.token}
                    </Text>
                  </View>
                  <Text className="text-foreground-muted text-sm">
                    {decision.time}
                  </Text>
                </View>
                <Text className="text-foreground-secondary text-sm mt-2">
                  "{decision.reason}"
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
