import {
  View,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
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
import {
  getAgentTrades,
  getAgentPositions,
  getAgentTaskCompletions,
  getAgentConversations,
  getAgentPredictionProfile,
  AgentPrediction,
} from '@/lib/api/client';
import type { Trade, Position, AgentTaskType, Conversation } from '@/types/arena';
import type { PnLDataPoint, Timeframe } from '@/hooks/usePnLHistory';

const ORANGE = '#F97316';
const YES_C = '#4ade80';
const NO_C = '#f87171';

type DetailTab = 'positions' | 'trades' | 'predictions' | 'tasks' | 'conversations';

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
    points.push({ timestamp: new Date(trade.timestamp).getTime(), value: cumulative });
  }
  points.push({ timestamp: Date.now(), value: cumulative });
  return points;
}

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statChip}>
      <Text variant="caption" style={[styles.statChipValue, color ? { color } : {}]}>
        {value}
      </Text>
      <Text variant="caption" style={styles.statChipLabel}>
        {label}
      </Text>
    </View>
  );
}

function SideBadge({ side }: { side: 'YES' | 'NO' }) {
  const isYes = side === 'YES';
  return (
    <View
      style={[
        styles.sideBadge,
        {
          backgroundColor: isYes ? `${YES_C}22` : `${NO_C}22`,
          borderColor: isYes ? `${YES_C}55` : `${NO_C}55`,
        },
      ]}
    >
      <Text
        variant="caption"
        style={[styles.sideBadgeText, { color: isYes ? YES_C : NO_C }]}
      >
        {side}
      </Text>
    </View>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const isWin = outcome === 'WIN';
  const isLoss = outcome === 'LOSS';
  return (
    <View
      style={[
        styles.outcomeBadge,
        {
          backgroundColor: isWin
            ? `${YES_C}22`
            : isLoss
            ? `${NO_C}22`
            : 'rgba(255,255,255,0.06)',
          borderColor: isWin
            ? `${YES_C}55`
            : isLoss
            ? `${NO_C}55`
            : 'rgba(255,255,255,0.15)',
        },
      ]}
    >
      <Text
        variant="caption"
        style={[
          styles.outcomeBadgeText,
          {
            color: isWin ? YES_C : isLoss ? NO_C : 'rgba(255,255,255,0.4)',
          },
        ]}
      >
        {outcome}
      </Text>
    </View>
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
  const [predictionProfile, setPredictionProfile] = useState<{
    stats: {
      totalPredictions: number;
      correctPredictions: number;
      accuracy: number;
      brierScore: number;
      roi: number;
      streak: number;
      bestStreak: number;
    } | null;
    recentPredictions: AgentPrediction[];
  } | null>(null);
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

      // Fetch prediction profile in parallel (non-blocking)
      getAgentPredictionProfile(id)
        .then((profile) => {
          if (profile) setPredictionProfile(profile);
        })
        .catch(() => {});
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

  const pnlData = useMemo(() => buildPnLFromTrades(trades), [trades]);
  const currentPnL = pnlData[pnlData.length - 1]?.value ?? 0;
  const pnlChange = currentPnL - (pnlData[0]?.value ?? 0);

  const winCount = trades.filter((t) => t.pnl > 0).length;
  const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;

  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: 'positions', label: 'Positions', count: positions.length },
    { id: 'trades', label: 'Trades', count: trades.length },
    { id: 'predictions', label: 'Predictions', count: predictionProfile?.stats?.totalPredictions },
    { id: 'tasks', label: 'Tasks', count: tasks.length },
    { id: 'conversations', label: 'Chat', count: conversations.length },
  ];

  const predStats = predictionProfile?.stats;
  const recentPredictions = predictionProfile?.recentPredictions ?? [];

  const avatarLetter = agent?.agentName?.charAt(0)?.toUpperCase() || 'A';
  const shortWallet = agent
    ? `${agent.walletAddress.slice(0, 6)}...${agent.walletAddress.slice(-4)}`
    : '';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h3" color="primary" style={styles.headerTitle} numberOfLines={1}>
          {agent?.agentName || 'Agent'}
        </Text>
      </View>

      {isLoading && !agent ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text variant="body" color="error">
            {error}
          </Text>
        </View>
      ) : agent ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />
          }
        >
          {/* Hero section */}
          <View style={styles.hero}>
            {/* Avatar */}
            <View style={styles.avatar}>
              <Text variant="h2" style={styles.avatarLetter}>
                {avatarLetter}
              </Text>
            </View>

            {/* Info block */}
            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text variant="h3" color="primary" style={styles.heroName} numberOfLines={1}>
                  {agent.agentName}
                </Text>
              </View>
              <Text variant="caption" style={styles.heroWallet} numberOfLines={1}>
                {shortWallet}
              </Text>
              {(agent as any).twitterHandle && (
                <Text variant="caption" style={styles.heroTwitter}>
                  @{(agent as any).twitterHandle}
                </Text>
              )}
            </View>
          </View>

          {/* Stat row */}
          <View style={styles.statRow}>
            <StatChip
              label="Win Rate"
              value={`${winRate.toFixed(0)}%`}
              color={winRate >= 50 ? YES_C : NO_C}
            />
            <StatChip
              label="Sortino"
              value={agent.sortino_ratio?.toFixed(2) || '--'}
              color={ORANGE}
            />
            <StatChip label="Trades" value={String(agent.trade_count || 0)} />
            <StatChip
              label="P&L"
              value={`${agent.total_pnl >= 0 ? '+' : ''}${agent.total_pnl.toFixed(2)}%`}
              color={agent.total_pnl >= 0 ? YES_C : NO_C}
            />
          </View>

          {/* P&L Chart */}
          <PnLChart
            data={pnlData}
            timeframe={pnlTimeframe}
            onTimeframeChange={setPnlTimeframe}
            currentValue={currentPnL}
            pnlChange={pnlChange}
          />

          {/* Tab bar — horizontal scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBar}
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    styles.tabBtn,
                    active && {
                      borderBottomColor: ORANGE,
                      borderBottomWidth: 2,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={[
                      styles.tabBtnText,
                      { color: active ? ORANGE : 'rgba(255,255,255,0.35)' },
                    ]}
                  >
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 ? ` (${tab.count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Tab content */}
          {dataLoading ? (
            <ActivityIndicator
              size="small"
              color={ORANGE}
              style={{ paddingVertical: 24 }}
            />
          ) : (
            <View style={styles.tabContent}>
              {/* ── POSITIONS ── */}
              {activeTab === 'positions' &&
                (positions.length > 0 ? (
                  positions.map((pos) => (
                    <Card key={pos.positionId} variant="default" padding="md">
                      <View style={styles.positionRow}>
                        <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
                          {pos.tokenSymbol}
                        </Text>
                        <Text
                          variant="body"
                          style={{
                            fontWeight: '600',
                            color:
                              pos.pnlPercent >= 0 ? colors.status.success : colors.status.error,
                          }}
                        >
                          {pos.pnlPercent >= 0 ? '+' : ''}
                          {pos.pnlPercent.toFixed(1)}%
                        </Text>
                      </View>
                      <View style={styles.positionRow}>
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
                  <Text variant="body" color="muted" style={styles.emptyText}>
                    No open positions
                  </Text>
                ))}

              {/* ── TRADES ── */}
              {activeTab === 'trades' &&
                (trades.length > 0 ? (
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
                  <Text variant="body" color="muted" style={styles.emptyText}>
                    No trades yet
                  </Text>
                ))}

              {/* ── PREDICTIONS ── */}
              {activeTab === 'predictions' && (
                <View>
                  {/* Stats banner */}
                  {predStats ? (
                    <View style={styles.predStatsBanner}>
                      <View style={styles.predStatItem}>
                        <Text variant="h3" style={[styles.predStatValue, { color: ORANGE }]}>
                          {predStats.totalPredictions}
                        </Text>
                        <Text variant="caption" style={styles.predStatLabel}>
                          Total
                        </Text>
                      </View>
                      <View style={styles.predStatDivider} />
                      <View style={styles.predStatItem}>
                        <Text
                          variant="h3"
                          style={[
                            styles.predStatValue,
                            { color: predStats.accuracy >= 0.5 ? YES_C : NO_C },
                          ]}
                        >
                          {(predStats.accuracy * 100).toFixed(1)}%
                        </Text>
                        <Text variant="caption" style={styles.predStatLabel}>
                          Accuracy
                        </Text>
                      </View>
                      <View style={styles.predStatDivider} />
                      <View style={styles.predStatItem}>
                        <Text
                          variant="h3"
                          style={[
                            styles.predStatValue,
                            { color: predStats.roi >= 0 ? YES_C : NO_C },
                          ]}
                        >
                          {predStats.roi >= 0 ? '+' : ''}
                          {predStats.roi.toFixed(1)}%
                        </Text>
                        <Text variant="caption" style={styles.predStatLabel}>
                          ROI
                        </Text>
                      </View>
                      <View style={styles.predStatDivider} />
                      <View style={styles.predStatItem}>
                        <Text
                          variant="h3"
                          style={[
                            styles.predStatValue,
                            { color: predStats.streak > 0 ? YES_C : 'rgba(255,255,255,0.5)' },
                          ]}
                        >
                          {predStats.streak}
                        </Text>
                        <Text variant="caption" style={styles.predStatLabel}>
                          Streak
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text variant="body" color="muted" style={styles.emptyText}>
                      No prediction stats
                    </Text>
                  )}

                  {/* Predictions list */}
                  {recentPredictions.length > 0 ? (
                    recentPredictions.map((pred) => (
                      <View key={pred.id} style={styles.predRow}>
                        {/* Left: side badge + info */}
                        <View style={styles.predLeft}>
                          <SideBadge side={pred.side} />
                          <View style={styles.predInfo}>
                            <Text
                              variant="bodySmall"
                              color="primary"
                              style={{ fontWeight: '600' }}
                              numberOfLines={2}
                            >
                              {pred.marketTitle}
                            </Text>
                            <Text variant="caption" style={styles.predMeta}>
                              {pred.ticker} · avg {pred.avgPrice.toFixed(3)}
                            </Text>
                          </View>
                        </View>

                        {/* Right: pnl + outcome */}
                        <View style={styles.predRight}>
                          {pred.pnl !== null && (
                            <Text
                              variant="bodySmall"
                              style={[
                                styles.predPnl,
                                { color: pred.pnl >= 0 ? YES_C : NO_C },
                              ]}
                            >
                              {pred.pnl >= 0 ? '+' : ''}
                              {pred.pnl.toFixed(2)}
                            </Text>
                          )}
                          <OutcomeBadge outcome={pred.outcome} />
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text variant="body" color="muted" style={styles.emptyText}>
                      No predictions yet
                    </Text>
                  )}
                </View>
              )}

              {/* ── TASKS ── */}
              {activeTab === 'tasks' &&
                (tasks.length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {tasks.map((task) => (
                      <TaskCard key={task.taskId} task={task} style={{ width: '100%' }} />
                    ))}
                  </View>
                ) : (
                  <Text variant="body" color="muted" style={styles.emptyText}>
                    No task completions
                  </Text>
                ))}

              {/* ── CONVERSATIONS ── */}
              {activeTab === 'conversations' &&
                (conversations.length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {conversations.map((c) => (
                      <ConversationCard key={c.conversationId} conversation={c} />
                    ))}
                  </View>
                ) : (
                  <Text variant="body" color="muted" style={styles.emptyText}>
                    No conversations
                  </Text>
                ))}
            </View>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 40,
    gap: 0,
  },
  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarLetter: {
    color: '#000',
    fontWeight: '900',
    fontSize: 24,
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroName: {
    fontWeight: '700',
    flex: 1,
  },
  heroWallet: {
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'monospace',
    marginTop: 2,
    fontSize: 11,
  },
  heroTwitter: {
    color: ORANGE,
    marginTop: 2,
    fontSize: 12,
  },
  // Stat row
  statRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statChipValue: {
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  statChipLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  // Tab content
  tabContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
  },
  // Positions
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  // Predictions
  predStatsBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 12,
    overflow: 'hidden',
  },
  predStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  predStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 10,
  },
  predStatValue: {
    fontWeight: '700',
    fontFamily: 'monospace',
    fontSize: 18,
  },
  predStatLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  predRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
    gap: 10,
  },
  predLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  sideBadge: {
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  sideBadgeText: {
    fontWeight: '700',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  predInfo: {
    flex: 1,
    minWidth: 0,
  },
  predMeta: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  predRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  predPnl: {
    fontWeight: '700',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  outcomeBadge: {
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outcomeBadgeText: {
    fontWeight: '700',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
