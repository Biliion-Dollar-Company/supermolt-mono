import { useState } from 'react';
import { View, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button } from '@/components/ui';
import { ArchetypeCard } from '@/components/onboarding/ArchetypeCard';
import { quickstartAgent, storeTokens } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { colors } from '@/theme/colors';

const ARCHETYPES = [
  {
    id: 'degen',
    emoji: '🎰',
    name: 'Degen',
    description: 'High risk, high reward. Apes early, exits fast.',
    stats: [
      { label: 'Risk', value: 90 },
      { label: 'Speed', value: 85 },
      { label: 'Analysis', value: 30 },
    ],
  },
  {
    id: 'analyst',
    emoji: '📊',
    name: 'Analyst',
    description: 'Data-driven decisions. Patience is the edge.',
    stats: [
      { label: 'Risk', value: 40 },
      { label: 'Speed', value: 50 },
      { label: 'Analysis', value: 95 },
    ],
  },
  {
    id: 'sniper',
    emoji: '🎯',
    name: 'Sniper',
    description: 'Waits for the perfect setup, then strikes.',
    stats: [
      { label: 'Risk', value: 60 },
      { label: 'Speed', value: 70 },
      { label: 'Analysis', value: 80 },
    ],
  },
  {
    id: 'whale',
    emoji: '🐋',
    name: 'Whale',
    description: 'Big positions, conviction plays. Moves markets.',
    stats: [
      { label: 'Risk', value: 75 },
      { label: 'Speed', value: 40 },
      { label: 'Analysis', value: 70 },
    ],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const setAgentMe = useAuthStore((s) => s.setAgentMe);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQuickstart = async () => {
    if (!selectedArchetype) {
      Alert.alert('Select an archetype', 'Choose a trading style first.');
      return;
    }
    if (!agentName.trim()) {
      Alert.alert('Enter a name', 'Your agent needs a name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await quickstartAgent({
        archetypeId: selectedArchetype,
        name: agentName.trim(),
        displayName: agentName.trim(),
      });

      // Store tokens
      await storeTokens({
        accessToken: result.token,
        refreshToken: result.refreshToken,
      });

      // Store agent profile
      setAgentMe({
        agent: result.agent,
        stats: null,
        onboarding: result.onboarding,
      });

      // Navigate to app
      router.replace('/(tabs)');
    } catch (err) {
      console.error('[Onboarding] Quickstart failed:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}>
        {/* Header */}
        <View style={{ gap: 4 }}>
          <Text variant="h1" color="primary">Create Your Agent</Text>
          <Text variant="body" color="muted">
            Choose a trading archetype and name your AI agent.
          </Text>
        </View>

        {/* Agent Name */}
        <View style={{ gap: 8 }}>
          <Text variant="label" color="primary">Agent Name</Text>
          <TextInput
            value={agentName}
            onChangeText={setAgentName}
            placeholder="e.g. AlphaHunter"
            placeholderTextColor={colors.text.muted}
            style={{
              backgroundColor: colors.surface.secondary,
              borderRadius: 12,
              padding: 14,
              color: colors.text.primary,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.surface.tertiary,
            }}
            maxLength={24}
          />
        </View>

        {/* Archetypes */}
        <View style={{ gap: 8 }}>
          <Text variant="label" color="primary">Trading Style</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {ARCHETYPES.map((arch) => (
              <ArchetypeCard
                key={arch.id}
                id={arch.id}
                emoji={arch.emoji}
                name={arch.name}
                description={arch.description}
                stats={arch.stats}
                selected={selectedArchetype === arch.id}
                onPress={() => setSelectedArchetype(arch.id)}
              />
            ))}
          </View>
        </View>

        {/* Submit */}
        <Button
          variant="primary"
          onPress={handleQuickstart}
          disabled={isSubmitting || !selectedArchetype || !agentName.trim()}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <Text variant="body" color="primary" style={{ fontWeight: '700' }}>
              Launch Agent
            </Text>
          )}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
