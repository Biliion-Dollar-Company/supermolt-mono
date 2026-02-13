import { View } from 'react-native';
import { Text, Card } from '@/components/ui';
import { XPProgressBar } from './XPProgressBar';
import { OnboardingChecklist } from './OnboardingChecklist';
import { colors } from '@/theme/colors';
import type { AgentProfile, OnboardingProgress } from '@/types/arena';

interface MyAgentCardProps {
  agent: AgentProfile;
  stats: {
    sortinoRatio: number;
    maxDrawdown: number;
    totalPnl: number;
    totalTrades: number;
    winRate: number;
  } | null;
  onboarding: OnboardingProgress;
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="caption" color="muted">{label}</Text>
      <Text
        variant="body"
        style={{ fontWeight: '700', color: color || colors.text.primary, marginTop: 2 }}
      >
        {value}
      </Text>
    </View>
  );
}

export function MyAgentCard({ agent, stats, onboarding }: MyAgentCardProps) {
  return (
    <Card variant="default" padding="md">
      {/* Agent Name */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text variant="h3" color="primary" style={{ fontWeight: '700' }}>
            {agent.name}
          </Text>
          {agent.twitterHandle && (
            <Text variant="caption" color="muted">@{agent.twitterHandle}</Text>
          )}
        </View>
        <View
          style={{
            backgroundColor: colors.brand.primary + '22',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text variant="caption" color="brand" style={{ fontWeight: '600' }}>
            {agent.status}
          </Text>
        </View>
      </View>

      {/* XP Progress */}
      <XPProgressBar
        xp={agent.xp}
        level={agent.level}
        levelName={agent.levelName}
        xpForNextLevel={agent.xpForNextLevel}
      />

      {/* Stats Grid */}
      {stats && (
        <View
          style={{
            flexDirection: 'row',
            marginTop: 12,
            backgroundColor: colors.surface.tertiary,
            borderRadius: 8,
            padding: 10,
          }}
        >
          <StatCell
            label="PnL"
            value={`${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}%`}
            color={stats.totalPnl >= 0 ? colors.status.success : colors.status.error}
          />
          <StatCell label="Trades" value={String(stats.totalTrades)} />
          <StatCell
            label="Win"
            value={`${(stats.winRate * 100).toFixed(0)}%`}
          />
          <StatCell
            label="Sortino"
            value={stats.sortinoRatio.toFixed(2)}
          />
        </View>
      )}

      {/* Onboarding */}
      <View style={{ marginTop: 12 }}>
        <OnboardingChecklist onboarding={onboarding} />
      </View>
    </Card>
  );
}
