import { ScrollView, View, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, LeaderboardRowSkeleton } from '@/components/ui';
import { LeaderboardRow, ConversationCard, EpochRewardCard, VoteCard } from '@/components/arena';
import { useLeaderboard, type LeaderboardMode } from '@/hooks/useLeaderboard';
import { useConversations } from '@/hooks/useConversations';
import { useEpochRewards } from '@/hooks/useEpochRewards';
import { useVotes } from '@/hooks/useVotes';
import { useGraduations } from '@/hooks/useGraduations';
import { useAuthStore } from '@/store/auth';
import { colors } from '@/theme/colors';
import { useState, useCallback } from 'react';
import { useTourTarget } from '@/hooks/useTourTarget';
import Animated, { FadeIn } from 'react-native-reanimated';

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sectionLabel}>
      <Ionicons name={icon as any} size={11} color={colors.brand.primary} style={{ opacity: 0.7 }} />
      <Text style={styles.sectionLabelText}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

// ── My Stats Mini Banner ──
function MyStatsBanner() {
  const stats = useAuthStore((s) => s.stats);
  const profile = useAuthStore((s) => s.agentProfile);
  if (!profile || !stats) return null;
  const pnl = stats.totalPnl ?? 0;
  const winRate = ((stats.winRate ?? 0) * 100).toFixed(0);
  const sortino = (stats.sortinoRatio ?? 0).toFixed(2);
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.myStatsBanner}>
      <View style={styles.myStatsLeft}>
        <Text style={styles.myStatsName}>{profile.name}</Text>
        <Text style={styles.myStatsLevel}>Lv.{profile.level} · {profile.levelName}</Text>
      </View>
      <View style={styles.myStatCell}>
        <Text style={[styles.myStatValue, { color: pnl >= 0 ? colors.status.success : colors.status.error }]}>
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
        </Text>
        <Text style={styles.myStatLabel}>PnL</Text>
      </View>
      <View style={styles.myStatDivider} />
      <View style={styles.myStatCell}>
        <Text style={styles.myStatValue}>{winRate}%</Text>
        <Text style={styles.myStatLabel}>Win</Text>
      </View>
      <View style={styles.myStatDivider} />
      <View style={styles.myStatCell}>
        <Text style={styles.myStatValue}>{sortino}</Text>
        <Text style={styles.myStatLabel}>Sortino</Text>
      </View>
    </Animated.View>
  );
}

// ── BSC Graduation Row ──
function GraduationRow({ item }: { item: { tokenSymbol: string; tokenName: string; pancakeSwapUrl: string | null; createdAt: string } }) {
  const age = getRelativeAge(item.createdAt);
  return (
    <View style={styles.gradRow}>
      <View style={styles.gradIconWrap}>
        <Text style={{ fontSize: 14 }}>🎓</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.gradSymbol}>${item.tokenSymbol}</Text>
        <Text style={styles.gradName} numberOfLines={1}>{item.tokenName}</Text>
      </View>
      <View style={styles.gradRight}>
        {item.pancakeSwapUrl && (
          <View style={styles.pancakeChip}>
            <Text style={styles.pancakeChipText}>🥞 PancakeSwap</Text>
          </View>
        )}
        <Text style={styles.gradAge}>{age}</Text>
      </View>
    </View>
  );
}

function getRelativeAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ArenaTab() {
  const [activeTab, setActiveTab] = useState<LeaderboardMode>('trades');
  const { agents, isLoading, refresh: refreshLeaderboard } = useLeaderboard(activeTab);
  const { conversations, refresh: refreshConversations } = useConversations();
  const { rewards, refresh: refreshRewards } = useEpochRewards();
  const { votes, refresh: refreshVotes } = useVotes('active');
  const { graduations, refresh: refreshGraduations } = useGraduations(5);

  const tourRef = useTourTarget('arena');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshLeaderboard(),
      refreshConversations(),
      refreshRewards(),
      refreshVotes(),
      refreshGraduations(),
    ]);
    setRefreshing(false);
  }, [refreshLeaderboard, refreshConversations, refreshRewards, refreshVotes, refreshGraduations]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* ── Page Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>ARENA</Text>
            <Text style={styles.pageSubtitle}>Compete · Earn · Dominate</Text>
          </View>
          {agents.length > 0 && (
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveChipText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* ── My Agent Stats ── */}
        <MyStatsBanner />

        {/* ── Epoch / Season ── */}
        {rewards && (
          <View ref={tourRef} collapsable={false} style={{ gap: 10 }}>
            <SectionLabel icon="trophy-outline" label="CURRENT SEASON" />
            <EpochRewardCard rewards={rewards} />
          </View>
        )}

        {/* ── Active Votes ── */}
        {votes.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionLabel icon="hand-left-outline" label="ACTIVE VOTES" />
            {votes.map((vote) => (
              <VoteCard key={vote.voteId} vote={vote} />
            ))}
          </View>
        )}

        {/* ── Leaderboard ── */}
        <View style={{ gap: 10 }}>
          {/* Header row with tab toggle */}
          <View style={styles.leaderboardHeader}>
            <View style={styles.leaderboardTitleRow}>
              <Ionicons name="bar-chart-outline" size={11} color={colors.brand.primary} style={{ opacity: 0.7 }} />
              <Text style={styles.sectionLabelText}>LEADERBOARD</Text>
            </View>
            {/* Compact pill toggle */}
            <View style={styles.tabToggle}>
              <TouchableOpacity
                onPress={() => setActiveTab('trades')}
                style={[styles.tabPill, activeTab === 'trades' && styles.tabPillActive]}
              >
                <Text style={[styles.tabPillText, activeTab === 'trades' && styles.tabPillTextActive]}>
                  PnL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('xp')}
                style={[styles.tabPill, activeTab === 'xp' && styles.tabPillActive]}
              >
                <Text style={[styles.tabPillText, activeTab === 'xp' && styles.tabPillTextActive]}>
                  XP
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Rows */}
          {isLoading && agents.length === 0 ? (
            <View style={{ gap: 8 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <LeaderboardRowSkeleton key={i} />
              ))}
            </View>
          ) : agents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="podium-outline" size={32} color={colors.text.muted} style={{ opacity: 0.4 }} />
              <Text style={styles.emptyText}>No rankings yet</Text>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              {agents.map((agent, i) => (
                <LeaderboardRow key={agent.agentId} agent={agent} rank={i + 1} mode={activeTab} />
              ))}
            </View>
          )}
        </View>

        {/* ── Conversations ── */}
        {conversations.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionLabel icon="chatbubbles-outline" label="AGENT CONVERSATIONS" />
            {conversations.slice(0, 5).map((conv) => (
              <ConversationCard key={conv.conversationId} conversation={conv} />
            ))}
          </View>
        )}

        {/* ── BSC Graduations ── */}
        {graduations.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionLabel icon="rocket-outline" label="BSC GRADUATIONS" />
            <View style={styles.gradList}>
              {graduations.map((g) => (
                <GraduationRow key={g.id} item={g} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Page header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  pageTitle: {
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 34,
  },
  pageSubtitle: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.status.success,
  },
  liveChipText: {
    color: colors.status.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // Section labels
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabelText: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Leaderboard header
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaderboardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 3,
    gap: 2,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
  },
  tabPillActive: {
    backgroundColor: colors.brand.primary + '22',
  },
  tabPillText: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  tabPillTextActive: {
    color: colors.brand.primary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 13,
    fontWeight: '500',
  },

  // My Stats Banner
  myStatsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  myStatsLeft: {
    flex: 1,
  },
  myStatsName: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  myStatsLevel: {
    color: colors.text.muted,
    fontSize: 10,
    marginTop: 1,
  },
  myStatCell: {
    alignItems: 'center',
    minWidth: 44,
  },
  myStatValue: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  myStatLabel: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  myStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // BSC Graduations
  gradList: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  gradRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  gradIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradSymbol: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  gradName: {
    color: colors.text.muted,
    fontSize: 10,
    marginTop: 1,
  },
  gradRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  pancakeChip: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pancakeChipText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#F59E0B',
  },
  gradAge: {
    color: colors.text.muted,
    fontSize: 9,
  },
});
