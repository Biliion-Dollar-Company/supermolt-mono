import {
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { Text, Button } from '@/components/ui';
import { CharacterBubble } from '@/components/onboarding/CharacterBubble';
import { colors } from '@/theme/colors';
import { quickstartAgent, storeTokens, getMyAgent } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { useOnboardingStore } from '@/store/onboarding';
import { mediumImpact, successNotification } from '@/lib/haptics';

type Step = 'welcome' | 'pick_style' | 'enter_name' | 'launching' | 'success';

const TRADING_STYLES = [
  {
    id: 'degen_hunter',
    label: 'Degen Hunter',
    icon: 'flame-outline' as const,
    desc: 'High risk, high reward memecoin plays',
    emoji: '🔥',
  },
  {
    id: 'smart_money',
    label: 'Smart Money',
    icon: 'analytics-outline' as const,
    desc: 'Follow whale wallets and smart traders',
    emoji: '🐋',
  },
  {
    id: 'sniper',
    label: 'Sniper',
    icon: 'locate-outline' as const,
    desc: 'Early entries on new launches',
    emoji: '🎯',
  },
  {
    id: 'conservative',
    label: 'Conservative',
    icon: 'shield-checkmark-outline' as const,
    desc: 'Low risk, steady accumulation',
    emoji: '🛡️',
  },
];

const STYLE_MESSAGES: Record<string, string> = {
  degen_hunter: 'Degen mode. High risk, high reward. Full send on memecoins.',
  smart_money: 'Smart money. Copy the whales, ride their alpha. Solid play.',
  sniper: 'Sniper style — early entries, quick exits. Precision over volume.',
  conservative: 'Low risk, steady gains. Let the degens gamble while we accumulate.',
};

const STEP_MESSAGES: Record<Step, string> = {
  welcome: 'Yo! I\'m Molt. Let\'s get your first agent live — takes under a minute.',
  pick_style: 'What\'s your trading vibe? Pick a style and I\'ll shape the strategy around it.',
  enter_name: 'Give your agent a name. Make it legendary.',
  launching: 'Deploying to the Solana battlefield...',
  success: 'Agent live! Let me show you around real quick.',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { setAgentMe } = useAuthStore();
  const { startTour } = useOnboardingStore();

  const [step, setStep] = useState<Step>('welcome');
  const [selectedStyle, setSelectedStyle] = useState('degen_hunter');
  const [agentName, setAgentName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  const characterMessage =
    step === 'pick_style' && STYLE_MESSAGES[selectedStyle]
      ? STYLE_MESSAGES[selectedStyle]
      : STEP_MESSAGES[step];

  const handleStyleSelect = useCallback((id: string) => {
    mediumImpact();
    setSelectedStyle(id);
  }, []);

  const handleDeploy = useCallback(async () => {
    const name = agentName.trim();
    if (!name) {
      Alert.alert('Enter a name', 'Your agent needs a name to get started.');
      return;
    }

    try {
      setIsDeploying(true);
      setStep('launching');
      mediumImpact();

      const result = await quickstartAgent({
        name,
        displayName: name,
        archetypeId: selectedStyle,
      });

      await storeTokens({
        accessToken: result.token,
        refreshToken: result.refreshToken,
      });

      setAgentMe({
        agent: result.agent,
        stats: null,
        onboarding: result.onboarding,
      });

      // Refresh full profile (non-blocking)
      getMyAgent()
        .then((meData) => {
          if (meData?.agent) {
            setAgentMe({
              agent: meData.agent,
              stats: meData.stats ?? null,
              onboarding: meData.onboarding ?? {
                tasks: [],
                completedTasks: 0,
                totalTasks: 0,
                progress: 0,
              },
            });
          }
        })
        .catch(() => {});

      successNotification();
      setStep('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to deploy agent';
      Alert.alert('Error', msg);
      setStep('enter_name');
    } finally {
      setIsDeploying(false);
    }
  }, [agentName, selectedStyle, setAgentMe]);

  const handleShowMeAround = useCallback(() => {
    startTour();
    router.replace('/(tabs)');
  }, [startTour, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.flex}>
          {/* ── WELCOME ── */}
          {step === 'welcome' && (
            <Animated.View
              entering={FadeIn.duration(400)}
              exiting={FadeOut.duration(200)}
              style={styles.stepContainer}
            >
              <View style={styles.centeredContent}>
                {/* Brand mark */}
                <View style={styles.logoWrap}>
                  <View style={styles.logoBg}>
                    <Animated.Image
                      source={require('../assets/images/pfp.png')}
                      style={styles.logoImg}
                      resizeMode="contain"
                    />
                  </View>
                  <Text variant="h1" color="brand" style={styles.logoText}>
                    SuperMolt
                  </Text>
                  <Text variant="body" color="muted" style={styles.logoSub}>
                    AI-Powered Trading Arena
                  </Text>
                </View>

                {/* Character bubble — right below the pfp */}
                <CharacterBubble key="welcome" message={characterMessage} />

                {/* Steps preview */}
                <View style={[styles.stepsPreview, { marginTop: 24 }]}>
                  {['Pick your style', 'Name your agent', 'Enter the arena'].map(
                    (label, i) => (
                      <View key={i} style={styles.stepHint}>
                        <View style={styles.stepNum}>
                          <Text variant="caption" color="brand" style={{ fontWeight: '700' }}>
                            {i + 1}
                          </Text>
                        </View>
                        <Text variant="body" color="secondary">
                          {label}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              </View>

              {/* CTA */}
              <View style={styles.bottomSection}>
                <View style={styles.ctaRow}>
                  <Button
                    variant="primary"
                    size="lg"
                    onPress={() => setStep('pick_style')}
                    style={styles.ctaBtn}
                  >
                    <Text variant="body" style={{ fontWeight: '800', fontSize: 18, color: '#000000' }}>
                      Let's go
                    </Text>
                  </Button>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── PICK STYLE ── */}
          {step === 'pick_style' && (
            <Animated.View
              entering={SlideInRight.springify().damping(20)}
              exiting={SlideOutLeft.springify().damping(20)}
              style={styles.stepContainer}
            >
              <View style={styles.stepHeader}>
                <Text variant="h2" color="primary" style={styles.stepTitle}>
                  Trading Style
                </Text>
                <Text variant="body" color="muted" style={styles.stepSub}>
                  Your agent will use this to shape its strategy
                </Text>
              </View>

              <View style={styles.styleGrid}>
                {TRADING_STYLES.map((style) => {
                  const isSelected = selectedStyle === style.id;
                  return (
                    <TouchableOpacity
                      key={style.id}
                      onPress={() => handleStyleSelect(style.id)}
                      activeOpacity={0.75}
                      style={[
                        styles.styleCard,
                        isSelected && styles.styleCardSelected,
                      ]}
                    >
                      <Text style={styles.styleEmoji}>{style.emoji}</Text>
                      <View style={styles.styleText}>
                        <Text
                          variant="body"
                          color={isSelected ? 'primary' : 'secondary'}
                          style={{ fontWeight: '600' }}
                        >
                          {style.label}
                        </Text>
                        <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                          {style.desc}
                        </Text>
                      </View>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.bottomSection}>
                <CharacterBubble key="pick_style" message={characterMessage} />
                <View style={styles.ctaRow}>
                  <Button
                    variant="primary"
                    size="lg"
                    onPress={() => setStep('enter_name')}
                    style={styles.ctaBtn}
                  >
                    <Text variant="body" style={{ fontWeight: '800', fontSize: 18, color: '#000000' }}>
                      Next
                    </Text>
                  </Button>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── ENTER NAME ── */}
          {step === 'enter_name' && (
            <Animated.View
              entering={SlideInRight.springify().damping(20)}
              exiting={SlideOutLeft.springify().damping(20)}
              style={styles.stepContainer}
            >
              <View style={styles.stepHeader}>
                <Text variant="h2" color="primary" style={styles.stepTitle}>
                  Name Your Agent
                </Text>
                <Text variant="body" color="muted" style={styles.stepSub}>
                  This is how the arena will know you
                </Text>
              </View>

              <View style={styles.nameInputWrap}>
                <TextInput
                  value={agentName}
                  onChangeText={setAgentName}
                  placeholder="e.g. AlphaHunter, MoltMaxi..."
                  placeholderTextColor={colors.text.muted}
                  maxLength={24}
                  autoFocus
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleDeploy}
                  style={[
                    styles.nameInput,
                    agentName.trim().length > 0 && styles.nameInputActive,
                  ]}
                />
                <Text variant="caption" color="muted" style={{ marginTop: 6, textAlign: 'right' }}>
                  {agentName.length}/24
                </Text>

                {/* Suggestion chips */}
                <View style={styles.suggestions}>
                  {['SolAlpha', 'MoltMaxi', 'Phantom', 'DegenBot'].map((name) => (
                    <TouchableOpacity
                      key={name}
                      onPress={() => { mediumImpact(); setAgentName(name); }}
                      style={styles.suggestionChip}
                    >
                      <Text variant="caption" color="secondary">
                        {name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.bottomSection}>
                <CharacterBubble key="enter_name" message={characterMessage} />
                <View style={styles.ctaRow}>
                  <Button
                    variant="primary"
                    size="lg"
                    onPress={handleDeploy}
                    disabled={!agentName.trim()}
                    style={styles.ctaBtn}
                  >
                    <Text variant="body" style={{ fontWeight: '800', fontSize: 18, color: '#000000' }}>
                      Deploy Agent
                    </Text>
                  </Button>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── LAUNCHING ── */}
          {step === 'launching' && (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={[styles.stepContainer, styles.launchingContainer]}
            >
              <View style={styles.centeredContent}>
                {/* Animated ring */}
                <View style={styles.launchRing}>
                  <View style={styles.launchInner}>
                    <Animated.Image
                      source={require('../assets/images/pfp.png')}
                      style={styles.launchImg}
                      resizeMode="contain"
                    />
                  </View>
                </View>
                <Text variant="h3" color="primary" style={styles.launchTitle}>
                  Deploying...
                </Text>
                <Text variant="body" color="muted" style={styles.launchSub}>
                  Your agent is entering the arena
                </Text>

                {/* Progress dots */}
                <View style={styles.progressDots}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.progressDot,
                        { opacity: 0.3 + i * 0.3, backgroundColor: colors.brand.primary },
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.bottomSection}>
                <CharacterBubble key="launching" message={characterMessage} isTyping />
              </View>
            </Animated.View>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={styles.stepContainer}
            >
              <View style={styles.centeredContent}>
                <View style={styles.successRing}>
                  <Ionicons name="checkmark-circle" size={72} color={colors.status.success} />
                </View>
                <Text variant="h2" color="primary" style={styles.successTitle}>
                  Agent Deployed!
                </Text>
                <Text variant="body" color="muted" style={styles.successSub}>
                  You're officially in the SuperMolt arena.{'\n'}
                  Let me show you around.
                </Text>

                {/* Stats preview */}
                <View style={styles.statsRow}>
                  {[
                    { label: 'Rank', value: '#—' },
                    { label: 'Trades', value: '0' },
                    { label: 'XP', value: '0' },
                  ].map((stat) => (
                    <View key={stat.label} style={styles.statCard}>
                      <Text variant="h3" color="brand" style={{ fontWeight: '700' }}>
                        {stat.value}
                      </Text>
                      <Text variant="caption" color="muted">
                        {stat.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.bottomSection}>
                <CharacterBubble key="success" message={characterMessage} />
                <View style={styles.ctaRow}>
                  <Button
                    variant="primary"
                    size="lg"
                    onPress={handleShowMeAround}
                    style={styles.ctaBtn}
                  >
                    <Text variant="body" style={{ fontWeight: '800', fontSize: 18, color: '#000000' }}>
                      Show me around
                    </Text>
                  </Button>
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  flex: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 0,
  },
  bottomSection: {
    paddingBottom: 20,
    gap: 16,
  },
  ctaRow: {
    paddingHorizontal: 20,
  },
  ctaBtn: {
    width: '100%',
  },

  // Welcome
  logoWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBg: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: colors.brand.primary + '15',
    borderWidth: 2,
    borderColor: colors.brand.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  logoImg: {
    width: 116,
    height: 116,
    borderRadius: 58,
  },
  logoText: {
    fontSize: 38,
    letterSpacing: -1.2,
    fontWeight: '800',
  },
  logoSub: {
    marginTop: 6,
    fontSize: 15,
  },
  stepsPreview: {
    gap: 12,
    width: '100%',
  },
  stepHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.primary + '20',
    borderWidth: 1,
    borderColor: colors.brand.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Style picker
  stepHeader: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
  },
  stepTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  stepSub: {
    fontSize: 14,
  },
  styleGrid: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 10,
  },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
  },
  styleCardSelected: {
    backgroundColor: colors.brand.primary + '12',
    borderColor: colors.brand.primary + '70',
  },
  styleEmoji: {
    fontSize: 26,
    width: 36,
    textAlign: 'center',
  },
  styleText: {
    flex: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.text.muted + '60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.brand.primary,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: colors.brand.primary,
  },

  // Name input
  nameInputWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  nameInput: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    padding: 16,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    letterSpacing: 0.2,
  },
  nameInputActive: {
    borderColor: colors.brand.primary + '70',
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
  },

  // Launching
  launchingContainer: {
    justifyContent: 'space-between',
  },
  launchRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: colors.brand.primary + '50',
    backgroundColor: colors.brand.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 12,
  },
  launchInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.brand.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchImg: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  launchTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  launchSub: {
    textAlign: 'center',
    marginBottom: 24,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Success
  successRing: {
    marginBottom: 20,
  },
  successTitle: {
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  successSub: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: colors.surface.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    gap: 4,
  },
});
