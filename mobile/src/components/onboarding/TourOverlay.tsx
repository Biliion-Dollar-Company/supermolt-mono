import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { CharacterBubble } from '@/components/onboarding/CharacterBubble';
import { colors } from '@/theme/colors';
import { useOnboardingStore, TourStep } from '@/store/onboarding';
import { mediumImpact, successNotification } from '@/lib/haptics';

const { width: SCREEN_W } = Dimensions.get('window');

interface TourConfig {
  tab: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  highlights: string[];
  characterMessage: string;
  ctaLabel: string;
}

const TOUR_CONFIGS: Record<Exclude<TourStep, null | 'complete'>, TourConfig> = {
  home: {
    tab: '/(tabs)',
    title: 'Your HQ',
    description: 'This is mission control. Everything about your agent in one place.',
    icon: 'home-outline',
    highlights: ['Portfolio value & PnL', 'Live agent decisions', 'Open positions'],
    characterMessage: 'This is your Home tab — your personal HQ. You can see your portfolio, open positions, and every decision your agent makes in real time.',
    ctaLabel: 'Next: Arena →',
  },
  arena: {
    tab: '/(tabs)/arena',
    title: 'The Arena',
    description: 'Where agents compete for glory, XP, and USDC rewards.',
    icon: 'trophy-outline',
    highlights: ['Live leaderboard rankings', 'Epoch USDC rewards', 'Community votes'],
    characterMessage: 'Welcome to the Arena — where your agent competes against the best. Climb the leaderboard, earn XP, vote on market moves, and win epoch rewards.',
    ctaLabel: 'Next: Agents →',
  },
  agents: {
    tab: '/(tabs)/agents',
    title: 'Your Agents',
    description: 'Manage all your agents and track their activity.',
    icon: 'people-outline',
    highlights: ['Up to 6 agents', 'Trade activity feed', 'Deploy new agents'],
    characterMessage: 'The Agents tab is where you manage your squad. Track performance, browse the activity feed, and deploy more agents when you\'re ready to scale up.',
    ctaLabel: 'Let\'s trade! 🚀',
  },
};

export function TourOverlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tourStep, advanceTour, completeOnboarding } = useOnboardingStore();

  const isActive = tourStep !== null && tourStep !== 'complete';
  const isComplete = tourStep === 'complete';

  // Navigate to the correct tab when the step changes
  useEffect(() => {
    if (!isActive || !tourStep) return;
    const config = TOUR_CONFIGS[tourStep as keyof typeof TOUR_CONFIGS];
    if (config) {
      router.navigate(config.tab as any);
    }
  }, [tourStep]);

  const handleNext = () => {
    mediumImpact();
    if (tourStep === 'agents') {
      // Last tour step — go to complete state
      advanceTour();
    } else {
      advanceTour();
    }
  };

  const handleFinish = () => {
    successNotification();
    completeOnboarding();
  };

  if (!isActive && !isComplete) return null;

  // ── Complete screen ──────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={[styles.absoluteFill, styles.darkOverlay]}
        pointerEvents="box-none"
      >
        <View style={[styles.completeContainer, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.completeContent}>
            <View style={styles.completeBadge}>
              <Text style={{ fontSize: 56 }}>🏆</Text>
            </View>
            <Text variant="h2" color="primary" style={styles.completeTitle}>
              You're all set!
            </Text>
            <Text variant="body" color="muted" style={styles.completeSub}>
              Your agent is live, you know the arena.{'\n'}
              Now let's get to work.
            </Text>
          </View>

          <View style={styles.completeBottom}>
            <CharacterBubble
              key="complete"
              message="That's the tour! Your agent is already scanning the market. Check back soon — the first trade might be closer than you think. Good luck out there 🔥"
            />
            <View style={styles.finishBtnWrap}>
              <TouchableOpacity
                onPress={handleFinish}
                activeOpacity={0.85}
                style={styles.finishBtn}
              >
                <Text variant="body" color="primary" style={{ fontWeight: '700', fontSize: 16 }}>
                  Start Trading 🚀
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── Active tour step ─────────────────────────────────────────────────────
  const config = TOUR_CONFIGS[tourStep as keyof typeof TOUR_CONFIGS];
  if (!config) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={[styles.absoluteFill, styles.tourOverlay]}
      pointerEvents="box-none"
    >
      {/* Feature callout card — top area */}
      <Animated.View
        key={tourStep}
        entering={SlideInDown.springify().damping(18).stiffness(140).delay(100)}
        style={[styles.calloutCard, { top: insets.top + 16 }]}
        pointerEvents="auto"
      >
        {/* Card header */}
        <View style={styles.calloutHeader}>
          <View style={styles.calloutIconWrap}>
            <Ionicons name={config.icon} size={22} color={colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h3" color="primary" style={{ fontWeight: '700' }}>
              {config.title}
            </Text>
            <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
              {config.description}
            </Text>
          </View>
        </View>

        {/* Highlights */}
        <View style={styles.highlightsList}>
          {config.highlights.map((h, i) => (
            <View key={i} style={styles.highlightRow}>
              <View style={styles.highlightDot} />
              <Text variant="caption" color="secondary">
                {h}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Tour progress dots */}
      <View style={styles.progressRow} pointerEvents="none">
        {(['home', 'arena', 'agents'] as const).map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressPip,
              tourStep === s && styles.progressPipActive,
              ['arena', 'agents'].indexOf(tourStep!) > i && styles.progressPipDone,
            ]}
          />
        ))}
      </View>

      {/* Bottom: character + next button */}
      <Animated.View
        key={`bottom-${tourStep}`}
        entering={SlideInDown.springify().damping(18).stiffness(140).delay(200)}
        style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}
        pointerEvents="auto"
      >
        <CharacterBubble key={tourStep} message={config.characterMessage} />
        <View style={styles.nextBtnWrap}>
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.85}
            style={styles.nextBtn}
          >
            <Text variant="body" color="primary" style={{ fontWeight: '700', fontSize: 15 }}>
              {config.ctaLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  darkOverlay: {
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  tourOverlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'space-between',
  },

  // ── Callout card ──
  calloutCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.surface.secondary,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.brand.primary + '40',
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  calloutIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brand.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  highlightsList: {
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.surface.tertiary,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  highlightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.primary,
  },

  // ── Progress ──
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 8,
  },
  progressPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface.tertiary,
  },
  progressPipActive: {
    backgroundColor: colors.brand.primary,
    width: 20,
  },
  progressPipDone: {
    backgroundColor: colors.status.success,
  },

  // ── Bottom ──
  bottomSection: {
    gap: 12,
    paddingTop: 8,
  },
  nextBtnWrap: {
    paddingHorizontal: 20,
  },
  nextBtn: {
    width: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Complete ──
  completeContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  completeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  completeBadge: {
    marginBottom: 24,
  },
  completeTitle: {
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 28,
  },
  completeSub: {
    textAlign: 'center',
    lineHeight: 24,
  },
  completeBottom: {
    gap: 16,
  },
  finishBtnWrap: {
    paddingHorizontal: 20,
  },
  finishBtn: {
    width: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
