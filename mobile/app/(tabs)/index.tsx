import { ScrollView, View, RefreshControl, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line } from 'react-native-svg';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Text } from '@/components/ui';
import { AgentCard, PortfolioHero, PnLChart, TerminalLog, WatchlistChips } from '@/components/home';
import { PositionCard } from '@/components/trading';
import { useMyAgent } from '@/hooks/useMyAgent';
import { usePnLHistory } from '@/hooks/usePnLHistory';
import { usePositions } from '@/hooks/usePositions';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useAgentLiveStore } from '@/store/agentLive';
import { useAuthStore } from '@/store/auth';
import { TradeRecommendationAlert } from '@/components/trading/TradeRecommendationAlert';
import { colors } from '@/theme/colors';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;

function SectionHeader({ label, count, icon }: { label: string; count?: number; icon?: string }) {
  return (
    <View style={sectionStyles.header}>
      {icon && <Ionicons name={icon as any} size={12} color={colors.brand.primary} style={{ opacity: 0.6 }} />}
      <Text style={sectionStyles.label}>{label}</Text>
      {count != null && (
        <View style={sectionStyles.countBadge}>
          <Text style={sectionStyles.countText}>{count}</Text>
        </View>
      )}
      <View style={sectionStyles.headerLine} />
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
  delay = 0,
}: {
  label: string;
  value: string;
  color?: string;
  icon: string;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={cardStyles.card}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.01)']}
        style={StyleSheet.absoluteFill}
      />
      {/* Top glow line */}
      <View style={[cardStyles.glowLine, { backgroundColor: color || colors.brand.primary }]} />
      <View style={cardStyles.iconRow}>
        <Ionicons name={icon as any} size={14} color={color || colors.text.muted} style={{ opacity: 0.5 }} />
      </View>
      <Text style={[cardStyles.cardValue, color ? { color } : null]}>{value}</Text>
      <Text style={cardStyles.cardLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function HomeTab() {
  const { agent, refresh: refreshAgent } = useMyAgent();
  const pnl = usePnLHistory();
  const { positions, refresh: refreshPositions } = usePositions();
  const { watchlist } = useWatchlist();
  const agentLive = useAgentLiveStore();
  const agentProfile = useAuthStore((s) => s.agentProfile);
  const stats = useAuthStore((s) => s.stats);

  const [refreshing, setRefreshing] = useState(false);

  // Ambient animation
  const ambientPulse = useSharedValue(0);
  useEffect(() => {
    ambientPulse.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      -1, true,
    );
  }, []);

  const ambientStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ambientPulse.value, [0, 0.5, 1], [0.04, 0.08, 0.04]),
  }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshAgent(), refreshPositions()]);
    setRefreshing(false);
  }, [refreshAgent, refreshPositions]);

  const topPositions = positions.slice(0, 3);
  const latestDecision = agentLive.decisions[0];
  const agentName = agentProfile?.name || agent?.name || 'SuperMolt';
  const isActive = agentLive.status === 'active';

  const totalTrades = agentProfile?.totalTrades ?? stats?.totalTrades ?? 0;
  const winRate = agentProfile?.winRate ?? stats?.winRate ?? 0;
  const totalPnl = agentProfile?.totalPnl ?? stats?.totalPnl ?? 0;
  const sortinoRatio = stats?.sortinoRatio ?? 0;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.void[900] }}
      edges={['top']}
    >
      {/* Multi-layer background */}
      <LinearGradient
        colors={['rgba(249, 115, 22, 0.06)', 'transparent', 'rgba(249, 115, 22, 0.02)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow orb */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 60,
            alignSelf: 'center',
            width: 400,
            height: 400,
            borderRadius: 200,
            backgroundColor: colors.brand.primary,
          },
          ambientStyle,
        ]}
      />

      {/* Subtle grid overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height="100%" style={{ opacity: 0.4 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <Line
              key={`hg${i}`}
              x1="0" y1={i * 60} x2={SCREEN_WIDTH} y2={i * 60}
              stroke="rgba(255,255,255,0.01)" strokeWidth="0.5"
            />
          ))}
        </Svg>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Trade Recommendation Alert */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <TradeRecommendationAlert />
        </View>

        {/* Agent Identity HUD */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <AgentCard
            name={agentName}
            handle={agentProfile?.twitterHandle ?? undefined}
            avatarUrl={agentProfile?.avatarUrl ?? undefined}
            isActive={isActive}
            level={agentProfile?.level}
            levelName={agentProfile?.levelName}
            xp={agentProfile?.xp}
            xpForNextLevel={agentProfile?.xpForNextLevel}
          />
        </View>

        {/* Portfolio Core — HUD-style hero */}
        <PortfolioHero
          totalValue={pnl.currentValue}
          pnlChange={pnl.pnlChange}
          pnlPercent={pnl.currentValue > 0 ? (pnl.pnlChange / pnl.currentValue) * 100 : 0}
          todayTrades={agentLive.stats.todayTrades}
        />

        {/* Stat Cards with staggered entry */}
        <View style={cardStyles.row}>
          <StatCard
            label="TRADES"
            value={String(totalTrades)}
            icon="swap-vertical-outline"
            delay={0}
          />
          <StatCard
            label="WIN RATE"
            value={`${(winRate * 100).toFixed(0)}%`}
            color={colors.brand.primary}
            icon="trending-up-outline"
            delay={80}
          />
          <StatCard
            label="SORTINO"
            value={sortinoRatio.toFixed(2)}
            color={sortinoRatio >= 1 ? colors.status.success : sortinoRatio > 0 ? colors.brand.accent : colors.status.error}
            icon="shield-checkmark-outline"
            delay={160}
          />
        </View>

        {/* Agent Log — Terminal */}
        <View style={{ paddingHorizontal: 16 }}>
          <TerminalLog
            message={latestDecision?.reason || 'Scanning for alpha...'}
            type={latestDecision?.action === 'buy' ? 'trading' : latestDecision?.action === 'sell' ? 'trading' : 'scanning'}
            decisions={agentLive.decisions}
          />
        </View>

        {/* Performance Chart */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <PnLChart
            data={pnl.data}
            timeframe={pnl.timeframe}
            onTimeframeChange={pnl.changeTimeframe}
            currentValue={pnl.currentValue}
            pnlChange={pnl.pnlChange}
          />
        </View>

        {/* Watchlist */}
        {watchlist.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <SectionHeader label="WATCHLIST" count={watchlist.length} icon="eye-outline" />
            <View style={{ marginTop: 8 }}>
              <WatchlistChips tokens={watchlist} />
            </View>
          </View>
        )}

        {/* Active Positions */}
        {topPositions.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 8 }}>
            <SectionHeader label="ACTIVE POSITIONS" count={positions.length} icon="wallet-outline" />
            {topPositions.map((pos) => (
              <PositionCard key={pos.id} position={pos} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const cardStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  glowLine: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    opacity: 0.4,
    borderRadius: 1,
  },
  iconRow: {
    marginBottom: 2,
  },
  cardValue: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  cardLabel: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  label: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  countBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    color: colors.brand.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
});
