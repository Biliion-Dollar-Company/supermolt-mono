import { ScrollView, View, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { Text, Button } from '@/components/ui';
import { ArchetypeCard } from '@/components/onboarding/ArchetypeCard';
import { colors } from '@/theme/colors';
import { getArchetypes, createNewAgent, switchAgent, storeTokens, getMyAgent } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import type { Archetype } from '@/types/arena';

export default function CreateAgentScreen() {
  const router = useRouter();
  const { agents, addAgent, setActiveAgentId, setAgentMe } = useAuthStore();

  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Filter out archetypes user already has
  const usedArchetypeIds = new Set(agents.map((a) => a.archetypeId));
  const availableArchetypes = archetypes.filter((a) => !usedArchetypeIds.has(a.id));

  useEffect(() => {
    async function load() {
      try {
        const data = await getArchetypes();
        setArchetypes(data);
      } catch (err) {
        console.error('[CreateAgent] Failed to load archetypes:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedId || !agentName.trim()) {
      Alert.alert('Missing Info', 'Please select an archetype and enter a name.');
      return;
    }

    try {
      setIsCreating(true);

      // Create the agent
      const newAgent = await createNewAgent(selectedId, agentName.trim());
      addAgent(newAgent);

      // Switch to the new agent
      const result = await switchAgent(newAgent.id);
      await storeTokens({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
      setActiveAgentId(newAgent.id);

      // Refresh profile
      try {
        const meData = await getMyAgent();
        if (meData?.agent) {
          setAgentMe({
            agent: meData.agent,
            stats: meData.stats ?? null,
            onboarding: meData.onboarding ?? { tasks: [], completedTasks: 0, totalTasks: 0, progress: 0 },
          });
        }
      } catch {
        // Non-critical
      }

      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create agent';
      Alert.alert('Error', msg);
    } finally {
      setIsCreating(false);
    }
  }, [selectedId, agentName, addAgent, setActiveAgentId, setAgentMe, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <Ionicons name="arrow-back" size={24} color={colors.text.primary} onPress={() => router.back()} />
        <Text variant="h3" color="primary" style={{ flex: 1 }}>Create Agent</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
      >
        {/* Name Input */}
        <View style={{ gap: 6 }}>
          <Text variant="label" color="secondary">Agent Name</Text>
          <TextInput
            value={agentName}
            onChangeText={setAgentName}
            placeholder="Enter agent name..."
            placeholderTextColor={colors.text.muted}
            maxLength={32}
            style={{
              backgroundColor: colors.surface.secondary,
              borderRadius: 10,
              padding: 14,
              color: colors.text.primary,
              fontSize: 16,
            }}
          />
        </View>

        {/* Archetype Selection */}
        <View style={{ gap: 8 }}>
          <Text variant="label" color="secondary">Choose Specialization</Text>
          <Text variant="caption" color="muted">
            {availableArchetypes.length} of {archetypes.length} available (1 agent per archetype)
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.brand.primary} style={{ padding: 32 }} />
        ) : (
          <View style={{ gap: 10 }}>
            {availableArchetypes.map((arch) => (
              <ArchetypeCard
                key={arch.id}
                id={arch.id}
                emoji={arch.emoji}
                name={arch.name}
                description={arch.description}
                stats={Object.entries(arch.stats).map(([label, value]) => ({
                  label: label.replace(/([A-Z])/g, ' $1').trim(),
                  value,
                }))}
                selected={selectedId === arch.id}
                onPress={() => setSelectedId(arch.id)}
              />
            ))}
          </View>
        )}

        {availableArchetypes.length === 0 && !isLoading && (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <Text variant="body" color="muted">You have an agent for every archetype!</Text>
          </View>
        )}
      </ScrollView>

      {/* Create Button */}
      <View style={{ padding: 16, paddingBottom: 24 }}>
        <Button
          variant="primary"
          onPress={handleCreate}
          disabled={!selectedId || !agentName.trim() || isCreating}
          loading={isCreating}
        >
          <Text variant="body" color="primary" style={{ fontWeight: '700' }}>
            {isCreating ? 'Creating...' : 'Create Agent'}
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
