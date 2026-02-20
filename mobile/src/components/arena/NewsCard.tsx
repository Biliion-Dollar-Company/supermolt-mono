import { View, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import type { NewsItem } from '@/types/arena';

interface NewsCardProps {
  item: NewsItem;
}

const CATEGORY_COLORS: Record<string, string> = {
  FEATURE: colors.brand.primary,
  EVENT: colors.brand.secondary,
  ANNOUNCEMENT: colors.status.warning,
  MILESTONE: colors.status.success,
  PARTNERSHIP: colors.brand.accent,
  CHANGELOG: colors.text.secondary,
};

export function NewsCard({ item }: NewsCardProps) {
  const categoryColor = CATEGORY_COLORS[item.category] || colors.text.secondary;

  const handlePress = () => {
    if (item.ctaType === 'EXTERNAL_LINK' && item.ctaUrl) {
      Linking.openURL(item.ctaUrl);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 12,
        width: 260,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Category Badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{
          backgroundColor: categoryColor + '22',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 4,
        }}>
          <Text variant="caption" style={{ color: categoryColor, fontWeight: '600', fontSize: 10 }}>
            {item.category}
          </Text>
        </View>
        <Text variant="caption" color="muted">
          {new Date(item.publishedAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Title */}
      <Text variant="body" color="primary" style={{ fontWeight: '600' }} numberOfLines={2}>
        {item.title}
      </Text>

      {/* Description */}
      <Text variant="bodySmall" color="muted" numberOfLines={2}>
        {item.description}
      </Text>

      {/* CTA */}
      {item.ctaText && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Text variant="caption" color="brand" style={{ fontWeight: '600' }}>
            {item.ctaText}
          </Text>
          {item.ctaType === 'EXTERNAL_LINK' && (
            <Ionicons name="open-outline" size={12} color={colors.brand.primary} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
