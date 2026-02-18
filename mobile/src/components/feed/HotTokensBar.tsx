import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import type { ActiveToken } from '@/types/arena';

interface HotTokensBarProps {
  tokens: ActiveToken[];
  selectedMint: string | null;
  onSelect: (mint: string | null) => void;
}

export function HotTokensBar({ tokens, selectedMint, onSelect }: HotTokensBarProps) {
  if (tokens.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text variant="caption" color="muted" style={styles.headerLabel}>
          HOT TOKENS
        </Text>
        {selectedMint && (
          <Pressable onPress={() => onSelect(null)}>
            <Text variant="caption" style={styles.clearBtn}>CLEAR</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tokens.map((token) => {
          const isSelected = selectedMint === token.tokenMint;
          const pnlColor = token.netPnl >= 0 ? colors.status.success : colors.status.error;

          return (
            <Pressable
              key={token.tokenMint}
              onPress={() => onSelect(isSelected ? null : token.tokenMint)}
              style={[
                styles.tokenCard,
                isSelected && styles.tokenCardSelected,
              ]}
            >
              {/* Symbol + score */}
              <View style={styles.tokenTop}>
                <Text style={styles.tokenSymbol}>${token.tokenSymbol}</Text>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>{token.activityScore}</Text>
                </View>
              </View>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <StatPill label="Agents" value={token.agentCount} color="#22d3ee" />
                <StatPill label="Trades" value={token.tradeCount} color="#22c55e" />
                <StatPill label="Chats" value={token.conversationCount} color="#a78bfa" />
              </View>

              {/* PnL */}
              <Text style={[styles.pnl, { color: pnlColor }]}>
                {token.netPnl >= 0 ? '+' : ''}{formatPnl(token.netPnl)} SOL
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  if (value === 0) return null;
  return (
    <View style={[styles.statPill, { backgroundColor: `${color}10` }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: `${color}99` }]}>{label}</Text>
    </View>
  );
}

function formatPnl(v: number): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  return abs < 0.1 ? v.toFixed(2) : v.toFixed(1);
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  clearBtn: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.brand.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tokenCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 10,
    minWidth: 140,
    gap: 6,
  },
  tokenCardSelected: {
    borderColor: colors.brand.primary + '40',
    backgroundColor: colors.brand.primary + '08',
  },
  tokenTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenSymbol: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  scoreBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  scoreText: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statValue: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '600',
  },
  pnl: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
