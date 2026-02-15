/**
 * AgentCard - Futuristic Agent HUD Identity Bar
 * Animated avatar ring, glowing status, cinematic XP bar
 */

import { View, Text, Image, StyleSheet } from 'react-native';
import { useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { colors } from '@/theme/colors';

interface AgentCardProps {
  name: string;
  handle?: string;
  avatarUrl?: string;
  isActive: boolean;
  level?: number;
  levelName?: string;
  xp?: number;
  xpForNextLevel?: number;
}

export function AgentCard({
  name,
  handle,
  avatarUrl,
  isActive,
  level,
  levelName,
  xp = 0,
  xpForNextLevel = 100,
}: AgentCardProps) {
  const [imgError, setImgError] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();
  const showFallback = !avatarUrl || imgError;
  const xpProgress = xpForNextLevel > 0 ? Math.min(xp / xpForNextLevel, 1) : 0;

  // Breathing ring animation
  const ringPulse = useSharedValue(0);
  const statusGlow = useSharedValue(0);

  useEffect(() => {
    ringPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
    if (isActive) {
      statusGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    }
  }, [isActive]);

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(249, 115, 22, ${interpolate(ringPulse.value, [0, 1], [0.2, 0.6])})`,
    shadowOpacity: interpolate(ringPulse.value, [0, 1], [0, 0.5]),
  }));

  const statusDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(statusGlow.value, [0, 1], [0.8, 1.2]) }],
    opacity: interpolate(statusGlow.value, [0, 1], [0.6, 1]),
  }));

  return (
    <Animated.View entering={FadeIn.duration(600)} style={styles.container}>
      {/* Gradient border effect */}
      <LinearGradient
        colors={['rgba(249, 115, 22, 0.08)', 'rgba(255, 255, 255, 0.02)', 'rgba(249, 115, 22, 0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Avatar with animated ring */}
      <View style={styles.avatarSection}>
        <Animated.View style={[styles.avatarRing, ringStyle]}>
          {showFallback ? (
            <View style={styles.fallbackAvatar}>
              <LinearGradient
                colors={[colors.brand.primary, '#c2590f']}
                style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
              />
              <Text style={styles.initials}>{initials}</Text>
            </View>
          ) : (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarImage}
              onError={() => setImgError(true)}
            />
          )}
        </Animated.View>

        {/* Status indicator */}
        {isActive && (
          <Animated.View style={[styles.statusDot, statusDotStyle]}>
            <View style={styles.statusDotInner} />
          </Animated.View>
        )}
      </View>

      {/* Info section */}
      <View style={styles.info}>
        {/* Name + Status row */}
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {isActive ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineText}>IDLE</Text>
            </View>
          )}
        </View>

        {/* Level + XP bar */}
        <View style={styles.metaRow}>
          {level != null && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelNum}>Lv.{level}</Text>
              {levelName && <Text style={styles.levelName}>{levelName}</Text>}
            </View>
          )}

          {/* XP progress bar */}
          <View style={styles.xpContainer}>
            <View style={styles.xpTrack}>
              <LinearGradient
                colors={[colors.brand.primary, colors.brand.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.xpFill,
                  { width: `${Math.round(xpProgress * 100)}%` as `${number}%` },
                ]}
              />
              {/* Glow point at end */}
              {xpProgress > 0.05 && (
                <View
                  style={[
                    styles.xpGlowDot,
                    { left: `${Math.round(xpProgress * 100)}%` as `${number}%` },
                  ]}
                />
              )}
            </View>
            <Text style={styles.xpLabel}>{xp}<Text style={styles.xpSuffix}>xp</Text></Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.12)',
    overflow: 'hidden',
  },

  // Avatar
  avatarSection: {
    position: 'relative',
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand.primary,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  fallbackAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    zIndex: 10,
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },

  // Info
  info: {
    flex: 1,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.status.success,
  },
  liveText: {
    color: colors.status.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  offlineBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  offlineText: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  levelNum: {
    color: colors.brand.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  levelName: {
    color: colors.brand.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  xpContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  xpTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'visible',
    position: 'relative',
  },
  xpFill: {
    height: 4,
    borderRadius: 2,
  },
  xpGlowDot: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.primary,
    marginLeft: -4,
    shadowColor: colors.brand.primary,
    shadowRadius: 6,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
  },
  xpLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  xpSuffix: {
    color: colors.text.muted,
    fontSize: 9,
    fontWeight: '600',
  },
});
