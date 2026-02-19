import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors } from '@/theme/colors';
import { useAuthContext } from '@/lib/auth/provider';
import { mediumImpact, successNotification, errorNotification, selectionFeedback } from '@/lib/haptics';
import {
  getAgentConfig,
  getArchetypes,
  updateAgentConfig,
  addTrackedWallet,
  removeTrackedWallet,
  type AgentConfiguration,
  type BuyTriggerConfig,
} from '@/lib/api/client';
import type { Archetype } from '@/types/arena';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

// ── Gold accent overrides for this screen ──
const GOLD = '#E8B45E';

const DEFAULT_TRIGGERS: BuyTriggerConfig[] = [
  { type: 'godwallet', enabled: true, config: { autoBuyAmount: 0.1 } },
  { type: 'consensus', enabled: false, config: { walletCount: 2, timeWindowMinutes: 60 } },
  { type: 'volume', enabled: false, config: { volumeThreshold: 100000, autoBuyAmount: 0.05 } },
  { type: 'liquidity', enabled: false, config: { minLiquidity: 50000, autoBuyAmount: 0.05 } },
  { type: 'trending', enabled: false, config: { minActivityScore: 20, autoBuyAmount: 0.05 } },
];

// Archetype stat color helper
function statColor(value: number) {
  if (value >= 75) return '#22c55e';
  if (value >= 45) return GOLD;
  return colors.text.muted;
}

function truncateAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Section Header Component ──────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={S.sectionHeader}>
      <View style={S.sectionIconWrap}>
        <Ionicons name={icon as any} size={14} color={GOLD} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={S.sectionTitle}>{title}</Text>
        {subtitle && <Text style={S.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

// ── Stat Bar Component ─────────────────────────────────────

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={S.statBarRow}>
      <Text style={S.statBarLabel}>{label}</Text>
      <View style={S.statBarTrack}>
        <View style={[S.statBarFill, { width: `${value}%`, backgroundColor: statColor(value) }]} />
      </View>
      <Text style={[S.statBarValue, { color: statColor(value) }]}>{value}</Text>
    </View>
  );
}

// ── Archetype Card Component ───────────────────────────────

function ArchetypeCard({
  archetype,
  selected,
  onPress,
}: {
  archetype: Archetype;
  selected: boolean;
  onPress: () => void;
}) {
  const stats = archetype.stats;
  const statEntries = [
    { label: 'Aggression', value: stats.aggression },
    { label: 'Risk', value: stats.riskTolerance },
    { label: 'Speed', value: stats.speed },
    { label: 'Patience', value: stats.patience },
    { label: 'Selective', value: stats.selectivity },
  ];

  return (
    <TouchableOpacity
      onPress={() => { selectionFeedback(); onPress(); }}
      activeOpacity={0.8}
      style={[S.archetypeCard, selected && S.archetypeCardSelected]}
    >
      {/* Glow border for selected */}
      {selected && <View style={S.archetypeGlow} pointerEvents="none" />}

      <View style={S.archetypeHeader}>
        <Text style={S.archetypeEmoji}>{archetype.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={S.archetypeName}>{archetype.name}</Text>
          <Text style={S.archetypeDesc} numberOfLines={2}>{archetype.description}</Text>
        </View>
        {selected && (
          <View style={S.selectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={GOLD} />
          </View>
        )}
      </View>

      <View style={S.statBarsWrap}>
        {statEntries.map((s) => (
          <StatBar key={s.label} label={s.label} value={s.value} />
        ))}
      </View>
    </TouchableOpacity>
  );
}

// ── Trigger Toggle Row ─────────────────────────────────────

function TriggerToggleRow({
  icon,
  title,
  subtitle,
  enabled,
  onToggle,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={[S.triggerRow, enabled && S.triggerRowActive]}>
      <View style={S.triggerTop}>
        <View style={[S.triggerIconWrap, enabled && { backgroundColor: GOLD + '22' }]}>
          <Ionicons name={icon as any} size={16} color={enabled ? GOLD : colors.text.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[S.triggerTitle, enabled && { color: colors.text.primary }]}>{title}</Text>
          <Text style={S.triggerSubtitle}>{subtitle}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={() => { mediumImpact(); onToggle(); }}
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: GOLD + '66' }}
          thumbColor={enabled ? GOLD : colors.text.muted}
          ios_backgroundColor="rgba(255,255,255,0.1)"
        />
      </View>
      {enabled && children && (
        <Animated.View entering={FadeIn.duration(200)} style={S.triggerChildren}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

// ── Numeric Input ─────────────────────────────────────────

function NumInput({
  value,
  onChangeText,
  suffix,
  width = 64,
  keyboardType = 'decimal-pad',
}: {
  value: string;
  onChangeText: (v: string) => void;
  suffix?: string;
  width?: number;
  keyboardType?: 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={S.numInputRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={[S.numInput, { width }]}
        placeholderTextColor={colors.text.muted}
      />
      {suffix && <Text style={S.numSuffix}>{suffix}</Text>}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────

export default function ConfigureTab() {
  const { isAuthenticated } = useAuthContext();

  const [config, setConfig] = useState<AgentConfiguration | null>(null);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<BuyTriggerConfig[]>(DEFAULT_TRIGGERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Wallet form
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newChain, setNewChain] = useState<'SOLANA' | 'BSC'>('SOLANA');
  const [addingWallet, setAddingWallet] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [configData, archetypeData] = await Promise.all([
        getAgentConfig(),
        getArchetypes().catch(() => [] as Archetype[]),
      ]);
      setConfig(configData);
      setSelectedArchetype(configData.archetypeId ?? null);
      setTriggers(configData.buyTriggers?.length > 0 ? configData.buyTriggers : DEFAULT_TRIGGERS);
      if (archetypeData.length > 0) setArchetypes(archetypeData);
    } catch (err) {
      console.error('[ConfigureTab] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchData();
    else setLoading(false);
  }, [isAuthenticated, fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Archetype Actions ──

  const handleSelectArchetype = (id: string) => {
    setSelectedArchetype(id);
  };

  // ── Wallet Actions ──

  const handleAddWallet = async () => {
    if (!newAddress.trim()) return;
    setAddingWallet(true);
    try {
      const wallet = await addTrackedWallet({
        address: newAddress.trim(),
        label: newLabel.trim() || undefined,
        chain: newChain,
      });
      setConfig((prev) =>
        prev ? { ...prev, trackedWallets: [...prev.trackedWallets, wallet] } : prev
      );
      setNewAddress('');
      setNewLabel('');
      setShowAddWallet(false);
      successNotification();
    } catch (err: any) {
      errorNotification();
      Alert.alert('Error', err.message || 'Failed to add wallet');
    } finally {
      setAddingWallet(false);
    }
  };

  const handleRemoveWallet = (walletId: string, label: string) => {
    mediumImpact();
    Alert.alert('Remove Wallet', `Remove "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeTrackedWallet(walletId);
            setConfig((prev) =>
              prev
                ? { ...prev, trackedWallets: prev.trackedWallets.filter((w) => w.id !== walletId) }
                : prev
            );
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to remove wallet');
          }
        },
      },
    ]);
  };

  // ── Trigger Actions ──

  const toggleTrigger = (type: string) => {
    setTriggers((prev) => prev.map((t) => (t.type === type ? { ...t, enabled: !t.enabled } : t)));
  };

  const updateTriggerConfig = (type: string, patch: Record<string, any>) => {
    setTriggers((prev) =>
      prev.map((t) => (t.type === type ? { ...t, config: { ...t.config, ...patch } } : t))
    );
  };

  const getTrigger = (type: string) => triggers.find((t) => t.type === type);

  // ── Save ──

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAgentConfig({
        archetypeId: selectedArchetype ?? undefined,
        triggers,
      });
      successNotification();
      Alert.alert('Saved ✓', 'Agent configuration updated successfully.');
    } catch (err: any) {
      errorNotification();
      Alert.alert('Error', err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // ── Unauthenticated State ──

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={S.centeredState} edges={['top']}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.text.muted} />
        <Text style={S.emptyTitle}>Sign in required</Text>
        <Text style={S.emptySubtitle}>Log in to configure your agent</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={S.centeredState} edges={['top']}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={S.loadingText}>Loading configuration...</Text>
      </SafeAreaView>
    );
  }

  const wallets = config?.trackedWallets ?? [];
  const godwallet = getTrigger('godwallet');
  const consensus = getTrigger('consensus');
  const volume = getTrigger('volume');
  const liquidity = getTrigger('liquidity');
  const trending = getTrigger('trending');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      {/* ── Header ── */}
      <View style={S.header}>
        <View>
          <Text style={S.headerTitle}>CONFIGURE</Text>
          <Text style={S.headerSubtitle}>Agent Intelligence Settings</Text>
        </View>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[S.saveBtn, saving && { opacity: 0.5 }]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="checkmark" size={14} color="#000" />
              <Text style={S.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={S.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Archetype Selection ── */}
        <Animated.View entering={FadeInDown.duration(400).springify()}>
          <View style={S.section}>
            <SectionHeader
              icon="flash-outline"
              title="Archetype"
              subtitle="Defines your agent's trading personality"
            />

            {archetypes.length === 0 ? (
              <View style={S.skeletonWrap}>
                {[1, 2].map((i) => (
                  <View key={i} style={S.archetypeSkeleton} />
                ))}
              </View>
            ) : (
              <View style={S.archetypeGrid}>
                {archetypes.map((arch) => (
                  <ArchetypeCard
                    key={arch.id}
                    archetype={arch}
                    selected={selectedArchetype === arch.id}
                    onPress={() => handleSelectArchetype(arch.id)}
                  />
                ))}
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── 2. Tracked Wallets ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(80).springify()}>
          <View style={S.section}>
            <View style={S.sectionHeaderRow}>
              <SectionHeader
                icon="wallet-outline"
                title="Tracked Wallets"
                subtitle="Copy-trade these wallets for signals"
              />
              <TouchableOpacity
                onPress={() => { selectionFeedback(); setShowAddWallet(!showAddWallet); }}
                style={[S.addBtn, showAddWallet && S.addBtnActive]}
              >
                <Ionicons name={showAddWallet ? 'close' : 'add'} size={16} color={showAddWallet ? colors.status.error : GOLD} />
              </TouchableOpacity>
            </View>

            {/* Add wallet form */}
            {showAddWallet && (
              <Animated.View entering={FadeInDown.duration(300)} style={S.addWalletForm}>
                {/* Chain selector */}
                <View style={S.chainSelector}>
                  {(['SOLANA', 'BSC'] as const).map((chain) => (
                    <TouchableOpacity
                      key={chain}
                      onPress={() => setNewChain(chain)}
                      style={[S.chainBtn, newChain === chain && S.chainBtnActive]}
                    >
                      <Text style={[S.chainBtnText, newChain === chain && S.chainBtnTextActive]}>
                        {chain === 'SOLANA' ? '◎ Solana' : '⬡ BSC'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  placeholder={newChain === 'SOLANA' ? 'Solana address (e.g. 7dRo...)' : 'BSC address (0x...)'}
                  placeholderTextColor={colors.text.muted}
                  value={newAddress}
                  onChangeText={setNewAddress}
                  style={S.walletInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  placeholder="Label (e.g. God Wallet #1)"
                  placeholderTextColor={colors.text.muted}
                  value={newLabel}
                  onChangeText={setNewLabel}
                  style={S.walletLabelInput}
                />

                <TouchableOpacity
                  onPress={handleAddWallet}
                  disabled={!newAddress.trim() || addingWallet}
                  style={[S.addWalletBtn, (!newAddress.trim() || addingWallet) && S.addWalletBtnDisabled]}
                >
                  {addingWallet ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={14} color={newAddress.trim() ? '#000' : colors.text.muted} />
                      <Text style={[S.addWalletBtnText, !newAddress.trim() && { color: colors.text.muted }]}>
                        Add Wallet
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Wallet list */}
            {wallets.length > 0 ? (
              <View style={S.walletList}>
                {wallets.map((w, i) => (
                  <Animated.View key={w.id || w.address} entering={FadeIn.delay(i * 30)}>
                    <View style={S.walletRow}>
                      <View
                        style={[
                          S.chainDot,
                          { backgroundColor: w.chain === 'BSC' ? '#F59E0B' : '#9945FF' },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        {w.label && (
                          <Text style={S.walletLabel}>{w.label}</Text>
                        )}
                        <Text style={S.walletAddress}>
                          {truncateAddress(w.address)}
                        </Text>
                      </View>
                      <Text style={S.walletChainBadge}>{w.chain}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveWallet(w.id!, w.label || truncateAddress(w.address))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.status.error + 'AA'} />
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                ))}
              </View>
            ) : (
              !showAddWallet && (
                <View style={S.emptyWallets}>
                  <Ionicons name="wallet-outline" size={28} color={colors.text.muted} style={{ opacity: 0.4 }} />
                  <Text style={S.emptyWalletText}>No wallets tracked yet</Text>
                  <Text style={S.emptyWalletHint}>Add wallets to copy-trade their signals</Text>
                </View>
              )
            )}
          </View>
        </Animated.View>

        {/* ── 3. Buy Triggers ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(160).springify()}>
          <View style={S.section}>
            <SectionHeader
              icon="pulse-outline"
              title="Buy Triggers"
              subtitle="Auto-queue buys when conditions are met"
            />

            <View style={S.triggersWrap}>
              {/* God Wallet Copy */}
              <TriggerToggleRow
                icon="eye-outline"
                title="God Wallet Copy"
                subtitle="Auto-buy when a tracked wallet buys"
                enabled={godwallet?.enabled ?? false}
                onToggle={() => toggleTrigger('godwallet')}
              >
                <View style={S.triggerInputRow}>
                  <Text style={S.triggerInputLabel}>Buy amount</Text>
                  <NumInput
                    value={String(godwallet?.config.autoBuyAmount ?? 0.1)}
                    onChangeText={(v) => updateTriggerConfig('godwallet', { autoBuyAmount: parseFloat(v) || 0.1 })}
                    suffix="SOL"
                    width={60}
                  />
                </View>
              </TriggerToggleRow>

              {/* Consensus Buy */}
              <TriggerToggleRow
                icon="people-outline"
                title="Consensus Buy"
                subtitle="Multiple tracked wallets buy the same token"
                enabled={consensus?.enabled ?? false}
                onToggle={() => toggleTrigger('consensus')}
              >
                <View style={S.triggerInputRow}>
                  <Text style={S.triggerInputLabel}>Min wallets</Text>
                  <NumInput
                    value={String(consensus?.config.walletCount ?? 2)}
                    onChangeText={(v) => updateTriggerConfig('consensus', { walletCount: parseInt(v) || 2 })}
                    width={48}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={S.triggerInputRow}>
                  <Text style={S.triggerInputLabel}>Within (min)</Text>
                  <NumInput
                    value={String(consensus?.config.timeWindowMinutes ?? 60)}
                    onChangeText={(v) => updateTriggerConfig('consensus', { timeWindowMinutes: parseInt(v) || 60 })}
                    suffix="min"
                    width={56}
                    keyboardType="number-pad"
                  />
                </View>
              </TriggerToggleRow>

              {/* Volume Spike */}
              <TriggerToggleRow
                icon="trending-up-outline"
                title="Volume Spike"
                subtitle="24h volume exceeds your threshold"
                enabled={volume?.enabled ?? false}
                onToggle={() => toggleTrigger('volume')}
              >
                <View style={S.triggerInputRow}>
                  <Text style={S.triggerInputLabel}>Min volume ($)</Text>
                  <NumInput
                    value={String(volume?.config.volumeThreshold ?? 100000)}
                    onChangeText={(v) => updateTriggerConfig('volume', { volumeThreshold: parseInt(v) || 100000 })}
                    width={80}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={S.triggerInputRow}>
                  <Text style={S.triggerInputLabel}>Buy amount</Text>
                  <NumInput
                    value={String(volume?.config.autoBuyAmount ?? 0.05)}
                    onChangeText={(v) => updateTriggerConfig('volume', { autoBuyAmount: parseFloat(v) || 0.05 })}
                    suffix="SOL"
                    width={60}
                  />
                </View>
              </TriggerToggleRow>

              {/* Liquidity Gate */}
              <TriggerToggleRow
                icon="shield-checkmark-outline"
                title="Liquidity Gate"
                subtitle="Only buy tokens with sufficient liquidity"
                enabled={liquidity?.enabled ?? false}
                onToggle={() => toggleTrigger('liquidity')}
              >
                <View style={S.triggerInputRow}>
                  <Text style={S.triggerInputLabel}>Min liquidity ($)</Text>
                  <NumInput
                    value={String(liquidity?.config.minLiquidity ?? 50000)}
                    onChangeText={(v) => updateTriggerConfig('liquidity', { minLiquidity: parseInt(v) || 50000 })}
                    width={80}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={S.triggerInputRow}>
                  <Text style={S.triggerInputLabel}>Buy amount</Text>
                  <NumInput
                    value={String(liquidity?.config.autoBuyAmount ?? 0.05)}
                    onChangeText={(v) => updateTriggerConfig('liquidity', { autoBuyAmount: parseFloat(v) || 0.05 })}
                    suffix="SOL"
                    width={60}
                  />
                </View>
              </TriggerToggleRow>

              {/* Trending Tokens */}
              <TriggerToggleRow
                icon="flame-outline"
                title="Trending Tokens"
                subtitle="Auto-buy tokens with high arena activity score"
                enabled={trending?.enabled ?? false}
                onToggle={() => toggleTrigger('trending')}
              >
                <View style={S.triggerInputRow}>
                  <Text style={S.triggerInputLabel}>Min activity score</Text>
                  <NumInput
                    value={String(trending?.config.minActivityScore ?? 20)}
                    onChangeText={(v) => updateTriggerConfig('trending', { minActivityScore: parseInt(v) || 20 })}
                    width={56}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={S.triggerInputRow}>
                  <Text style={S.triggerInputLabel}>Buy amount</Text>
                  <NumInput
                    value={String(trending?.config.autoBuyAmount ?? 0.05)}
                    onChangeText={(v) => updateTriggerConfig('trending', { autoBuyAmount: parseFloat(v) || 0.05 })}
                    suffix="SOL"
                    width={60}
                  />
                </View>
              </TriggerToggleRow>
            </View>
          </View>
        </Animated.View>

        {/* ── Safety Info Banner ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(240).springify()}>
          <View style={S.safetyBanner}>
            <Ionicons name="shield-half-outline" size={18} color={GOLD} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={S.safetyTitle}>Safety Limits Always Active</Text>
              <Text style={S.safetyText}>
                Max 5 auto-buys/day · 60s cooldown · Max 10 open positions · Min $5k liquidity · Min $10k market cap
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Bottom save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[S.bottomSaveBtn, saving && { opacity: 0.5 }]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="save-outline" size={16} color="#000" />
              <Text style={S.bottomSaveBtnText}>Save Configuration</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────

const S = StyleSheet.create({
  centeredState: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: colors.text.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  loadingText: {
    color: colors.text.muted,
    fontSize: 13,
    marginTop: 8,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232,180,94,0.10)',
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  headerSubtitle: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: GOLD,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },

  // ── Scroll content
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },

  // ── Sections
  section: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(232,180,94,0.10)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: GOLD + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },

  // ── Archetypes
  skeletonWrap: {
    gap: 10,
  },
  archetypeSkeleton: {
    height: 160,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  archetypeGrid: {
    gap: 10,
  },
  archetypeCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
    overflow: 'hidden',
  },
  archetypeCardSelected: {
    borderColor: GOLD + '80',
    backgroundColor: GOLD + '08',
  },
  archetypeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GOLD + '30',
  },
  archetypeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  archetypeEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  archetypeName: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  archetypeDesc: {
    color: colors.text.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  selectedBadge: {
    marginLeft: 'auto',
  },

  // ── Stat bars
  statBarsWrap: {
    gap: 6,
  },
  statBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statBarLabel: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '600',
    width: 60,
  },
  statBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  statBarValue: {
    fontSize: 10,
    fontWeight: '700',
    width: 24,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  // ── Add wallet button
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: GOLD + '18',
    borderWidth: 1,
    borderColor: GOLD + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.30)',
  },

  // ── Add wallet form
  addWalletForm: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  chainSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  chainBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chainBtnActive: {
    backgroundColor: GOLD + '18',
    borderColor: GOLD + '50',
  },
  chainBtnText: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  chainBtnTextActive: {
    color: GOLD,
  },
  walletInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.text.primary,
    fontFamily: 'monospace',
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  walletLabelInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.text.primary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  addWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: GOLD,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addWalletBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  addWalletBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },

  // ── Wallet list
  walletList: {
    gap: 6,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  chainDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  walletLabel: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 1,
  },
  walletAddress: {
    color: colors.text.muted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  walletChainBadge: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // ── Empty wallets
  emptyWallets: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  emptyWalletText: {
    color: colors.text.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyWalletHint: {
    color: colors.text.muted,
    fontSize: 11,
    opacity: 0.7,
  },

  // ── Triggers
  triggersWrap: {
    gap: 8,
  },
  triggerRow: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  triggerRowActive: {
    backgroundColor: GOLD + '07',
    borderColor: GOLD + '25',
  },
  triggerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  triggerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerTitle: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  triggerSubtitle: {
    color: colors.text.muted,
    fontSize: 10,
    lineHeight: 13,
  },
  triggerChildren: {
    gap: 8,
    paddingLeft: 40,
    paddingTop: 4,
  },
  triggerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerInputLabel: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Numeric input
  numInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  numInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: GOLD,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    borderWidth: 1,
    borderColor: 'rgba(232,180,94,0.25)',
  },
  numSuffix: {
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Safety banner
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: GOLD + '0A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: GOLD + '25',
  },
  safetyTitle: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  safetyText: {
    color: colors.text.muted,
    fontSize: 10.5,
    lineHeight: 15,
  },

  // ── Bottom save
  bottomSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  bottomSaveBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
