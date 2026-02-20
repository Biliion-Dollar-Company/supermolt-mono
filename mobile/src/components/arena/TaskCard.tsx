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

export function TaskCard({ task, style }: TaskCardProps) {
  const icon = TASK_ICONS[task.taskType] || 'help-circle-outline';

  return (
    <View
      style={[{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 12,
        width: 160,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }, style]}
    >
      {/* Icon + XP */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Ionicons name={icon} size={20} color={colors.text.primary} />
        <Text style={{ color: colors.brand.primary, fontSize: 12, fontWeight: '600' }}>
          +{task.xpReward} XP
        </Text>
      </View>

      {/* Title */}
      <Text variant="body" color="primary" numberOfLines={2} style={{ fontWeight: '500', fontSize: 15 }}>
        {task.title}
      </Text>
    </View>
  );
}
