import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card } from '@/components/ui';
import { colors } from '@/theme/colors';
import { useAuthContext } from '@/lib/auth/provider';
import { mediumImpact, successNotification, errorNotification } from '@/lib/haptics';
import {
  getAgentConfig,
  updateAgentConfig,
  addTrackedWallet,
  removeTrackedWallet,
  type AgentConfiguration,
  type BuyTriggerConfig,
} from '@/lib/api/client';

const DEFAULT_TRIGGERS: BuyTriggerConfig[] = [
  { type: 'godwallet', enabled: true, config: { autoBuyAmount: 0.1 } },
  { type: 'consensus', enabled: false, config: { walletCount: 2, timeWindowMinutes: 60 } },
  { type: 'volume', enabled: false, config: { volumeThreshold: 100000, autoBuyAmount: 0.05 } },
  { type: 'liquidity', enabled: false, config: { minLiquidity: 50000, autoBuyAmount: 0.05 } },
  { type: 'trending', enabled: false, config: { minActivityScore: 20, autoBuyAmount: 0.05 } },
];

function truncateAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ConfigureAgentScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();

  const [config, setConfig] = useState<AgentConfiguration | null>(null);
  const [triggers, setTriggers] = useState<BuyTriggerConfig[]>(DEFAULT_TRIGGERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add wallet form
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newChain, setNewChain] = useState<'SOLANA' | 'BSC'>('SOLANA');

  const fetchConfig = useCallback(async () => {
    try {
      const data = await getAgentConfig();
      setConfig(data);
      setTriggers(data.buyTriggers.length > 0 ? data.buyTriggers : DEFAULT_TRIGGERS);
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchConfig();
  }, [isAuthenticated, fetchConfig]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConfig();
    setRefreshing(false);
  }, [fetchConfig]);

  // ── Wallet Actions ──

  const handleAddWallet = async () => {
    if (!newAddress.trim()) return;
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
      Alert.alert('Error', err.message || 'Failed to add wallet');
      errorNotification();
    }
  };

  const handleRemoveWallet = (walletId: string, label: string) => {
    mediumImpact();
    Alert.alert('Remove Wallet', `Remove ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeTrackedWallet(walletId);
            setConfig((prev) =>
              prev ? { ...prev, trackedWallets: prev.trackedWallets.filter((w) => w.id !== walletId) } : prev
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
    mediumImpact();
    setTriggers((prev) =>
      prev.map((t) => (t.type === type ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const updateTriggerConfig = (type: string, patch: Record<string, any>) => {
    setTriggers((prev) =>
      prev.map((t) => (t.type === type ? { ...t, config: { ...t.config, ...patch } } : t))
    );
  };

  // ── Save ──

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAgentConfig({ triggers });
      successNotification();
      Alert.alert('Saved', 'Trigger configuration saved.');
    } catch (err: any) {
      errorNotification();
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </SafeAreaView>
    );
  }

  const wallets = config?.trackedWallets ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.surface.tertiary }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h3" color="primary" style={{ flex: 1 }}>Configure Agent</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: colors.brand.primary,
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 8,
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text variant="caption" style={{ color: '#000', fontWeight: '700' }}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
      >
        {/* ── Tracked Wallets ── */}
        <View style={{ backgroundColor: colors.surface.secondary, borderRadius: 12, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text variant="body" color="primary" style={{ fontWeight: '700' }}>Tracked Wallets</Text>
              <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                Monitor these wallets for trading signals
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddWallet(!showAddWallet)}
              style={{ backgroundColor: colors.brand.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
            >
              <Ionicons name={showAddWallet ? 'close' : 'add'} size={18} color={colors.brand.primary} />
            </TouchableOpacity>
          </View>

          {/* Add wallet form */}
          {showAddWallet && (
            <View style={{ gap: 8, padding: 10, backgroundColor: colors.surface.tertiary, borderRadius: 8 }}>
              {/* Chain selector */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['SOLANA', 'BSC'] as const).map((chain) => (
                  <TouchableOpacity
                    key={chain}
                    onPress={() => setNewChain(chain)}
                    style={{
                      flex: 1,
                      paddingVertical: 6,
                      borderRadius: 6,
                      alignItems: 'center',
                      backgroundColor: newChain === chain ? colors.brand.primary + '25' : 'transparent',
                      borderWidth: 1,
                      borderColor: newChain === chain ? colors.brand.primary + '50' : colors.surface.tertiary,
                    }}
                  >
                    <Text variant="caption" color={newChain === chain ? 'brand' : 'muted'} style={{ fontWeight: '600' }}>
                      {chain}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                placeholder={newChain === 'SOLANA' ? 'Solana address...' : '0x address...'}
                placeholderTextColor={colors.text.muted}
                value={newAddress}
                onChangeText={setNewAddress}
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, fontFamily: 'monospace', fontSize: 12 }}
                autoCapitalize="none"
              />
              <TextInput
                placeholder="Label (optional)"
                placeholderTextColor={colors.text.muted}
                value={newLabel}
                onChangeText={setNewLabel}
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, fontSize: 13 }}
              />
              <TouchableOpacity
                onPress={handleAddWallet}
                disabled={!newAddress.trim()}
                style={{
                  backgroundColor: newAddress.trim() ? colors.brand.primary : colors.surface.tertiary,
                  paddingVertical: 8,
                  borderRadius: 6,
                  alignItems: 'center',
                }}
              >
                <Text variant="caption" style={{ color: newAddress.trim() ? '#000' : colors.text.muted, fontWeight: '700' }}>
                  Add Wallet
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Wallet list */}
          {wallets.length > 0 ? (
            <View style={{ gap: 6 }}>
              {wallets.map((w) => (
                <View
                  key={w.id || w.address}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    backgroundColor: colors.surface.tertiary,
                    borderRadius: 8,
                  }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: w.chain === 'BSC' ? '#F59E0B' : '#9945FF' }} />
                  <Text variant="caption" color="primary" style={{ fontFamily: 'monospace', flex: 1 }}>
                    {w.label || truncateAddress(w.address)}
                  </Text>
                  <Text variant="caption" color="muted" style={{ fontSize: 9 }}>{w.chain}</Text>
                  <TouchableOpacity onPress={() => handleRemoveWallet(w.id!, w.label || truncateAddress(w.address))}>
                    <Ionicons name="close-circle" size={18} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            !showAddWallet && (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="wallet-outline" size={28} color={colors.text.muted} />
                <Text variant="caption" color="muted" style={{ marginTop: 4 }}>No wallets tracked</Text>
              </View>
            )
          )}
        </View>

        {/* ── Buy Triggers ── */}
        <View style={{ backgroundColor: colors.surface.secondary, borderRadius: 12, padding: 14, gap: 10 }}>
          <View>
            <Text variant="body" color="primary" style={{ fontWeight: '700' }}>Buy Triggers</Text>
            <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
              Auto-queue buys when these conditions are met
            </Text>
          </View>

          {/* God Wallet Copy */}
          <TriggerRow
            title="God Wallet Copy"
            subtitle="Auto-buy when a tracked wallet buys"
            enabled={triggers.find((t) => t.type === 'godwallet')?.enabled ?? false}
            onToggle={() => toggleTrigger('godwallet')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="caption" color="muted">Buy:</Text>
              <TextInput
                value={String(triggers.find((t) => t.type === 'godwallet')?.config.autoBuyAmount ?? 0.1)}
                onChangeText={(v) => updateTriggerConfig('godwallet', { autoBuyAmount: parseFloat(v) || 0.1 })}
                keyboardType="decimal-pad"
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, width: 60, fontSize: 12, textAlign: 'center' }}
              />
              <Text variant="caption" color="muted">SOL</Text>
            </View>
          </TriggerRow>

          {/* Consensus */}
          <TriggerRow
            title="Consensus Buy"
            subtitle="Multiple wallets buy same token"
            enabled={triggers.find((t) => t.type === 'consensus')?.enabled ?? false}
            onToggle={() => toggleTrigger('consensus')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text variant="caption" color="muted">When</Text>
              <TextInput
                value={String(triggers.find((t) => t.type === 'consensus')?.config.walletCount ?? 2)}
                onChangeText={(v) => updateTriggerConfig('consensus', { walletCount: parseInt(v) || 2 })}
                keyboardType="number-pad"
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, width: 36, fontSize: 12, textAlign: 'center' }}
              />
              <Text variant="caption" color="muted">wallets buy within</Text>
              <TextInput
                value={String(triggers.find((t) => t.type === 'consensus')?.config.timeWindowMinutes ?? 60)}
                onChangeText={(v) => updateTriggerConfig('consensus', { timeWindowMinutes: parseInt(v) || 60 })}
                keyboardType="number-pad"
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, width: 50, fontSize: 12, textAlign: 'center' }}
              />
              <Text variant="caption" color="muted">min</Text>
            </View>
          </TriggerRow>

          {/* Volume Spike */}
          <TriggerRow
            title="Volume Spike"
            subtitle="24h volume exceeds threshold"
            enabled={triggers.find((t) => t.type === 'volume')?.enabled ?? false}
            onToggle={() => toggleTrigger('volume')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text variant="caption" color="muted">Above $</Text>
              <TextInput
                value={String(triggers.find((t) => t.type === 'volume')?.config.volumeThreshold ?? 100000)}
                onChangeText={(v) => updateTriggerConfig('volume', { volumeThreshold: parseInt(v) || 100000 })}
                keyboardType="number-pad"
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, width: 80, fontSize: 12, textAlign: 'center' }}
              />
              <Text variant="caption" color="muted">| Buy:</Text>
              <TextInput
                value={String(triggers.find((t) => t.type === 'volume')?.config.autoBuyAmount ?? 0.05)}
                onChangeText={(v) => updateTriggerConfig('volume', { autoBuyAmount: parseFloat(v) || 0.05 })}
                keyboardType="decimal-pad"
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, width: 60, fontSize: 12, textAlign: 'center' }}
              />
              <Text variant="caption" color="muted">SOL</Text>
            </View>
          </TriggerRow>

          {/* Liquidity Gate */}
          <TriggerRow
            title="Liquidity Gate"
            subtitle="Only buy tokens with sufficient liquidity"
            enabled={triggers.find((t) => t.type === 'liquidity')?.enabled ?? false}
            onToggle={() => toggleTrigger('liquidity')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text variant="caption" color="muted">Min $</Text>
              <TextInput
                value={String(triggers.find((t) => t.type === 'liquidity')?.config.minLiquidity ?? 50000)}
                onChangeText={(v) => updateTriggerConfig('liquidity', { minLiquidity: parseInt(v) || 50000 })}
                keyboardType="number-pad"
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, width: 80, fontSize: 12, textAlign: 'center' }}
              />
              <Text variant="caption" color="muted">| Buy:</Text>
              <TextInput
                value={String(triggers.find((t) => t.type === 'liquidity')?.config.autoBuyAmount ?? 0.05)}
                onChangeText={(v) => updateTriggerConfig('liquidity', { autoBuyAmount: parseFloat(v) || 0.05 })}
                keyboardType="decimal-pad"
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, width: 60, fontSize: 12, textAlign: 'center' }}
              />
              <Text variant="caption" color="muted">SOL</Text>
            </View>
          </TriggerRow>

          {/* Trending Tokens */}
          <TriggerRow
            title="Trending Tokens"
            subtitle="Auto-buy tokens with high arena activity"
            enabled={triggers.find((t) => t.type === 'trending')?.enabled ?? false}
            onToggle={() => toggleTrigger('trending')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text variant="caption" color="muted">Min score:</Text>
              <TextInput
                value={String(triggers.find((t) => t.type === 'trending')?.config.minActivityScore ?? 20)}
                onChangeText={(v) => updateTriggerConfig('trending', { minActivityScore: parseInt(v) || 20 })}
                keyboardType="number-pad"
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, width: 50, fontSize: 12, textAlign: 'center' }}
              />
              <Text variant="caption" color="muted">| Buy:</Text>
              <TextInput
                value={String(triggers.find((t) => t.type === 'trending')?.config.autoBuyAmount ?? 0.05)}
                onChangeText={(v) => updateTriggerConfig('trending', { autoBuyAmount: parseFloat(v) || 0.05 })}
                keyboardType="decimal-pad"
                style={{ backgroundColor: colors.surface.primary, color: colors.text.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, width: 60, fontSize: 12, textAlign: 'center' }}
              />
              <Text variant="caption" color="muted">SOL</Text>
            </View>
          </TriggerRow>
        </View>

        {/* Safety info */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: colors.surface.secondary, borderRadius: 8 }}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.brand.primary} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="secondary" style={{ fontWeight: '600' }}>Safety Limits</Text>
            <Text variant="caption" color="muted" style={{ fontSize: 10, marginTop: 2 }}>
              Max 5 auto-buys/day per agent, 60s cooldown between buys, max 10 open positions, min $5k liquidity, min $10k market cap.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TriggerRow({
  title,
  subtitle,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{
      borderRadius: 8,
      padding: 10,
      backgroundColor: enabled ? colors.brand.primary + '08' : 'transparent',
      borderWidth: 1,
      borderColor: enabled ? colors.brand.primary + '30' : colors.surface.tertiary,
      gap: 6,
    }}>
      <TouchableOpacity onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Ionicons
          name={enabled ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color={enabled ? colors.status.success : colors.text.muted}
          style={{ marginTop: 1 }}
        />
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>{title}</Text>
          <Text variant="caption" color="muted" style={{ fontSize: 10 }}>{subtitle}</Text>
        </View>
      </TouchableOpacity>
      {enabled && <View style={{ marginLeft: 28 }}>{children}</View>}
    </View>
  );
}
