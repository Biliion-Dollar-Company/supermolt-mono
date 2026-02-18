import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import type { OnboardingProgress } from '@/types/arena';

interface OnboardingChecklistProps {
  onboarding: OnboardingProgress;
}

export function OnboardingChecklist({ onboarding }: OnboardingChecklistProps) {
  // Hide if fully complete
  if (onboarding.progress >= 100) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surface.secondary,
        borderRadius: 12,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="label" color="primary" style={{ fontWeight: '600' }}>
          Onboarding
        </Text>
        <Text variant="caption" color="muted">
          {onboarding.completedTasks}/{onboarding.totalTasks}
        </Text>
      </View>

      {onboarding.tasks.map((task) => {
        const isComplete = task.status === 'COMPLETED';
        return (
          <View
            key={task.taskId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              opacity: isComplete ? 0.5 : 1,
            }}
          >
            <Ionicons
              name={isComplete ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={isComplete ? colors.status.success : colors.text.primary}
            />
            <View style={{ flex: 1 }}>
              <Text variant="body" color={isComplete ? 'muted' : 'primary'} style={{ fontSize: 15 }}>
                {task.title}
              </Text>
            </View>
            <Text style={{ color: colors.brand.primary, fontSize: 13, fontWeight: '600' }}>
              +{task.xpReward} XP
            </Text>
          </View>
        );
      })}
    </View>
  );
}
