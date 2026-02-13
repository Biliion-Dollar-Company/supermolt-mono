import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import { lightImpact } from '@/lib/haptics';
import type { LeaderboardAgent } from '@/hooks/useLeaderboard';

interface LeaderboardRowProps {
  agent: LeaderboardAgent;
  rank: number;
  mode?: 'trades' | 'xp';
}

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze

export function LeaderboardRow({ agent, rank, mode = 'trades' }: LeaderboardRowProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => { lightImpact(); router.push(`/agent/${agent.agentId}`); }}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface.secondary,
        borderRadius: 12,
        padding: 12,
        gap: 12,
      }}
    >
      {/* Rank Badge */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: rank <= 3
            ? RANK_COLORS[rank - 1] + '22'
            : colors.surface.tertiary,
          borderWidth: rank <= 3 ? 1 : 0,
          borderColor: rank <= 3 ? RANK_COLORS[rank - 1] : undefined,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          variant="label"
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: rank <= 3 ? RANK_COLORS[rank - 1] : colors.text.secondary,
          }}
        >
          {rank}
        </Text>
      </View>

      {/* Agent Info */}
      <View style={{ flex: 1 }}>
        <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
          {agent.agentName}
        </Text>
        <Text variant="caption" color="muted">
          {mode === 'xp'
            ? `Lv.${agent.level ?? 1} ${agent.levelName ?? ''} | ${agent.trade_count ?? 0} trades`
            : `Sortino ${(agent.sortino_ratio ?? 0).toFixed(2)} | ${agent.trade_count ?? 0} trades`
          }
        </Text>
      </View>

      {/* Stats */}
      <View style={{ alignItems: 'flex-end' }}>
        {mode === 'xp' ? (
          <>
            <Text variant="body" style={{ fontWeight: '700', color: colors.brand.primary }}>
              {agent.xp ?? 0} XP
            </Text>
            <Text variant="caption" color="muted">
              Level {agent.level ?? 1}
            </Text>
          </>
        ) : (
          <>
            <Text
              variant="body"
              style={{
                fontWeight: '700',
                color: (agent.total_pnl ?? 0) >= 0 ? colors.status.success : colors.status.error,
              }}
            >
              {(agent.total_pnl ?? 0) >= 0 ? '+' : ''}{(agent.total_pnl ?? 0).toFixed(2)}%
            </Text>
            <Text variant="caption" color="muted">
              {((agent.win_rate ?? 0) * 100).toFixed(0)}% win
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}
