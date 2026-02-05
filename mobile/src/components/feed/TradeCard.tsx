import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { Trade } from '@/hooks/useTrades';

interface TradeCardProps {
  trade: Trade;
  onPress: () => void;
}

export function TradeCard({ trade, onPress }: TradeCardProps) {
  const isBuy = trade.action === 'BUY';
  const isClosed = trade.status === 'CLOSED';
  const hasFeedback = !!trade.feedback;

  return (
    <Pressable onPress={onPress} className="mx-4 mb-3 bg-card rounded-xl p-4 active:opacity-80">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{
              backgroundColor: isBuy
                ? 'rgba(34,197,94,0.15)'
                : 'rgba(239,68,68,0.15)',
            }}
          >
            <Ionicons
              name={isBuy ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={22}
              color={isBuy ? colors.status.success : colors.status.error}
            />
          </View>
          <View>
            <Text className="text-foreground font-semibold">
              {isBuy ? 'Bought' : 'Sold'} {trade.tokenSymbol}
            </Text>
            <Text className="text-foreground-muted text-xs">
              {trade.tokenName} · {trade.signalSource}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <View className="flex-row items-center gap-1">
            <View
              className={`px-2 py-0.5 rounded ${
                isClosed ? 'bg-foreground-muted/20' : 'bg-success/20'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  isClosed ? 'text-foreground-muted' : 'text-success'
                }`}
              >
                {trade.status}
              </Text>
            </View>
          </View>

          {/* Feedback indicator */}
          <View className="flex-row items-center gap-1 mt-1">
            <Ionicons
              name={hasFeedback ? 'chatbubble' : 'chatbubble-outline'}
              size={12}
              color={hasFeedback ? colors.brand.primary : colors.text.muted}
            />
            <Text
              className={`text-xs ${
                hasFeedback ? 'text-brand-primary' : 'text-foreground-muted'
              }`}
            >
              {hasFeedback ? 'Rated' : 'Rate'}
            </Text>
          </View>
        </View>
      </View>

      {/* Price + PnL row */}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-background">
        <View>
          <Text className="text-foreground-muted text-xs">Entry</Text>
          <Text className="text-foreground text-sm">
            ${Number(trade.entryPrice).toFixed(8)}
          </Text>
        </View>

        {trade.exitPrice && (
          <View>
            <Text className="text-foreground-muted text-xs">Exit</Text>
            <Text className="text-foreground text-sm">
              ${Number(trade.exitPrice).toFixed(8)}
            </Text>
          </View>
        )}

        {trade.pnl !== null && trade.pnl !== undefined && (
          <View className="items-end">
            <Text className="text-foreground-muted text-xs">P&L</Text>
            <Text
              className={`text-sm font-semibold ${
                Number(trade.pnl) >= 0 ? 'text-success' : 'text-error'
              }`}
            >
              {Number(trade.pnl) >= 0 ? '+' : ''}
              {Number(trade.pnl).toFixed(4)} SOL
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
