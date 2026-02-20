import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { CharacterBubble } from '@/components/onboarding/CharacterBubble';
import { colors } from '@/theme/colors';
import { useOnboardingStore, TourStep, SpotlightRect } from '@/store/onboarding';
import { mediumImpact, successNotification } from '@/lib/haptics';

const DIM = 'rgba(0,0,0,0.82)';
const SPOT_PAD = 10;
const SPOT_RADIUS = 16;

interface TourConfig {
  tab: string;
  characterMessage: string;
  ctaLabel: string;
}

const TOUR_CONFIGS: Record<Exclude<TourStep, null | 'complete'>, TourConfig> = {
  home: {
    tab: '/(tabs)',
    characterMessage: 'Your HQ. Portfolio, positions, and live agent decisions — all right here.',
    ctaLabel: 'Next: Arena',
  },
  arena: {
    tab: '/(tabs)/arena',
    characterMessage: 'Where agents compete. Climb the board, earn XP, and win epoch rewards.',
    ctaLabel: 'Next: Agents',
  },
  agents: {
    tab: '/(tabs)/agents',
    characterMessage: 'Your squad lives here. Track trades, browse activity, deploy more agents.',
    ctaLabel: "Let's trade",
  },
};

// ── Spotlight layer ───────────────────────────────────────────────────────────

function SpotlightLayer({ rect, stepKey }: { rect: SpotlightRect | null; stepKey: string }) {
  if (!rect) {
    // No measurement yet — full dim overlay
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />;
  }

  const x = Math.max(0, rect.x - SPOT_PAD);
  const y = Math.max(0, rect.y - SPOT_PAD);
  const w = rect.width + SPOT_PAD * 2;
  const h = rect.height + SPOT_PAD * 2;

  return (
    <Animated.View
      key={stepKey}
      entering={FadeIn.duration(350)}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {/* Top strip */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: y, backgroundColor: DIM }} />
      {/* Bottom strip */}
      <View style={{ position: 'absolute', top: y + h, left: 0, right: 0, bottom: 0, backgroundColor: DIM }} />
      {/* Left strip */}
      <View style={{ position: 'absolute', top: y, left: 0, width: x, height: h, backgroundColor: DIM }} />
      {/* Right strip */}
      <View style={{ position: 'absolute', top: y, left: x + w, right: 0, height: h, backgroundColor: DIM }} />
      {/* Touch blocker over spotlight hole (prevents accidental taps) */}
      <View style={{ position: 'absolute', top: y, left: x, width: w, height: h, borderRadius: SPOT_RADIUS }} />
      {/* Glow border */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: y,
          left: x,
          width: w,
          height: h,
          borderRadius: SPOT_RADIUS,
          borderWidth: 2,
          borderColor: colors.brand.primary + '90',
          shadowColor: colors.brand.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
        }}
      />
    </Animated.View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TourOverlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tourStep, spotlightRect, advanceTour, completeOnboarding } = useOnboardingStore();

  const isActive = tourStep !== null && tourStep !== 'complete';
  const isComplete = tourStep === 'complete';

  // Navigate to the correct tab when the step changes
  useEffect(() => {
    if (!isActive || !tourStep) return;
    const config = TOUR_CONFIGS[tourStep as keyof typeof TOUR_CONFIGS];
    if (config) router.navigate(config.tab as any);
  }, [tourStep]);

  const handleNext = () => {
    mediumImpact();
    advanceTour();
  };

  const handleFinish = () => {
    successNotification();
    completeOnboarding();
  };

  if (!isActive && !isComplete) return null;

  // ── Complete screen ───────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={[styles.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.92)' }]}
        pointerEvents="box-none"
      >
        <View style={[styles.completeContainer, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.completeContent}>
            <View style={styles.completeBadge}>
              <Ionicons name="trophy" size={56} color={colors.brand.primary} />
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
              message="Tour done. Agent's scanning as we speak. First trade incoming."
            />
            <View style={styles.finishBtnWrap}>
              <TouchableOpacity onPress={handleFinish} activeOpacity={0.85} style={styles.finishBtn}>
                <Text variant="body" style={{ fontWeight: '800', fontSize: 18, color: '#000000' }}>
                  Start Trading
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── Active tour step ──────────────────────────────────────────────────────
  const config = TOUR_CONFIGS[tourStep as keyof typeof TOUR_CONFIGS];
  if (!config) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={[styles.absoluteFill, styles.tourContainer]}
      pointerEvents="box-none"
    >
      {/* Spotlight cutout layer — behind everything else */}
      <SpotlightLayer rect={spotlightRect} stepKey={`sp-${tourStep}`} />

      {/* Progress dots */}
      <View style={styles.progressRow} pointerEvents="none">
        {(['home', 'arena', 'agents'] as const).map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressPip,
              tourStep === s && styles.progressPipActive,
              (['arena', 'agents'] as const).indexOf(tourStep as any) > i && styles.progressPipDone,
            ]}
          />
        ))}
      </View>

      {/* Bottom: character + next button — stays mounted, typewriter updates */}
      <View
        style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}
        pointerEvents="auto"
      >
        <CharacterBubble message={config.characterMessage} />
        <View style={styles.nextBtnWrap}>
          <TouchableOpacity onPress={handleNext} activeOpacity={0.85} style={styles.nextBtn}>
            <Text variant="body" style={{ fontWeight: '800', fontSize: 18, color: '#000000' }}>
              {config.ctaLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  tourContainer: {
    justifyContent: 'space-between',
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
    backgroundColor: colors.brand.primary + '50',
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
