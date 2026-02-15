import { View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import { getVoteDetail, castVote } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { mediumImpact, successNotification, errorNotification } from '@/lib/haptics';
import type { VoteDetail } from '@/types/arena';

export default function VoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vote, setVote] = useState<VoteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [casting, setCasting] = useState<'YES' | 'NO' | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const agentProfile = useAuthStore((s) => s.agentProfile);

  const fetchVote = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await getVoteDetail(id);
      setVote(data);
    } catch (err) {
      console.error('[VoteDetail] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load vote');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVote();
    intervalRef.current = setInterval(fetchVote, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchVote]);

  const myVote = useMemo(() => {
    if (!agentProfile || !vote) return null;
    return vote.votes.find((v) => v.agentId === agentProfile.id)?.vote ?? null;
  }, [vote?.votes, agentProfile]);

  const handleCastVote = useCallback(async (choice: 'YES' | 'NO') => {
    if (!agentProfile || !id) return;
    mediumImpact();
    setCasting(choice);
    try {
      await castVote(id, agentProfile.id, choice);
      successNotification();
      await fetchVote();
    } catch (err) {
      errorNotification();
      console.error('[VoteDetail] Cast failed:', err);
    } finally {
      setCasting(null);
    }
  }, [agentProfile, id, fetchVote]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </SafeAreaView>
    );
  }

  if (error || !vote) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text variant="body" color="error">{error || 'Vote not found'}</Text>
      </SafeAreaView>
    );
  }

  const yesPercent = vote.totalVotes > 0 ? (vote.yesVotes / vote.totalVotes) * 100 : 0;
  const noPercent = vote.totalVotes > 0 ? (vote.noVotes / vote.totalVotes) * 100 : 0;
  const timeRemaining = getTimeRemaining(vote.expiresAt);
  const yesVoters = vote.votes.filter((v) => v.vote === 'yes');
  const noVoters = vote.votes.filter((v) => v.vote === 'no');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <Ionicons name="arrow-back" size={24} color={colors.text.primary} onPress={() => router.back()} />
        <Text variant="h3" color="primary" style={{ flex: 1 }}>Vote Detail</Text>
        <View style={{
          backgroundColor: (vote.status === 'active' ? colors.status.success : vote.status === 'passed' ? colors.brand.primary : colors.status.error) + '22',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 6,
        }}>
          <Text variant="caption" style={{
            color: vote.status === 'active' ? colors.status.success : vote.status === 'passed' ? colors.brand.primary : colors.status.error,
            fontWeight: '700',
            textTransform: 'uppercase',
          }}>
            {vote.status}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        {/* Proposal */}
        <View style={{ backgroundColor: colors.surface.secondary, borderRadius: 12, padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons
              name={vote.action === 'BUY' ? 'trending-up' : 'trending-down'}
              size={20}
              color={vote.action === 'BUY' ? colors.status.success : colors.status.error}
            />
            <Text variant="h3" color="primary">
              {vote.action} {vote.tokenSymbol}
            </Text>
          </View>
          <Text variant="body" color="secondary">{vote.reason}</Text>
          <Text variant="caption" color="muted">
            Proposed by {vote.proposerName} | {new Date(vote.createdAt).toLocaleString()}
          </Text>
          {vote.status === 'active' && timeRemaining && (
            <Text variant="caption" color="warning">{timeRemaining}</Text>
          )}
        </View>

        {/* Vote Progress */}
        <View style={{ backgroundColor: colors.surface.secondary, borderRadius: 12, padding: 16, gap: 10 }}>
          <Text variant="label" color="primary" style={{ fontWeight: '600' }}>Results</Text>

          {/* Yes bar */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color="primary">Yes</Text>
              <Text variant="bodySmall" color="primary">{vote.yesVotes} ({yesPercent.toFixed(0)}%)</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface.tertiary }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.status.success, width: `${yesPercent}%` }} />
            </View>
          </View>

          {/* No bar */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodySmall" color="primary">No</Text>
              <Text variant="bodySmall" color="primary">{vote.noVotes} ({noPercent.toFixed(0)}%)</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface.tertiary }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.status.error, width: `${noPercent}%` }} />
            </View>
          </View>

          <Text variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 4 }}>
            {vote.totalVotes} total vote{vote.totalVotes !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Cast Vote / Already Voted */}
        {!agentProfile ? (
          <View style={{ backgroundColor: colors.surface.secondary, borderRadius: 12, padding: 16, alignItems: 'center' }}>
            <Text variant="body" color="muted">Sign in to vote</Text>
          </View>
        ) : myVote ? (
          <View style={{ backgroundColor: colors.surface.secondary, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons
              name={myVote === 'yes' ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={myVote === 'yes' ? colors.status.success : colors.status.error}
            />
            <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
              You voted {myVote === 'yes' ? 'Yes' : 'No'}
            </Text>
          </View>
        ) : vote.status === 'active' ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => handleCastVote('YES')}
              disabled={casting !== null}
              activeOpacity={0.7}
              style={{
                flex: 1,
                backgroundColor: colors.status.success + '22',
                borderWidth: 1,
                borderColor: colors.status.success,
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                opacity: casting === 'NO' ? 0.5 : 1,
              }}
            >
              {casting === 'YES' ? (
                <ActivityIndicator size="small" color={colors.status.success} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
                  <Text variant="body" style={{ color: colors.status.success, fontWeight: '700' }}>Vote Yes</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleCastVote('NO')}
              disabled={casting !== null}
              activeOpacity={0.7}
              style={{
                flex: 1,
                backgroundColor: colors.status.error + '22',
                borderWidth: 1,
                borderColor: colors.status.error,
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                opacity: casting === 'YES' ? 0.5 : 1,
              }}
            >
              {casting === 'NO' ? (
                <ActivityIndicator size="small" color={colors.status.error} />
              ) : (
                <>
                  <Ionicons name="close-circle" size={20} color={colors.status.error} />
                  <Text variant="body" style={{ color: colors.status.error, fontWeight: '700' }}>Vote No</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Vote History */}
        {yesVoters.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text variant="label" color="primary" style={{ fontWeight: '600' }}>
              Yes Votes ({yesVoters.length})
            </Text>
            {yesVoters.map((v, i) => (
              <View key={`yes-${i}`} style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: colors.surface.secondary,
                borderRadius: 8,
                padding: 10,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
                  <Text variant="bodySmall" color="primary">{v.agentName}</Text>
                </View>
                <Text variant="caption" color="muted">
                  {new Date(v.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {noVoters.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text variant="label" color="primary" style={{ fontWeight: '600' }}>
              No Votes ({noVoters.length})
            </Text>
            {noVoters.map((v, i) => (
              <View key={`no-${i}`} style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: colors.surface.secondary,
                borderRadius: 8,
                padding: 10,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="close-circle" size={16} color={colors.status.error} />
                  <Text variant="bodySmall" color="primary">{v.agentName}</Text>
                </View>
                <Text variant="caption" color="muted">
                  {new Date(v.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getTimeRemaining(expiresAt: string): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s remaining`;
  return `${mins}m ${secs}s remaining`;
}
