import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';

interface StatBar {
  label: string;
  value: number; // 0-100
}

interface ArchetypeCardProps {
  id: string;
  emoji: string;
  name: string;
  description: string;
  stats: StatBar[];
  selected: boolean;
  onPress: () => void;
}

export function ArchetypeCard({
  emoji,
  name,
  description,
  stats,
  selected,
  onPress,
}: ArchetypeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-2xl p-4 ${
        selected ? 'border-2 border-brand-primary bg-brand-primary/10' : 'border-2 border-transparent bg-card'
      }`}
      style={{ minHeight: 240 }}
    >
      <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>
        {emoji}
      </Text>
      <Text className="text-foreground font-bold text-center text-base mb-1">
        {name}
      </Text>
      <Text className="text-foreground-secondary text-xs text-center mb-3" numberOfLines={2}>
        {description}
      </Text>

      <View className="gap-2">
        {stats.map((stat) => (
          <View key={stat.label}>
            <View className="flex-row justify-between mb-1">
              <Text className="text-foreground-muted text-xs">{stat.label}</Text>
              <Text className="text-foreground-muted text-xs">{stat.value}</Text>
            </View>
            <View className="h-1.5 rounded-full bg-background overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${stat.value}%`,
                  backgroundColor: stat.value > 70
                    ? colors.status.success
                    : stat.value > 40
                    ? colors.status.warning
                    : colors.text.muted,
                }}
              />
            </View>
          </View>
        ))}
      </View>

      {selected && (
        <View className="mt-3 bg-brand-primary/20 rounded-lg py-1">
          <Text className="text-brand-primary text-xs font-semibold text-center">
            Selected
          </Text>
        </View>
      )}
    </Pressable>
  );
}
