import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import { useTradeRecommendationStore } from '@/store/tradeRecommendations';
import { mediumImpact } from '@/lib/haptics';

/**
 * Floating trade recommendation alert.
 * Renders the most recent pending recommendation as a tappable banner.
 * Tap opens the approve-tx modal with all trade params.
 */
export function TradeRecommendationAlert() {
  const router = useRouter();
  const pending = useTradeRecommendationStore((s) => s.pending);
  const dismiss = useTradeRecommendationStore((s) => s.dismiss);

  if (pending.length === 0) return null;

  const latest = pending[0];
  const age = Math.floor((Date.now() - latest.timestamp) / 1000);
  // Auto-dismiss after 120 seconds
  if (age > 120) {
    dismiss(latest.id);
    return null;
  }

  const handleTap = () => {
    mediumImpact();
    router.push({
      pathname: '/(modals)/approve-tx',
      params: {
        action: 'BUY',
        tokenSymbol: latest.tokenSymbol,
        tokenMint: latest.tokenMint,
        solAmount: String(latest.suggestedAmount),
        amount: String(latest.suggestedAmount),
        agentName: 'Your Agent',
        reason: latest.reason,
        chain: latest.chain,
      },
    });
    dismiss(latest.id);
  };

  const handleDismiss = () => {
    dismiss(latest.id);
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleTap}
        style={{
          backgroundColor: colors.status.success + '18',
          borderWidth: 1,
          borderColor: colors.status.success + '44',
          borderRadius: 10,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Ionicons name="arrow-down-circle" size={24} color={colors.status.success} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="body" style={{ fontWeight: '700', color: colors.status.success }}>
              BUY {latest.tokenSymbol}
            </Text>
            <View style={{
              backgroundColor: colors.surface.tertiary,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 3,
            }}>
              <Text variant="caption" color="muted" style={{ fontSize: 9 }}>
                {latest.suggestedAmount} {latest.chain === 'BSC' ? 'BNB' : 'SOL'}
              </Text>
            </View>
            <View style={{
              backgroundColor: colors.surface.tertiary,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 3,
            }}>
              <Text variant="caption" color="muted" style={{ fontSize: 9 }}>{latest.chain}</Text>
            </View>
          </View>
          <Text variant="caption" color="muted" numberOfLines={1}>{latest.reason}</Text>
        </View>
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 2 }}
        >
          <Ionicons name="close" size={16} color={colors.text.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
      {pending.length > 1 && (
        <Text
          variant="caption"
          color="muted"
          style={{ textAlign: 'center', marginTop: 4, fontSize: 10 }}
        >
          +{pending.length - 1} more recommendation{pending.length > 2 ? 's' : ''}
        </Text>
      )}
    </View>
  );
}
