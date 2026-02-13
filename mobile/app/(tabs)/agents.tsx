import { ScrollView, View, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card } from '@/components/ui';
import { colors } from '@/theme/colors';
import { useMyAgents } from '@/hooks/useMyAgents';
import { useAuthContext } from '@/lib/auth/provider';
import { getArchetype } from '@/lib/archetypes';
import { deleteAgentById } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { mediumImpact, errorNotification } from '@/lib/haptics';
import { useState, useCallback } from 'react';
import type { UserAgent } from '@/types/arena';

function AgentRow({
  agent,
  isActive,
  onSwitch,
  onDelete,
  onConfigure,
  isSwitching,
}: {
  agent: UserAgent;
  isActive: boolean;
  onSwitch: () => void;
  onDelete: () => void;
  onConfigure?: () => void;
  isSwitching: boolean;
}) {
  const archetype = getArchetype(agent.archetypeId);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onSwitch}
      onLongPress={onDelete}
      style={{
        backgroundColor: isActive ? colors.brand.primary + '15' : colors.surface.secondary,
        borderRadius: 12,
        padding: 14,
        gap: 8,
        borderWidth: isActive ? 1 : 0,
        borderColor: colors.brand.primary,
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 28 }}>{archetype?.emoji || '🤖'}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="body" color="primary" style={{ fontWeight: '700' }}>
              {agent.displayName || agent.name}
            </Text>
            {isActive && (
              <View style={{
                backgroundColor: colors.brand.primary + '33',
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 4,
              }}>
                <Text variant="caption" color="brand" style={{ fontWeight: '700', fontSize: 9 }}>
                  ACTIVE
                </Text>
              </View>
            )}
          </View>
          <Text variant="caption" color="muted">
            {archetype?.name || agent.archetypeId} | Lv.{agent.level}
          </Text>
        </View>
        {isActive && onConfigure && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onConfigure(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4 }}
          >
            <Ionicons name="settings-outline" size={18} color={colors.brand.primary} />
          </TouchableOpacity>
        )}
        {isSwitching ? (
          <ActivityIndicator size="small" color={colors.brand.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        )}
      </View>

      {/* Stats Row */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatChip
          label="PnL"
          value={`$${Number(agent.totalPnl).toFixed(2)}`}
          color={Number(agent.totalPnl) >= 0 ? colors.status.success : colors.status.error}
        />
        <StatChip label="Trades" value={String(agent.totalTrades)} color={colors.text.secondary} />
        <StatChip
          label="Win"
          value={`${(Number(agent.winRate) * 100).toFixed(0)}%`}
          color={colors.text.secondary}
        />
        <StatChip label="XP" value={String(agent.xp)} color={colors.brand.primary} />
      </View>

      {/* Archetype stat bars */}
      {archetype && (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
          {Object.entries(archetype.stats).slice(0, 5).map(([key, val]) => (
            <View key={key} style={{ flex: 1 }}>
              <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.surface.tertiary }}>
                <View style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: val > 70 ? colors.status.success : val > 40 ? colors.status.warning : colors.text.muted,
                  width: `${val}%`,
                }} />
              </View>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text variant="caption" style={{ color, fontWeight: '700', fontSize: 12 }}>{value}</Text>
      <Text variant="caption" color="muted" style={{ fontSize: 9 }}>{label}</Text>
    </View>
  );
}

export default function AgentsTab() {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  const { agents, activeAgentId, isLoading, isSwitching, refresh, switchToAgent } = useMyAgents();
  const removeAgent = useAuthStore((s) => s.removeAgent);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleDelete = useCallback((agent: UserAgent) => {
    mediumImpact();
    if (agent.id === activeAgentId) {
      Alert.alert('Cannot Delete', 'You cannot delete your active agent. Switch to another agent first.');
      return;
    }
    Alert.alert(
      'Delete Agent',
      `Are you sure you want to delete ${agent.displayName || agent.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAgentById(agent.id);
              removeAgent(agent.id);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete agent');
            }
          },
        },
      ],
    );
  }, [activeAgentId, removeAgent]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary, alignItems: 'center', justifyContent: 'center', padding: 32 }} edges={['top']}>
        <Ionicons name="people-outline" size={48} color={colors.text.muted} />
        <Text variant="body" color="muted" style={{ marginTop: 12, textAlign: 'center' }}>
          Sign in to manage your agents
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="h2" color="primary">My Agents</Text>
          <Text variant="caption" color="muted">{agents.length}/6 slots</Text>
        </View>

        {/* Loading */}
        {isLoading && agents.length === 0 && (
          <ActivityIndicator size="large" color={colors.brand.primary} style={{ padding: 32 }} />
        )}

        {/* Empty State */}
        {!isLoading && agents.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
            <Ionicons name="rocket-outline" size={48} color={colors.text.muted} />
            <Text variant="h3" color="secondary">No agents yet</Text>
            <Text variant="body" color="muted" style={{ textAlign: 'center', paddingHorizontal: 24 }}>
              Create your first AI trading agent to get started. Each agent has a unique archetype with different trading strategies.
            </Text>
          </View>
        )}

        {/* Agent List */}
        {agents.map((agent) => (
          <AgentRow
            key={agent.id}
            agent={agent}
            isActive={agent.id === activeAgentId}
            isSwitching={isSwitching}
            onSwitch={() => switchToAgent(agent.id)}
            onDelete={() => handleDelete(agent)}
            onConfigure={agent.id === activeAgentId ? () => router.push('/configure-agent') : undefined}
          />
        ))}

        {/* Create New Agent */}
        {agents.length < 6 && (
          <TouchableOpacity
            onPress={() => router.push('/create-agent')}
            style={{
              backgroundColor: colors.surface.secondary,
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: colors.brand.primary + '33',
              borderStyle: 'dashed',
            }}
          >
            <Ionicons name="add-circle-outline" size={22} color={colors.brand.primary} />
            <Text variant="body" color="brand" style={{ fontWeight: '600' }}>
              Create New Agent
            </Text>
          </TouchableOpacity>
        )}

        {/* Hint */}
        <Text variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 4 }}>
          Tap to switch | Long press to delete | Gear to configure
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
