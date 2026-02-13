import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import { lightImpact } from '@/lib/haptics';
import type { Vote } from '@/types/arena';

interface VoteCardProps {
  vote: Vote;
}

const STATUS_COLORS: Record<string, string> = {
  active: colors.status.success,
  passed: colors.brand.primary,
  failed: colors.status.error,
  expired: colors.text.muted,
};

export function VoteCard({ vote }: VoteCardProps) {
  const router = useRouter();
  const statusColor = STATUS_COLORS[vote.status] || colors.text.muted;
  const yesPercent = vote.totalVotes > 0 ? (vote.yesVotes / vote.totalVotes) * 100 : 0;
  const noPercent = vote.totalVotes > 0 ? (vote.noVotes / vote.totalVotes) * 100 : 0;

  const timeRemaining = getTimeRemaining(vote.expiresAt);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => { lightImpact(); router.push(`/vote/${vote.voteId}`); }}
      style={{
        backgroundColor: colors.surface.secondary,
        borderRadius: 12,
        padding: 12,
        gap: 8,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons
            name={vote.action === 'BUY' ? 'trending-up' : 'trending-down'}
            size={16}
            color={vote.action === 'BUY' ? colors.status.success : colors.status.error}
          />
          <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
            {vote.action} {vote.tokenSymbol}
          </Text>
        </View>
        <View style={{
          backgroundColor: statusColor + '22',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 4,
        }}>
          <Text variant="caption" style={{ color: statusColor, fontWeight: '600', fontSize: 10, textTransform: 'uppercase' }}>
            {vote.status}
          </Text>
        </View>
      </View>

      {/* Proposer + Reason */}
      <Text variant="bodySmall" color="muted" numberOfLines={2}>
        {vote.proposerName}: {vote.reason}
      </Text>

      {/* Vote Progress Bar */}
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.surface.tertiary }}>
          {yesPercent > 0 && (
            <View style={{ width: `${yesPercent}%`, backgroundColor: colors.status.success, borderRadius: 3 }} />
          )}
          {noPercent > 0 && (
            <View style={{ width: `${noPercent}%`, backgroundColor: colors.status.error, borderRadius: 3 }} />
          )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color="muted">
            Yes {vote.yesVotes} ({yesPercent.toFixed(0)}%)
          </Text>
          <Text variant="caption" color="muted">
            No {vote.noVotes} ({noPercent.toFixed(0)}%)
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="caption" color="muted">
          {vote.totalVotes} vote{vote.totalVotes !== 1 ? 's' : ''}
        </Text>
        {vote.status === 'active' && timeRemaining && (
          <Text variant="caption" color="muted">{timeRemaining}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function getTimeRemaining(expiresAt: string): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}
