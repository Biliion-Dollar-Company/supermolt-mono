/**
 * AgentCard - Displays the AI agent avatar and name
 * Shows active status with green border indicator
 */

import { View, Text, Image, StyleSheet } from 'react-native';
import { useState } from 'react';

interface AgentCardProps {
  name: string;
  avatarUrl?: string;
  isActive: boolean;
}

// Fallback gradient colors for avatar
const FALLBACK_COLORS = ['#c4f70e', '#68ac6e'];

export function AgentCard({ name, avatarUrl, isActive }: AgentCardProps) {
  const [imgError, setImgError] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();

  const showFallback = !avatarUrl || imgError;

  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      {/* Avatar with active indicator */}
      <View
        style={[
          styles.avatarContainer,
          isActive && styles.activeRing,
        ]}
      >
        {showFallback ? (
          <View style={styles.fallbackAvatar}>
            {/* Gradient background simulation */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: FALLBACK_COLORS[0], borderRadius: 28 },
              ]}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: FALLBACK_COLORS[1],
                  opacity: 0.6,
                  borderRadius: 28,
                },
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

        {/* Active indicator dot */}
        {isActive && (
          <View style={styles.activeIndicator} />
        )}
      </View>

      {/* Agent name */}
      <View>
        <Text className="text-white font-semibold text-base">{name}</Text>
        <Text className="text-white/50 text-xs">
          {isActive ? 'Active • Trading' : 'Paused'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    position: 'relative',
  },
  activeRing: {
    borderWidth: 2,
    borderColor: '#c4f70e',
    shadowColor: '#c4f70e',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    margin: 2,
  },
  fallbackAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    margin: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
    zIndex: 10,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#c4f70e',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
});
