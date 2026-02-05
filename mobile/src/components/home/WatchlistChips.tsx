/**
 * WatchlistChips - Horizontal scrolling token chips
 * Displays tokens the agent is watching
 */

import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { useState } from 'react';
import type { WatchlistToken } from '@/hooks/useWatchlist';

interface WatchlistChipsProps {
  tokens: WatchlistToken[];
  onTokenPress?: (symbol: string) => void;
}

// Token icon URL generator (using DexScreener)
function getTokenIconUrl(mint?: string): string | null {
  if (!mint) return null;
  return `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`;
}

// Fallback colors for tokens without images
const CHIP_COLORS = [
  '#c4f70e',
  '#22d3ee',
  '#f97316',
  '#8b5cf6',
  '#ec4899',
  '#10b981',
  '#eab308',
];

function TokenChip({
  token,
  index,
  onPress,
}: {
  token: WatchlistToken;
  index: number;
  onPress?: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const iconUrl = getTokenIconUrl(token.mint);
  const showIcon = iconUrl && !imgError;
  const fallbackColor = CHIP_COLORS[index % CHIP_COLORS.length];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        pressed && styles.chipPressed,
      ]}
    >
      {showIcon ? (
        <Image
          source={{ uri: iconUrl }}
          style={styles.tokenIcon}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.tokenIconFallback, { backgroundColor: fallbackColor }]}>
          <Text style={styles.tokenInitial}>{token.symbol[0]}</Text>
        </View>
      )}
      <Text style={styles.tokenSymbol}>{token.symbol}</Text>
    </Pressable>
  );
}

export function WatchlistChips({ tokens, onTokenPress }: WatchlistChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {tokens.map((token, index) => (
        <TokenChip
          key={token.symbol}
          token={token}
          index={index}
          onPress={() => onTokenPress?.(token.symbol)}
        />
      ))}

      {/* Fade indicator for more items */}
      <View style={styles.fadeIndicator}>
        <Text style={styles.moreText}>→</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingRight: 16,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  chipPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tokenIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  tokenIconFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenInitial: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  tokenSymbol: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  fadeIndicator: {
    justifyContent: 'center',
    paddingLeft: 4,
  },
  moreText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 14,
  },
});
