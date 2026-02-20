import { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { useOnboardingStore, TourStep } from '@/store/onboarding';

/** ms to wait after tourStep change before measuring — lets nav animation settle */
const MEASURE_DELAY = 450;

/**
 * Attach the returned ref to the View you want spotlighted during a tour step.
 * When tourStep matches `step`, the element is measured and written to the
 * onboarding store so TourOverlay can render the cutout around it.
 *
 * Usage:
 *   const tourRef = useTourTarget('home');
 *   <View ref={tourRef} collapsable={false}> ... </View>
 */
export function useTourTarget(step: TourStep) {
  const ref = useRef<View>(null);
  const tourStep = useOnboardingStore((s) => s.tourStep);
  const setSpotlight = useOnboardingStore((s) => s.setSpotlight);

  useEffect(() => {
    if (tourStep !== step) return;

    const timer = setTimeout(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          setSpotlight({ x, y, width, height });
        }
      });
    }, MEASURE_DELAY);

    return () => clearTimeout(timer);
  }, [tourStep, step, setSpotlight]);

  return ref;
}
