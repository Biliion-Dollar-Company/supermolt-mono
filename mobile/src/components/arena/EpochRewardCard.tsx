import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import type { EpochReward } from '@/types/arena';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtBig(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return fmt(n);
}

export function EpochRewardCard({ rewards }: { rewards: EpochReward }) {
  const { epoch, allocations, treasury } = rewards;
  if (!epoch) return null;

  const vaultBalance = treasury.balance > 0 ? treasury.balance : epoch.usdcPool;
  const isLive = treasury.balance > 0;
  const isActive = epoch.status === 'ACTIVE';
  const topAllocations = allocations.slice(0, 3);

  // Epoch timeline
  const start = new Date(epoch.startAt).getTime();
  const end = new Date(epoch.endAt).getTime();
  const now = Date.now();
  const progress = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));

  return (
    <View style={styles.wrapper}>
      {/* Amber gradient bg */}
      <LinearGradient
        colors={['rgba(245,158,11,0.10)', 'rgba(249,115,22,0.04)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Top border glow */}
      <View style={styles.topGlow} />

      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.trophyWrap}>
          <Ionicons name="trophy" size={20} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.seasonLabel}>SEASON {epoch.number}</Text>
          <Text style={styles.epochName} numberOfLines={1}>{epoch.name}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          {
            backgroundColor: isActive ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.06)',
            borderColor: isActive ? 'rgba(34,197,94,0.30)' : 'rgba(255,255,255,0.10)',
          },
        ]}>
          {isActive && <View style={styles.pulseDot} />}
          <Text style={[styles.statusText, { color: isActive ? colors.status.success : colors.text.muted }]}>
            {epoch.status}
          </Text>
        </View>
      </View>

      {/* ── Big vault hero ── */}
      <View style={styles.vaultHero}>
        <Text style={styles.vaultAmount}>{fmtBig(vaultBalance)}</Text>
        <View style={styles.vaultMeta}>
          <Text style={styles.vaultCurrency}>USDC</Text>
          {isLive && (
            <View style={styles.onChainChip}>
              <View style={styles.onChainDot} />
              <Text style={styles.onChainText}>LIVE VAULT</Text>
            </View>
          )}
        </View>
        <Text style={styles.vaultSubLabel}>PRIZE POOL</Text>
      </View>

      {/* ── Timeline bar (active only) ── */}
      {isActive && (
        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={['#F59E0B', '#F97316']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressCaption}>{Math.round(progress * 100)}% complete</Text>
            <Text style={styles.progressCaption}>{daysLeft}d remaining</Text>
          </View>
        </View>
      )}

      <View style={styles.divider} />

      {/* ── Treasury breakdown ── */}
      <View style={styles.treasuryRow}>
        <View style={styles.treasuryCol}>
          <Text style={styles.treasuryLabel}>VAULT</Text>
          <Text style={styles.treasuryValue}>{fmt(treasury.balance)}</Text>
          <Text style={styles.treasuryCurrency}>USDC</Text>
        </View>
        <View style={styles.treasuryDivider} />
        <View style={styles.treasuryCol}>
          <Text style={styles.treasuryLabel}>PAID OUT</Text>
          <Text style={[styles.treasuryValue, { color: colors.status.success }]}>{fmt(treasury.distributed)}</Text>
          <Text style={styles.treasuryCurrency}>USDC</Text>
        </View>
        <View style={styles.treasuryDivider} />
        <View style={styles.treasuryCol}>
          <Text style={styles.treasuryLabel}>AVAILABLE</Text>
          <Text style={[styles.treasuryValue, { color: colors.brand.primary }]}>{fmt(treasury.available)}</Text>
          <Text style={styles.treasuryCurrency}>USDC</Text>
        </View>
      </View>

      {/* ── Top prizes ── */}
      {topAllocations.length > 0 && (
        <>
          <View style={styles.divider} />
          <View style={{ gap: 10 }}>
            <Text style={styles.prizeSectionLabel}>TOP PRIZES</Text>
            {topAllocations.map((alloc, i) => {
              const medalColor = RANK_COLORS[i] ?? colors.brand.primary;
              const isPaid = alloc.status === 'completed';
              return (
                <View key={alloc.agentId} style={styles.prizeRow}>
                  {/* Rank medal */}
                  <Text style={styles.prizeMedal}>{RANK_MEDALS[i] ?? `#${alloc.rank}`}</Text>

                  {/* Agent name */}
                  <Text style={styles.prizeAgent} numberOfLines={1}>{alloc.agentName}</Text>

                  {/* Paid badge */}
                  {isPaid && (
                    <View style={styles.paidBadge}>
                      <Ionicons name="checkmark-circle" size={10} color={colors.status.success} />
                      <Text style={styles.paidText}>PAID</Text>
                    </View>
                  )}

                  {/* Amount */}
                  <View style={styles.prizeAmountWrap}>
                    <Text style={[styles.prizeAmount, { color: isPaid ? colors.status.success : medalColor }]}>
                      {fmt(alloc.usdcAmount, 2)}
                    </Text>
                    <Text style={styles.prizeCurrencyLabel}>USDC</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    gap: 14,
    position: 'relative',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: '8%',
    right: '8%',
    height: 1,
    backgroundColor: '#F59E0B',
    opacity: 0.55,
    borderRadius: 1,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trophyWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonLabel: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  epochName: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.status.success,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  // Vault hero
  vaultHero: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  vaultAmount: {
    color: colors.text.primary,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 60,
    fontVariant: ['tabular-nums'],
  },
  vaultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  vaultCurrency: {
    color: colors.text.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  onChainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.22)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  onChainDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.status.success,
  },
  onChainText: {
    color: colors.status.success,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  vaultSubLabel: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 6,
    opacity: 0.6,
  },

  // Timeline
  progressSection: {
    gap: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressCaption: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '600',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Treasury
  treasuryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  treasuryCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  treasuryLabel: {
    color: colors.text.muted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  treasuryValue: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  treasuryCurrency: {
    color: colors.text.muted,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1,
  },
  treasuryDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'stretch',
  },

  // Prizes
  prizeSectionLabel: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prizeMedal: {
    fontSize: 20,
    width: 26,
    textAlign: 'center',
  },
  prizeAgent: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paidText: {
    color: colors.status.success,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  prizeAmountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  prizeAmount: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  prizeCurrencyLabel: {
    color: colors.text.muted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
