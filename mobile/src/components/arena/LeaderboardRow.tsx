import { View, TouchableOpacity, Image } from 'react-native';
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
const TROPHY_EMOJI = ['\u{1F3C6}', '\u{1F948}', '\u{1F949}']; // 1st, 2nd, 3rd

const solanaIcon = require('../../../assets/icons/solana.png');

export function LeaderboardRow({ agent, rank, mode = 'trades' }: LeaderboardRowProps) {
  const router = useRouter();
  const isTop3 = rank <= 3;

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
      {/* Rank Badge — trophy for top 3, number for rest */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isTop3
            ? RANK_COLORS[rank - 1] + '22'
            : colors.surface.tertiary,
          borderWidth: isTop3 ? 1 : 0,
          borderColor: isTop3 ? RANK_COLORS[rank - 1] : undefined,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isTop3 ? (
          <Text style={{ fontSize: 16 }}>{TROPHY_EMOJI[rank - 1]}</Text>
        ) : (
          <Text
            variant="label"
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: colors.text.secondary,
            }}
          >
            {rank}
          </Text>
        )}
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
            {/* SOL PnL with Solana icon */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Image source={solanaIcon} style={{ width: 14, height: 14 }} />
              <Text
                variant="body"
                style={{
                  fontWeight: '700',
                  color: (agent.total_pnl ?? 0) >= 0 ? colors.status.success : colors.status.error,
                }}
              >
                {(agent.total_pnl ?? 0) >= 0 ? '+' : ''}{(agent.total_pnl ?? 0).toFixed(2)}
              </Text>
            </View>
            <Text variant="caption" color="muted">
              {Math.round((agent.win_rate ?? 0) * 100)}% win
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}
