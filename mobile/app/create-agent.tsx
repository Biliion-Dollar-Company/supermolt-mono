import {
  View,
  TextInput,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button } from '@/components/ui';
import { colors } from '@/theme/colors';
import { quickstartAgent, storeTokens, getMyAgent, apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { mediumImpact, successNotification } from '@/lib/haptics';

const TRADING_STYLES = [
  { id: 'degen_hunter', label: 'Degen Hunter', icon: 'flame-outline' as const, desc: 'High risk, high reward memecoin plays' },
  { id: 'smart_money', label: 'Smart Money', icon: 'analytics-outline' as const, desc: 'Follow whale wallets and smart traders' },
  { id: 'sniper', label: 'Sniper', icon: 'locate-outline' as const, desc: 'Early entries on new launches' },
  { id: 'conservative', label: 'Conservative', icon: 'shield-checkmark-outline' as const, desc: 'Low risk, steady accumulation' },
];

export default function CreateAgentScreen() {
  const router = useRouter();
  const { setAgentMe } = useAuthStore();

  const [agentName, setAgentName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('degen_hunter');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    const name = agentName.trim();
    if (!name) {
      Alert.alert('Enter a name', 'Your agent needs a name to get started.');
      return;
    }

    try {
      setIsCreating(true);
      mediumImpact();

      // Create agent via quickstart
      const result = await quickstartAgent({
        name,
        displayName: name,
        archetypeId: selectedStyle,
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

      // Update bio if provided (fire-and-forget, uses agent JWT)
      const trimBio = bio.trim();
      if (trimBio) {
        apiFetch('/agent-auth/profile/update', {
          method: 'POST',
          body: JSON.stringify({ bio: trimBio }),
        }).catch(() => {});
      }

      // Refresh full profile
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

      successNotification();

      // Go to strategy config instead of straight to home
      router.replace('/configure-agent');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create agent';
      Alert.alert('Error', msg);
    } finally {
      setIsCreating(false);
    }
  }, [agentName, bio, selectedStyle, setAgentMe, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: colors.brand.primary + '15',
                borderWidth: 2,
                borderColor: colors.brand.primary + '40',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Image
                source={require('../assets/images/pfp.png')}
                style={{ width: 64, height: 64, borderRadius: 32 }}
                resizeMode="contain"
              />
            </View>
            <Text variant="h2" color="primary">
              Deploy Your Agent
            </Text>
            <Text
              variant="body"
              color="muted"
              style={{ marginTop: 6, textAlign: 'center', lineHeight: 22 }}
            >
              Set up your AI trading agent on SuperMolt
            </Text>
          </View>

          {/* Agent Name */}
          <View style={{ marginBottom: 20 }}>
            <Text variant="label" color="secondary" style={{ fontWeight: '600', marginBottom: 8 }}>
              Agent Name
            </Text>
            <TextInput
              value={agentName}
              onChangeText={setAgentName}
              placeholder="e.g. AlphaHunter"
              placeholderTextColor={colors.text.muted}
              maxLength={24}
              autoFocus
              style={{
                backgroundColor: colors.surface.secondary,
                borderRadius: 12,
                padding: 14,
                color: colors.text.primary,
                fontSize: 16,
                fontWeight: '500',
                borderWidth: 1,
                borderColor: agentName.trim()
                  ? colors.brand.primary + '60'
                  : colors.surface.tertiary,
              }}
            />
          </View>

          {/* Bio */}
          <View style={{ marginBottom: 20 }}>
            <Text variant="label" color="secondary" style={{ fontWeight: '600', marginBottom: 8 }}>
              Bio
            </Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="What's your agent's trading thesis?"
              placeholderTextColor={colors.text.muted}
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                backgroundColor: colors.surface.secondary,
                borderRadius: 12,
                padding: 14,
                color: colors.text.primary,
                fontSize: 14,
                minHeight: 80,
                borderWidth: 1,
                borderColor: bio.trim()
                  ? colors.brand.primary + '30'
                  : colors.surface.tertiary,
              }}
            />
            <Text variant="caption" color="muted" style={{ marginTop: 4, textAlign: 'right' }}>
              {bio.length}/200
            </Text>
          </View>

          {/* Trading Style */}
          <View style={{ marginBottom: 24 }}>
            <Text variant="label" color="secondary" style={{ fontWeight: '600', marginBottom: 8 }}>
              Trading Style
            </Text>
            <View style={{ gap: 8 }}>
              {TRADING_STYLES.map((style) => {
                const isSelected = selectedStyle === style.id;
                return (
                  <TouchableOpacity
                    key={style.id}
                    onPress={() => {
                      mediumImpact();
                      setSelectedStyle(style.id);
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: isSelected
                        ? colors.brand.primary + '15'
                        : colors.surface.secondary,
                      borderWidth: 1,
                      borderColor: isSelected
                        ? colors.brand.primary + '60'
                        : colors.surface.tertiary,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: isSelected
                          ? colors.brand.primary + '25'
                          : colors.surface.tertiary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={style.icon}
                        size={20}
                        color={isSelected ? colors.brand.primary : colors.text.muted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        variant="body"
                        color={isSelected ? 'primary' : 'secondary'}
                        style={{ fontWeight: '600', fontSize: 15 }}
                      >
                        {style.label}
                      </Text>
                      <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                        {style.desc}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: isSelected
                          ? colors.brand.primary
                          : colors.text.muted + '50',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: colors.brand.primary,
                          }}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Info Banner */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              padding: 12,
              backgroundColor: colors.brand.primary + '10',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.brand.primary + '20',
              marginBottom: 20,
            }}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.brand.primary} style={{ marginTop: 1 }} />
            <Text variant="caption" color="secondary" style={{ flex: 1, lineHeight: 18 }}>
              After deploying, you'll configure tracked wallets and buy triggers to define your agent's strategy.
            </Text>
          </View>

          {/* Deploy Button */}
          <Button
            variant="primary"
            size="lg"
            onPress={handleCreate}
            disabled={!agentName.trim() || isCreating}
            loading={isCreating}
          >
            <Text variant="body" color="primary" style={{ fontWeight: '700', fontSize: 17 }}>
              {isCreating ? 'Deploying...' : 'Deploy Agent'}
            </Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
