import { View, Image, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors } from '@/theme/colors';

const TYPEWRITER_SPEED_MS = 18;

interface CharacterBubbleProps {
  message: string;
  /** When true shows three bouncing dots instead of text (used during loading steps) */
  isTyping?: boolean;
}

function TypingDots() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const bounce = withRepeat(
      withSequence(
        withTiming(-6, { duration: 250 }),
        withTiming(0, { duration: 250 }),
      ),
      -1,
      false,
    );
    dot1.value = bounce;
    setTimeout(() => { dot2.value = bounce; }, 100);
    setTimeout(() => { dot3.value = bounce; }, 200);
  }, []);

  const dot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const dot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const dot3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <View style={styles.dotsRow}>
      <Animated.View style={[styles.dot, dot1Style]} />
      <Animated.View style={[styles.dot, dot2Style]} />
      <Animated.View style={[styles.dot, dot3Style]} />
    </View>
  );
}

export function CharacterBubble({ message, isTyping = false }: CharacterBubbleProps) {
  const [displayedText, setDisplayedText] = useState('');

  // Reset typewriter whenever message changes
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayedText(message.slice(0, i));
      if (i >= message.length) clearInterval(id);
    }, TYPEWRITER_SPEED_MS);
    return () => clearInterval(id);
  }, [message]);

  return (
    <Animated.View entering={FadeInUp.springify().damping(16).stiffness(120)} style={styles.container}>
      {/* Avatar — landscape rect to match the image aspect ratio */}
      <View style={styles.avatarWrap}>
        <Image
          source={require('../../../assets/images/pfp.png')}
          style={styles.avatarImg}
          resizeMode="cover"
        />
        <View style={styles.onlineDot} />
      </View>

      {/* Speech bubble */}
      <View style={styles.bubble}>
        {isTyping ? (
          <TypingDots />
        ) : (
          <Animated.Text style={styles.bubbleText}>
            {displayedText}
            {displayedText.length < message.length ? (
              <Animated.Text style={{ color: colors.brand.primary }}>▌</Animated.Text>
            ) : null}
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    gap: 12,
  },

  // Avatar — landscape rect matching image aspect ratio
  avatarWrap: {
    width: 84,
    height: 58,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
  },
  avatarImg: {
    width: 84,
    height: 58,
    borderRadius: 14,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.status.success,
    borderWidth: 2,
    borderColor: colors.surface.primary,
    zIndex: 1,
  },

  // Speech bubble — no border, full radius
  bubble: {
    flex: 1,
    backgroundColor: colors.surface.secondary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleText: {
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },

  // Typing dots
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    height: 22,
    paddingVertical: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.muted,
  },
});
