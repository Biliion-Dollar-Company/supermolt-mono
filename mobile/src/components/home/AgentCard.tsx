/**
 * AgentCard - SuperRouter-style Agent HUD Panel
 * Animated avatar ring, identity row, reasoning line
 */

// eslint-disable-next-line react-native/no-deprecated-api
import { View, Text, Image, StyleSheet, TouchableOpacity, Clipboard } from 'react-native';
import { useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { colors } from '@/theme/colors';

const defaultPfp = require('../../../assets/images/pfp.png');

interface AgentCardProps {
  name: string;
  handle?: string;
  avatarUrl?: string;
  walletAddress?: string;
  isActive: boolean;
  level?: number;
  levelName?: string;
  reasoningLine?: string;
  onSettingsPress?: () => void;
  onCreatePress?: () => void;
}


export function AgentCard({
  name,
  handle,
  avatarUrl,
  walletAddress,
  isActive,
  level,
  levelName,
  reasoningLine,
  onSettingsPress,
  onCreatePress,
}: AgentCardProps) {
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const showFallback = !avatarUrl || imgError;
  const pfpSource = showFallback ? defaultPfp : { uri: avatarUrl };

  // Breathing ring animation
  const ringPulse = useSharedValue(0);
  const statusGlow = useSharedValue(0);

  useEffect(() => {
    ringPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
    if (isActive) {
      statusGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    }
  }, [isActive]);

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(249, 115, 22, ${interpolate(ringPulse.value, [0, 1], [0.25, 0.7])})`,
    shadowOpacity: interpolate(ringPulse.value, [0, 1], [0.1, 0.6]),
  }));

  const statusDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(statusGlow.value, [0, 1], [0.8, 1.2]) }],
    opacity: interpolate(statusGlow.value, [0, 1], [0.6, 1]),
  }));

  const handleCopy = () => {
    if (!walletAddress) return;
    Clipboard.setString(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      {/* Top glow line */}
      <View style={styles.topGlow} />

      {/* ── Row 1: Avatar + Identity + Settings ── */}
      <View style={styles.topRow}>
        {/* Avatar with animated ring */}
        <View style={styles.avatarSection}>
          <Animated.View style={[styles.avatarRing, ringStyle]}>
            <Image
              source={pfpSource}
              style={styles.avatarImage}
              onError={() => setImgError(true)}
            />
          </Animated.View>
          {isActive && (
            <Animated.View style={[styles.statusDot, statusDotStyle]}>
              <View style={styles.statusDotInner} />
            </Animated.View>
          )}
        </View>

        {/* Name + level + copy wallet */}
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {level != null && (
              <View style={styles.levelBadge}>
                <Text style={styles.levelNum}>Lv.{level}</Text>
                {levelName && <Text style={styles.levelName}>{levelName}</Text>}
              </View>
            )}
            {isActive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            {walletAddress && (
              <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={12}
                  color={copied ? colors.status.success : colors.text.muted}
                />
                <Text style={[styles.copyText, copied && { color: colors.status.success }]}>
                  {copied ? 'Copied' : `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Reasoning line */}
          <View style={styles.reasoningRow}>
            <View style={styles.reasoningDot} />
            <Text style={styles.reasoningText} numberOfLines={1}>
              {reasoningLine || 'Scanning for alpha...'}
            </Text>
          </View>
        </View>

        {/* Right action: Settings or Create */}
        {onSettingsPress && (
          <TouchableOpacity
            onPress={onSettingsPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="settings-outline" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        )}
        {onCreatePress && (
          <TouchableOpacity onPress={onCreatePress} style={styles.createBtn} activeOpacity={0.8}>
            <Ionicons name="add" size={14} color="#000" />
            <Text style={styles.createText}>Create</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Twitter sub-bar */}
      {handle && (
        <View style={styles.subBar}>
          <View style={styles.subBarItem}>
            <Ionicons name="logo-twitter" size={10} color="rgba(29,161,242,0.7)" />
            <Text style={styles.subBarText}>@{handle}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.15)',
    backgroundColor: colors.surface.secondary,
    overflow: 'hidden',
    gap: 16,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 1,
    backgroundColor: colors.brand.primary,
    opacity: 0.3,
    borderRadius: 1,
  },

  // Row 1: Top
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
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
  identity: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
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
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
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
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Courier',
  },

  // Reasoning line
  reasoningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 160,
  },
  reasoningDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.brand.primary,
    opacity: 0.7,
  },
  reasoningText: {
    flex: 1,
    color: colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
    fontStyle: 'italic',
  },

  // Create CTA (right side of top row)
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  createText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },

  // Twitter sub-bar
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  subBarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subBarText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Courier',
  },
});
