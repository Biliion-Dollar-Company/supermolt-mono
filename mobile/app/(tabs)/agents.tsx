import { View, Image, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, FlatList, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, CardSkeleton } from '@/components/ui';
import { FeedTradeCard } from '@/components/feed/FeedTradeCard';
import { colors } from '@/theme/colors';
import { useMyAgents } from '@/hooks/useMyAgents';
import { useAuthContext } from '@/lib/auth/provider';
import { useTradeFeed, type ActivityType, type FeedItem } from '@/hooks/useTradeFeed';
import { getArchetype } from '@/lib/archetypes';
import { deleteAgentById } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { useAgentLiveStore } from '@/store/agentLive';
import { mediumImpact, errorNotification, selectionFeedback } from '@/lib/haptics';
import { useState, useCallback, useMemo } from 'react';
import { useTourTarget } from '@/hooks/useTourTarget';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { UserAgent } from '@/types/arena';

const DEFAULT_PFPS = [
  require('../../assets/images/pfp.png'),
  require('../../assets/images/pfp-supermolt.png'),
];

function getDefaultPfp(index: number) {
  return DEFAULT_PFPS[index % DEFAULT_PFPS.length];
}

// Agent status phrases — gives personality when no real reasoning exists
const IDLE_PHRASES = [
  'Scanning for alpha...',
  'Monitoring markets...',
  'Analyzing liquidity pools...',
  'Watching whale wallets...',
  'Evaluating entry points...',
  'Tracking momentum signals...',
];

function getAgentPhrase(agentId: string): string {
  // Deterministic but varied per agent
  const idx = agentId.charCodeAt(0) % IDLE_PHRASES.length;
  return IDLE_PHRASES[idx];
}

// ── Agent Card ──────────────────────────────────────────────

function AgentRow({
  agent,
  index,
  onDelete,
  onConfigure,
  lastReasoning,
}: {
  agent: UserAgent;
  index: number;
  onDelete: () => void;
  onConfigure: () => void;
  lastReasoning?: string;
}) {
  const archetype = getArchetype(agent.archetypeId);
  const pfpSource = agent.avatarUrl ? { uri: agent.avatarUrl } : getDefaultPfp(index);
  const pnl = Number(agent.totalPnl);
  const pnlDisplay = pnl === 0 ? '$0' : `$${Math.abs(pnl).toFixed(2)}`;
  const pnlPrefix = pnl >= 0 ? '+' : '-';
  const statusLine = lastReasoning || getAgentPhrase(agent.id);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onConfigure}
      onLongPress={onDelete}
      style={cardStyles.container}
    >
      {/* Row 1: Identity */}
      <View style={cardStyles.topRow}>
        <Image source={pfpSource} style={cardStyles.pfp} />
        <View style={{ flex: 1 }}>
          <View style={cardStyles.nameRow}>
            <Text variant="body" color="primary" style={{ fontWeight: '700' }} numberOfLines={1}>
              {agent.displayName || agent.name}
            </Text>
            {agent.twitterHandle && (
              <Ionicons name="logo-twitter" size={12} color="#1DA1F2" />
            )}
          </View>
          <Text variant="caption" color="muted" style={{ fontSize: 10 }}>
            {archetype?.name || agent.archetypeId} · Lv.{agent.level}
          </Text>
        </View>

        {/* Inline stats */}
        <View style={cardStyles.inlineStats}>
          <Text style={[cardStyles.statValue, { color: pnl >= 0 ? colors.status.success : colors.status.error }]}>
            {pnlPrefix}{pnlDisplay}
          </Text>
          <Text style={cardStyles.statMeta}>
            {agent.totalTrades}T · {(Number(agent.winRate) * 100).toFixed(0)}%W
          </Text>
        </View>

        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onConfigure(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={cardStyles.gearBtn}
        >
          <Ionicons name="chevron-forward" size={14} color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Row 2: Live status line */}
      <View style={cardStyles.statusRow}>
        <View style={cardStyles.pulseContainer}>
          <View style={cardStyles.pulseDot} />
        </View>
        <Text variant="caption" color="muted" numberOfLines={1} style={cardStyles.statusText}>
          {statusLine}
        </Text>
        <Text variant="caption" style={cardStyles.xpBadge}>
          {agent.xp} xp
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Activity Filters ────────────────────────────────────────

type FilterType = 'all' | ActivityType;

const ACTIVITY_OPTIONS: { key: FilterType; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'layers-outline' },
  { key: 'trade', label: 'Trades', icon: 'swap-horizontal-outline' },
  { key: 'conversation', label: 'Chats', icon: 'chatbubble-outline' },
  { key: 'task', label: 'Tasks', icon: 'checkmark-circle-outline' },
  { key: 'vote', label: 'Votes', icon: 'hand-left-outline' },
];

// ── Main Screen ─────────────────────────────────────────────

export default function AgentsTab() {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  const { agents, activeAgentId, isLoading, refresh } = useMyAgents();
  const { items: feedItems, isLoading: feedLoading, refresh: refreshFeed } = useTradeFeed();
  const removeAgent = useAuthStore((s) => s.removeAgent);
  const latestDecision = useAgentLiveStore((s) => s.decisions[0]);

  const tourRef = useTourTarget('agents');
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshFeed()]);
    setRefreshing(false);
  }, [refresh, refreshFeed]);

  const handleDelete = useCallback((agent: UserAgent) => {
    mediumImpact();
    if (agent.id === activeAgentId) {
      Alert.alert('Cannot Delete', 'You cannot delete your active agent. Switch to another agent first.');
      return;
    }
    Alert.alert(
      'Delete Agent',
      `Are you sure you want to delete ${agent.displayName || agent.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAgentById(agent.id);
              removeAgent(agent.id);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete agent');
            }
          },
        },
      ],
    );
  }, [activeAgentId, removeAgent]);

  // Get active agent for filtering
  const activeAgent = useMemo(() => {
    return agents.find((a) => a.id === activeAgentId) ?? null;
  }, [agents, activeAgentId]);

  // Filter feed to this user's active agent only
  const filteredFeed = useMemo(() => {
    let result = feedItems;
    if (activeAgent) {
      result = result.filter((i) =>
        i.agentName === activeAgent.displayName ||
        i.agentName === activeAgent.name
      );
    }
    if (activeFilter !== 'all') {
      result = result.filter((i) => i.type === activeFilter);
    }
    return result;
  }, [feedItems, activeFilter, activeAgent]);

  // Count per type (always scoped to my agent)
  const counts = useMemo(() => {
    const base = activeAgent
      ? feedItems.filter((i) =>
          i.agentName === activeAgent.displayName ||
          i.agentName === activeAgent.name
        )
      : feedItems;
    const c: Record<string, number> = { all: base.length };
    for (const item of base) {
      c[item.type] = (c[item.type] || 0) + 1;
    }
    return c;
  }, [feedItems, activeAgent]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: 32 }} edges={['top']}>
        <Ionicons name="people-outline" size={48} color={colors.text.muted} />
        <Text variant="body" color="muted" style={{ marginTop: 12, textAlign: 'center' }}>
          Sign in to manage your agents
        </Text>
      </SafeAreaView>
    );
  }

  const activityOptions = ACTIVITY_OPTIONS.map((o) => ({
    ...o,
    count: counts[o.key] || 0,
  }));

  // Build the FlatList header
  const ListHeader = (
    <View ref={tourRef} collapsable={false} style={{ gap: 12 }}>
      {/* ── My Agents Section ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="h2" color="primary">My Agents</Text>
        <Text variant="caption" color="muted">{agents.length}/6 slots</Text>
      </View>

      {isLoading && agents.length === 0 && (
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ padding: 24 }} />
      )}

      {!isLoading && agents.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
          <Ionicons name="rocket-outline" size={36} color={colors.text.muted} />
          <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
            Create your first AI trading agent to get started.
          </Text>
        </View>
      )}

      {/* Agent cards */}
      {agents.length > 0 && (
        <View style={{ gap: 6 }}>
          {agents.map((agent, idx) => (
            <Animated.View key={agent.id} entering={FadeInDown.springify()}>
              <AgentRow
                agent={agent}
                index={idx}
                onDelete={() => handleDelete(agent)}
                onConfigure={() => router.push('/configure-agent')}
                lastReasoning={
                  agent.id === activeAgentId && latestDecision
                    ? latestDecision.reason
                    : undefined
                }
              />
            </Animated.View>
          ))}
        </View>
      )}

      {/* Create New Agent button */}
      {agents.length < 6 && (
        <TouchableOpacity
          onPress={() => router.push('/create-agent')}
          style={styles.createBtn}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.brand.primary} />
          <Text variant="caption" color="brand" style={{ fontWeight: '600' }}>
            Create New Agent
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Activity Section ── */}
      <View style={styles.activityHeader}>
        <View style={styles.activityTitleRow}>
          <Text variant="h3" color="primary" style={{ fontWeight: '700' }}>Activity</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Activity type selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {activityOptions.map((opt) => {
            const isOn = activeFilter === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  selectionFeedback();
                  setActiveFilter(opt.key);
                }}
                style={[styles.typeChip, isOn && styles.typeChipActive]}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={11}
                  color={isOn ? colors.brand.primary : colors.text.muted}
                />
                <Text style={[styles.typeLabel, isOn && styles.typeLabelActive]}>
                  {opt.label}
                </Text>
                {opt.count > 0 && (
                  <Text style={[styles.typeCount, isOn && styles.typeCountActive]}>
                    {opt.count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <FlatList
        data={filteredFeed}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListHeaderComponentStyle={{ padding: 16, paddingBottom: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 6 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeIn.delay(Math.min(index * 30, 300)).duration(200)}>
            <FeedTradeCard item={item} />
          </Animated.View>
        )}
        ListEmptyComponent={
          feedLoading ? (
            <View style={{ padding: 16, gap: 8 }}>
              {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: 32 }}>
              <Text variant="body" color="muted">
                {activeFilter === 'all'
                  ? 'No activity from your agent yet'
                  : `No ${activeFilter}s from your agent yet`}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

// ── Agent Card Styles ────────────────────────────────────

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pfp: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inlineStats: {
    alignItems: 'flex-end',
    gap: 1,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statMeta: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.muted,
    fontVariant: ['tabular-nums'],
  },
  gearBtn: {
    padding: 4,
    marginLeft: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  pulseContainer: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.status.success,
  },
  statusText: {
    flex: 1,
    fontSize: 10,
    fontStyle: 'italic',
  },
  xpBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.brand.primary,
    fontVariant: ['tabular-nums'],
  },
});

// ── Page Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  createBtn: {
    backgroundColor: 'rgba(249, 115, 22, 0.06)',
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.brand.primary + '40',
    borderStyle: 'dashed',
  },
  activityHeader: {
    gap: 10,
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  activityTitleRow: {
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
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  typeChipActive: {
    backgroundColor: colors.brand.primary + '15',
    borderColor: colors.brand.primary + '30',
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
  },
  typeLabelActive: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  typeCount: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.muted,
    opacity: 0.6,
  },
  typeCountActive: {
    color: colors.brand.primary,
    opacity: 1,
  },
});
