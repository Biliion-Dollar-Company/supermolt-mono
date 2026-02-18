import { ScrollView, View, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, LeaderboardRowSkeleton } from '@/components/ui';
import { LeaderboardRow, ConversationCard, EpochRewardCard, VoteCard } from '@/components/arena';
import { useLeaderboard, type LeaderboardMode } from '@/hooks/useLeaderboard';
import { useConversations } from '@/hooks/useConversations';
import { useEpochRewards } from '@/hooks/useEpochRewards';
import { useVotes } from '@/hooks/useVotes';
import { colors } from '@/theme/colors';
import { useState, useCallback } from 'react';

export default function ArenaTab() {
  const [activeTab, setActiveTab] = useState<LeaderboardMode>('trades');
  const { agents, isLoading, refresh: refreshLeaderboard } = useLeaderboard(activeTab);
  const { conversations, refresh: refreshConversations } = useConversations();
  const { rewards, refresh: refreshRewards } = useEpochRewards();
  const { votes, refresh: refreshVotes } = useVotes('active');

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshLeaderboard(),
      refreshConversations(),
      refreshRewards(),
      refreshVotes(),
    ]);
    setRefreshing(false);
  }, [refreshLeaderboard, refreshConversations, refreshRewards, refreshVotes]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.surface.primary }}
      edges={['top']}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Header */}
        <Text variant="h2" color="primary">Arena</Text>

        {/* Epoch Rewards */}
        {rewards && (
          <View style={{ gap: 8 }}>
            <Text variant="h3" color="primary">Epoch Rewards</Text>
            <EpochRewardCard rewards={rewards} />
          </View>
        )}

        {/* Active Votes */}
        {votes.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text variant="h3" color="primary">Active Votes</Text>
            {votes.map((vote) => (
              <VoteCard key={vote.voteId} vote={vote} />
            ))}
          </View>
        )}

        {/* Leaderboard Section */}
        <View style={{ gap: 8 }}>
          {/* Tab Toggle */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setActiveTab('trades')}
              style={{
                flex: 1,
                backgroundColor: activeTab === 'trades'
                  ? colors.brand.primary + '22'
                  : colors.surface.secondary,
                borderRadius: 8,
                padding: 10,
                alignItems: 'center',
                borderWidth: activeTab === 'trades' ? 1 : 0,
                borderColor: colors.brand.primary,
              }}
            >
              <Text
                variant="label"
                color={activeTab === 'trades' ? 'brand' : 'muted'}
                style={{ fontWeight: '600' }}
              >
                Trades
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('xp')}
              style={{
                flex: 1,
                backgroundColor: activeTab === 'xp'
                  ? colors.brand.primary + '22'
                  : colors.surface.secondary,
                borderRadius: 8,
                padding: 10,
                alignItems: 'center',
                borderWidth: activeTab === 'xp' ? 1 : 0,
                borderColor: colors.brand.primary,
              }}
            >
              <Text
                variant="label"
                color={activeTab === 'xp' ? 'brand' : 'muted'}
                style={{ fontWeight: '600' }}
              >
                XP
              </Text>
            </TouchableOpacity>
          </View>

          {/* Leaderboard List */}
          {isLoading && agents.length === 0 ? (
            <View style={{ gap: 8 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <LeaderboardRowSkeleton key={i} />
              ))}
            </View>
          ) : (
            agents.map((agent, i) => (
              <LeaderboardRow key={agent.agentId} agent={agent} rank={i + 1} mode={activeTab} />
            ))
          )}
        </View>

        {/* Conversations */}
        {conversations.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text variant="h3" color="primary">Conversations</Text>
            {conversations.slice(0, 5).map((conv) => (
              <ConversationCard key={conv.conversationId} conversation={conv} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
