/**
 * AgentCard - Compact Agent Identity Bar
 * Shows avatar with breathing glow, name, level badge, and XP in one row
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
} from 'react-native-reanimated';
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

  // Breathing glow animation for avatar
  const breathe = useSharedValue(0.4);

  useEffect(() => {
    if (isActive) {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [isActive]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: breathe.value,
    transform: [{ scale: 0.95 + breathe.value * 0.05 }],
  }));

  return (
    <View style={styles.bar}>
      {/* Avatar with breathing glow */}
      <Animated.View
        style={[
          styles.avatarOuter,
          isActive && {
            shadowColor: colors.brand.primary,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 0 },
          },
          isActive && glowStyle,
        ]}
      >
        <View style={[styles.avatarContainer, isActive && styles.activeRing]}>
          {showFallback ? (
            <View style={styles.fallbackAvatar}>
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: colors.brand.primary, borderRadius: 24, opacity: 0.8 },
                ]}
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
          {isActive && <View style={styles.activeDot} />}
        </View>
      </Animated.View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {isActive ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : (
            <View style={styles.pausedBadge}>
              <Text style={styles.pausedText}>PAUSED</Text>
            </View>
          )}
        </View>

        {/* Level + XP row */}
        <View style={styles.metaRow}>
          {level != null && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv.{level}</Text>
            </View>
          )}
          {levelName && (
            <Text style={styles.levelName}>{levelName}</Text>
          )}
          <View style={styles.xpBarContainer}>
            <View style={styles.xpBarBg}>
              <View
                style={[
                  styles.xpBarFill,
                  { width: `${Math.round(xpProgress * 100)}%` as `${number}%` },
                ]}
              />
            </View>
            <Text style={styles.xpText}>{xp}xp</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 12,
  },

  // Avatar
  avatarOuter: {
    width: 52,
    height: 52,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    margin: 2,
    position: 'relative',
  },
  activeRing: {
    borderWidth: 2,
    borderColor: colors.brand.primary,
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
  activeDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.status.success,
    borderWidth: 2,
    borderColor: '#111',
  },

  // Info
  info: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success,
  },
  liveText: {
    color: colors.status.success,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pausedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pausedText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  levelBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  levelText: {
    color: colors.brand.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  levelName: {
    color: colors.brand.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  xpBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  xpBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand.primary,
  },
  xpText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '600',
  },
});
