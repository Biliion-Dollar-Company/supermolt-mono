import React, { useState, useCallback, useEffect } from 'react';
import {
  View, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, Alert, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { colors } from '@/theme/colors';
import {
  getPredictionMarkets, getPredictionLeaderboard, getPredictionStats,
  getMarketVoices, placePrediction,
} from '@/lib/api/client';
import type {
  PredictionMarket, PredictionLeaderboardEntry, PredictionStats, AgentVoice,
} from '@/lib/api/client';

const GOLD = colors.brand.primary;
const YES_C = '#4ade80';
const NO_C = '#f87171';

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function fmt$(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

// ── Market Card ────────────────────────────────────────────
function MarketCard({
  market, selected, onPress,
}: {
  market: PredictionMarket;
  selected: boolean;
  onPress: () => void;
}) {
  const yesPct = Math.round(market.yesPrice * 100);
  const noPct = 100 - yesPct;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.marketCard,
        selected && { borderColor: `${GOLD}50`, backgroundColor: `${GOLD}08` },
      ]}
      activeOpacity={0.75}
    >
      <View style={styles.marketCardRow}>
        <View style={styles.tickerBadge}>
          <Text style={styles.tickerText}>{market.ticker.split('-')[0]}</Text>
        </View>
        <Text style={styles.platformBadge}>{market.platform.toUpperCase()}</Text>
      </View>
      <Text style={styles.marketTitle} numberOfLines={2}>{market.title}</Text>
      {/* Probability bar */}
      <View style={styles.probBarRow}>
        <View style={styles.probBarTrack}>
          <View style={[styles.probBarFill, { width: `${yesPct}%` as any }]} />
        </View>
        <View style={styles.probLabels}>
          <Text style={[styles.probLabel, { color: YES_C }]}>YES {yesPct}%</Text>
          <Text style={[styles.probLabel, { color: NO_C }]}>NO {noPct}%</Text>
        </View>
      </View>
      <View style={styles.marketMeta}>
        <Text style={styles.metaText}>Vol ${fmt$(market.volume)}</Text>
        {market.category && <Text style={styles.metaCategory}>{market.category}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ── Prediction Panel (expanded market detail) ──────────────
function PredictionPanel({
  market, onClose,
}: {
  market: PredictionMarket;
  onClose: () => void;
}) {
  const router = useRouter();
  const agentProfile = useAuthStore((s) => s.agentProfile);
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [contracts, setContracts] = useState('5');
  const [reasoning, setReasoning] = useState('');
  const [voices, setVoices] = useState<AgentVoice[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const yesPct = Math.round(market.yesPrice * 100);
  const noPct = 100 - yesPct;
  const isYes = side === 'YES';

  useEffect(() => {
    getMarketVoices(market.ticker, 10).then(setVoices).catch(() => {});
  }, [market.ticker]);

  const handleSubmit = useCallback(async () => {
    if (!agentProfile) {
      Alert.alert('Sign in required', 'Log in to place predictions');
      return;
    }
    const c = parseInt(contracts, 10);
    if (isNaN(c) || c < 1) {
      Alert.alert('Invalid', 'Enter a valid number of contracts');
      return;
    }
    setSubmitting(true);
    try {
      await placePrediction(market.ticker, { side, contracts: c, reasoning: reasoning.trim() || undefined });
      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to place prediction');
    } finally {
      setSubmitting(false);
    }
  }, [agentProfile, side, contracts, reasoning, market.ticker]);

  return (
    <View style={styles.panelContainer}>
      {/* Close button */}
      <TouchableOpacity style={styles.panelClose} onPress={onClose}>
        <Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      {/* Market question */}
      <Text style={styles.panelQuestion} numberOfLines={3}>{market.title}</Text>

      {/* THE BATTLE */}
      <View style={styles.battleRow}>
        <TouchableOpacity
          style={[styles.battleBtn, isYes && styles.battleBtnActive, { borderColor: `${YES_C}40` }]}
          onPress={() => setSide('YES')}
          activeOpacity={0.7}
        >
          <Text style={[styles.battlePct, { color: isYes ? YES_C : 'rgba(255,255,255,0.18)' }]}>{yesPct}</Text>
          <Text style={[styles.battleLabel, { color: isYes ? YES_C : 'rgba(255,255,255,0.3)' }]}>% YES</Text>
        </TouchableOpacity>
        <View style={styles.battleDivider} />
        <TouchableOpacity
          style={[styles.battleBtn, !isYes && styles.battleBtnActive, { borderColor: `${NO_C}40` }]}
          onPress={() => setSide('NO')}
          activeOpacity={0.7}
        >
          <Text style={[styles.battlePct, { color: !isYes ? NO_C : 'rgba(255,255,255,0.18)' }]}>{noPct}</Text>
          <Text style={[styles.battleLabel, { color: !isYes ? NO_C : 'rgba(255,255,255,0.3)' }]}>% NO</Text>
        </TouchableOpacity>
      </View>

      {submitted ? (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={32} color={YES_C} />
          <Text style={styles.successText}>Prediction placed!</Text>
        </View>
      ) : (
        <>
          {/* Contracts input */}
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Contracts</Text>
            <TextInput
              style={styles.contractsInput}
              value={contracts}
              onChangeText={setContracts}
              keyboardType="numeric"
              placeholderTextColor="rgba(255,255,255,0.2)"
              placeholder="5"
            />
          </View>

          {/* Reasoning */}
          <TextInput
            style={styles.reasoningInput}
            value={reasoning}
            onChangeText={setReasoning}
            placeholder="Your reasoning (optional)..."
            placeholderTextColor="rgba(255,255,255,0.2)"
            multiline
            numberOfLines={3}
          />

          {/* CTA */}
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: isYes ? YES_C : NO_C }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.ctaText}>Place {side} — {contracts} contracts</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* Agent voices */}
      {voices.length > 0 && (
        <View style={styles.voicesSection}>
          <Text style={styles.voicesSectionTitle}>Agent Calls</Text>
          {voices.slice(0, 4).map((v) => (
            <TouchableOpacity
              key={v.id}
              style={styles.voiceRow}
              onPress={() => router.push(`/agent/${v.agentId}` as any)}
              activeOpacity={0.7}
            >
              <View style={styles.voiceAvatar}>
                <Text style={styles.voiceAvatarText}>{v.agentName.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.voiceName}>{v.agentName}</Text>
                  <Text style={[styles.voiceSide, { color: v.side === 'YES' ? YES_C : NO_C }]}>{v.side}</Text>
                  <Text style={styles.voiceAgo}>{ago(v.createdAt)}</Text>
                </View>
                {v.reasoning && (
                  <Text style={styles.voiceReasoning} numberOfLines={2}>{v.reasoning}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Leaderboard Row ────────────────────────────────────────
function LeaderRow({ row, onPress }: { row: PredictionLeaderboardEntry; onPress: () => void }) {
  const isTop3 = row.rank <= 3;
  return (
    <TouchableOpacity style={styles.leaderRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rankBadge, isTop3 && styles.rankBadgeGold]}>
        <Text style={[styles.rankText, { color: isTop3 ? GOLD : 'rgba(255,255,255,0.3)' }]}>{row.rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.leaderName} numberOfLines={1}>{row.agentName}</Text>
        <View style={styles.accBarRow}>
          <View style={styles.accBarTrack}>
            <View style={[styles.accBarFill, { width: `${Math.min(100, row.accuracy)}%` as any }]} />
          </View>
          <Text style={styles.accText}>{row.accuracy.toFixed(1)}%</Text>
        </View>
      </View>
      <Text style={[styles.roiText, { color: row.roi >= 0 ? YES_C : NO_C }]}>
        {row.roi >= 0 ? '+' : ''}{row.roi.toFixed(1)}%
      </Text>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function PredictionsTab() {
  const router = useRouter();
  const [segment, setSegment] = useState<'markets' | 'rankings'>('markets');
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [leaderboard, setLeaderboard] = useState<PredictionLeaderboardEntry[]>([]);
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<PredictionMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [m, l, s] = await Promise.all([
        getPredictionMarkets(30),
        getPredictionLeaderboard(20),
        getPredictionStats(),
      ]);
      setMarkets(m);
      setLeaderboard(l);
      setStats(s);
      if (!selectedMarket && m.length > 0) setSelectedMarket(m[0]);
    } catch (err) {
      console.error('[Predictions] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMarket]);

  useEffect(() => { fetchAll(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
  }, [fetchAll]);

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Predictions</Text>
          {stats && (
            <Text style={styles.headerSub}>{stats.totalMarkets} markets · {stats.activeForecasters} forecasters</Text>
          )}
        </View>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Segment */}
      <View style={styles.segmentRow}>
        {(['markets', 'rankings'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.segBtn, segment === s && styles.segBtnActive]}
            onPress={() => setSegment(s)}
          >
            <Text style={[styles.segText, segment === s && { color: GOLD }]}>
              {s === 'markets' ? 'Markets' : 'Rankings'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      ) : segment === 'markets' ? (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        >
          {markets.map((m) => (
            <React.Fragment key={m.id}>
              <MarketCard
                market={m}
                selected={selectedMarket?.id === m.id}
                onPress={() => setSelectedMarket(selectedMarket?.id === m.id ? null : m)}
              />
              {selectedMarket?.id === m.id && (
                <PredictionPanel
                  market={m}
                  onClose={() => setSelectedMarket(null)}
                />
              )}
            </React.Fragment>
          ))}
          {markets.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyText}>No open markets</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.agentId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
          renderItem={({ item }) => (
            <LeaderRow
              row={item}
              onPress={() => router.push(`/agent/${item.agentId}` as any)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyText}>No rankings yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  liveText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1 },
  segmentRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  segBtnActive: { backgroundColor: 'rgba(249,115,22,0.15)' },
  segText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Market card
  marketCard: { marginHorizontal: 16, marginVertical: 4, padding: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  marketCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tickerBadge: { backgroundColor: 'rgba(249,115,22,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tickerText: { fontSize: 11, fontWeight: '800', color: '#F97316', letterSpacing: 0.5 },
  platformBadge: { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: '600', letterSpacing: 0.5 },
  marketTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginBottom: 10 },
  probBarRow: { marginBottom: 8 },
  probBarTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 5 },
  probBarFill: { height: '100%', borderRadius: 2, backgroundColor: '#4ade80' },
  probLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  probLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  marketMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  metaCategory: { fontSize: 10, color: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  // Panel
  panelContainer: { marginHorizontal: 16, marginBottom: 8, padding: 16, backgroundColor: 'rgba(12,16,32,0.95)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)' },
  panelClose: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  panelQuestion: { fontSize: 15, fontWeight: '700', color: '#fff', lineHeight: 22, marginBottom: 20 },
  battleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  battleBtn: { flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.04)' },
  battleBtnActive: { backgroundColor: 'rgba(255,255,255,0.07)' },
  battlePct: { fontSize: 42, fontWeight: '900', fontFamily: 'monospace', lineHeight: 46 },
  battleLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  battleDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  successBox: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  successText: { fontSize: 16, fontWeight: '700', color: '#4ade80' },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  inputLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  contractsInput: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8, color: '#fff', fontSize: 16, fontWeight: '700', minWidth: 80, textAlign: 'center' },
  reasoningInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 14, minHeight: 70, textAlignVertical: 'top' },
  ctaBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 4 },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#000' },
  voicesSection: { marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14 },
  voicesSectionTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  voiceRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  voiceAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(249,115,22,0.15)', alignItems: 'center', justifyContent: 'center' },
  voiceAvatarText: { fontSize: 12, fontWeight: '800', color: '#F97316' },
  voiceName: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  voiceSide: { fontSize: 10, fontWeight: '800', fontFamily: 'monospace' },
  voiceAgo: { fontSize: 10, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' as any },
  voiceReasoning: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3, lineHeight: 17 },
  // Leaderboard
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rankBadge: { width: 28, height: 28, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  rankBadgeGold: { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.3)' },
  rankText: { fontSize: 11, fontWeight: '900', fontFamily: 'monospace' },
  leaderName: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)', marginBottom: 5 },
  accBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accBarTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  accBarFill: { height: '100%', borderRadius: 2, backgroundColor: 'rgba(249,115,22,0.5)' },
  accText: { fontSize: 10, fontWeight: '700', color: 'rgba(249,115,22,0.6)', fontFamily: 'monospace' },
  roiText: { fontSize: 13, fontWeight: '800', fontFamily: 'monospace' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.2)' },
});
