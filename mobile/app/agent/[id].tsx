import { View, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card } from '@/components/ui';
import { FeedTradeCard } from '@/components/feed/FeedTradeCard';
import { PnLChart } from '@/components/home/PnLChart';
import { TaskCard } from '@/components/arena/TaskCard';
import { ConversationCard } from '@/components/arena/ConversationCard';
import { useAgent } from '@/hooks/useAgent';
import { colors } from '@/theme/colors';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { getAgentTrades, getAgentPositions, getAgentTaskCompletions, getAgentConversations } from '@/lib/api/client';
import type { Trade, Position, AgentTaskType, Conversation } from '@/types/arena';
import type { PnLDataPoint, Timeframe } from '@/hooks/usePnLHistory';

type DetailTab = 'positions' | 'trades' | 'tasks' | 'conversations';

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
      <Text variant="caption" color="muted">{label}</Text>
      <Text
        variant="body"
        style={{ fontWeight: '700', color: color || colors.text.primary, marginTop: 4 }}
      >
        {value}
      </Text>
    </View>
  );
}

function buildPnLFromTrades(trades: Trade[]): PnLDataPoint[] {
  if (trades.length === 0) {
    const now = Date.now();
    return [
      { timestamp: now - 86400000, value: 0 },
      { timestamp: now, value: 0 },
    ];
  }

  const sorted = [...trades].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  let cumulative = 0;
  const points: PnLDataPoint[] = [];

  for (const trade of sorted) {
    cumulative += trade.pnl;
    points.push({
      timestamp: new Date(trade.timestamp).getTime(),
      value: cumulative,
    });
  }

  points.push({ timestamp: Date.now(), value: cumulative });
  return points;
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: active ? colors.brand.primary + '22' : 'rgba(255, 255, 255, 0.04)',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        borderWidth: active ? 1 : 0,
        borderColor: colors.brand.primary,
      }}
    >
      <Text
        variant="caption"
        color={active ? 'brand' : 'muted'}
        style={{ fontWeight: '600' }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { agent, isLoading, error, refresh } = useAgent(id);
  const [activeTab, setActiveTab] = useState<DetailTab>('positions');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tasks, setTasks] = useState<AgentTaskType[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pnlTimeframe, setPnlTimeframe] = useState<Timeframe>('7D');

  const fetchTabData = useCallback(async () => {
    if (!id) return;
    setDataLoading(true);
    try {
      const [t, p, tk, c] = await Promise.all([
        getAgentTrades(id),
        getAgentPositions(id),
        getAgentTaskCompletions(id).catch(() => [] as AgentTaskType[]),
        getAgentConversations(id).catch(() => [] as Conversation[]),
      ]);
      setTrades(t);
      setPositions(p);
      setTasks(tk);
      setConversations(c);
    } catch (err) {
      console.error('[AgentDetail] Data fetch failed:', err);
    } finally {
      setDataLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), fetchTabData()]);
    setRefreshing(false);
  }, [refresh, fetchTabData]);

  // Build PnL chart data from trades
  const pnlData = useMemo(() => buildPnLFromTrades(trades), [trades]);
  const currentPnL = pnlData[pnlData.length - 1]?.value ?? 0;
  const pnlChange = currentPnL - (pnlData[0]?.value ?? 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* Back Button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h3" color="primary" style={{ flex: 1 }}>
          {agent?.agentName || 'Agent'}
        </Text>
      </View>

      {isLoading && !agent ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text variant="body" color="error">{error}</Text>
        </View>
      ) : agent ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.primary}
            />
          }
        >
          {/* Agent Header */}
          <Card variant="default" padding="md">
            <Text variant="h2" color="primary">{agent.agentName}</Text>
            {agent.twitterHandle && (
              <Text variant="bodySmall" color="brand" style={{ marginTop: 4 }}>
                @{agent.twitterHandle}
              </Text>
            )}
            <Text variant="caption" color="muted" style={{ marginTop: 4 }}>
              {agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}
            </Text>
          </Card>

          {/* Stats Grid */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatBox label="Sortino" value={agent.sortino_ratio.toFixed(2)} />
            <StatBox label="Win Rate" value={`${(agent.win_rate * 100).toFixed(0)}%`} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatBox
              label="Total PnL"
              value={`${agent.total_pnl >= 0 ? '+' : ''}${agent.total_pnl.toFixed(2)}%`}
              color={agent.total_pnl >= 0 ? colors.status.success : colors.status.error}
            />
            <StatBox label="Trades" value={String(agent.trade_count)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatBox
              label="Avg Win"
              value={`+${agent.average_win.toFixed(2)}%`}
              color={colors.status.success}
            />
            <StatBox
              label="Avg Loss"
              value={`${agent.average_loss.toFixed(2)}%`}
              color={colors.status.error}
            />
          </View>

          {/* PnL Chart */}
          <PnLChart
            data={pnlData}
            timeframe={pnlTimeframe}
            onTimeframeChange={setPnlTimeframe}
            currentValue={currentPnL}
            pnlChange={pnlChange}
          />

          {/* Tab Toggle */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TabButton
              label={`Positions (${positions.length})`}
              active={activeTab === 'positions'}
              onPress={() => setActiveTab('positions')}
            />
            <TabButton
              label={`Trades (${trades.length})`}
              active={activeTab === 'trades'}
              onPress={() => setActiveTab('trades')}
            />
            <TabButton
              label={`Tasks (${tasks.length})`}
              active={activeTab === 'tasks'}
              onPress={() => setActiveTab('tasks')}
            />
            <TabButton
              label={`Chat (${conversations.length})`}
              active={activeTab === 'conversations'}
              onPress={() => setActiveTab('conversations')}
            />
          </View>

          {/* Tab Content */}
          {dataLoading ? (
            <ActivityIndicator size="small" color={colors.brand.primary} style={{ padding: 16 }} />
          ) : activeTab === 'positions' ? (
            positions.length > 0 ? (
              positions.map((pos) => (
                <Card key={pos.positionId} variant="default" padding="md">
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
                      {pos.tokenSymbol}
                    </Text>
                    <Text
                      variant="body"
                      style={{
                        fontWeight: '600',
                        color: pos.pnlPercent >= 0 ? colors.status.success : colors.status.error,
                      }}
                    >
                      {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text variant="caption" color="muted">
                      Qty: {pos.quantity.toFixed(2)}
                    </Text>
                    <Text variant="caption" color="muted">
                      Value: ${pos.currentValue.toFixed(2)}
                    </Text>
                  </View>
                </Card>
              ))
            ) : (
              <Text variant="body" color="muted" style={{ textAlign: 'center', padding: 16 }}>
                No open positions
              </Text>
            )
          ) : activeTab === 'trades' ? (
            trades.length > 0 ? (
              trades.map((trade) => (
                <FeedTradeCard
                  key={trade.tradeId}
                  item={{
                    id: trade.tradeId,
                    type: 'trade',
                    title: `${trade.action} ${trade.tokenSymbol}`,
                    description: `${trade.quantity.toFixed(0)} tokens`,
                    time: new Date(trade.timestamp).toLocaleTimeString(),
                    timestamp: new Date(trade.timestamp).getTime(),
                    pnl: trade.pnl,
                  }}
                />
              ))
            ) : (
              <Text variant="body" color="muted" style={{ textAlign: 'center', padding: 16 }}>
                No trades yet
              </Text>
            )
          ) : activeTab === 'tasks' ? (
            tasks.length > 0 ? (
              <View style={{ gap: 10 }}>
                {tasks.map((task) => (
                  <TaskCard key={task.taskId} task={task} style={{ width: '100%' }} />
                ))}
              </View>
            ) : (
              <Text variant="body" color="muted" style={{ textAlign: 'center', padding: 16 }}>
                No task completions
              </Text>
            )
          ) : activeTab === 'conversations' ? (
            conversations.length > 0 ? (
              <View style={{ gap: 10 }}>
                {conversations.map((c) => (
                  <ConversationCard key={c.conversationId} conversation={c} />
                ))}
              </View>
            ) : (
              <Text variant="body" color="muted" style={{ textAlign: 'center', padding: 16 }}>
                No conversations
              </Text>
            )
          ) : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}
