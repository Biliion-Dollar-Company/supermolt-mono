import { View, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import type { BSCTokenGraduation } from '@/types/arena';

interface BSCGraduationCardProps {
  graduation: BSCTokenGraduation;
}

export function BSCGraduationCard({ graduation }: BSCGraduationCardProps) {
  const graduated = graduation.bondingCurveGraduated;
  const timeAgo = getTimeAgo(graduation.createdAt);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        const url = graduation.pancakeSwapUrl || graduation.platformUrl || graduation.explorerUrl;
        if (url) Linking.openURL(url);
      }}
      style={{
        backgroundColor: colors.surface.secondary,
        borderRadius: 12,
        padding: 12,
        width: 200,
        gap: 6,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text variant="body" color="primary" style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {graduation.tokenSymbol}
        </Text>
        {graduated && (
          <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
        )}
      </View>

      {/* Token name */}
      <Text variant="caption" color="muted" numberOfLines={1}>{graduation.tokenName}</Text>

      {/* Platform + Chain */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {graduation.platform && (
          <View style={{ backgroundColor: colors.surface.tertiary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
            <Text variant="caption" color="secondary" style={{ fontSize: 10 }}>{graduation.platform}</Text>
          </View>
        )}
        <View style={{ backgroundColor: colors.surface.tertiary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
          <Text variant="caption" color="secondary" style={{ fontSize: 10 }}>{graduation.chain}</Text>
        </View>
        <Text variant="caption" color="muted" style={{ fontSize: 10, marginLeft: 'auto' }}>{timeAgo}</Text>
      </View>
    </TouchableOpacity>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
