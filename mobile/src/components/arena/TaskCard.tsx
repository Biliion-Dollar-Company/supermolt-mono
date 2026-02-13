import { View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import type { AgentTaskType } from '@/types/arena';

interface TaskCardProps {
  task: AgentTaskType;
  style?: ViewStyle;
}

const TASK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  LIQUIDITY_LOCK: 'lock-closed-outline',
  COMMUNITY_ANALYSIS: 'people-outline',
  HOLDER_ANALYSIS: 'pie-chart-outline',
  NARRATIVE_RESEARCH: 'document-text-outline',
  GOD_WALLET_TRACKING: 'wallet-outline',
  TWITTER_DISCOVERY: 'logo-twitter',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: colors.status.warning,
  CLAIMED: colors.brand.primary,
  COMPLETED: colors.status.success,
  EXPIRED: colors.text.muted,
};

export function TaskCard({ task, style }: TaskCardProps) {
  const icon = TASK_ICONS[task.taskType] || 'help-circle-outline';
  const statusColor = STATUS_COLORS[task.status] || colors.text.muted;

  return (
    <View
      style={[{
        backgroundColor: colors.surface.secondary,
        borderRadius: 12,
        padding: 12,
        width: 160,
        gap: 8,
      }, style]}
    >
      {/* Icon + XP */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Ionicons name={icon} size={20} color={colors.text.secondary} />
        <Text variant="caption" color="brand" style={{ fontWeight: '600' }}>
          +{task.xpReward} XP
        </Text>
      </View>

      {/* Title */}
      <Text variant="bodySmall" color="primary" numberOfLines={2} style={{ fontWeight: '500' }}>
        {task.title}
      </Text>

      {/* Token + Status */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {task.tokenSymbol && (
          <Text variant="caption" color="muted">{task.tokenSymbol}</Text>
        )}
        <View
          style={{
            backgroundColor: statusColor + '22',
            borderRadius: 4,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text variant="caption" style={{ color: statusColor, fontSize: 10, fontWeight: '600' }}>
            {task.status}
          </Text>
        </View>
      </View>

      {/* Completions */}
      {task.completions.length > 0 && (
        <Text variant="caption" color="muted">
          {task.completions.length} submission{task.completions.length !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );
}
