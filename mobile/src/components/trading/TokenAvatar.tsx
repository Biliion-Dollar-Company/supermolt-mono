/**
 * TokenAvatar - Matching superRouter Next.js design
 * Displays token image with gradient fallback
 */

import { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const AVATAR_COLORS: [string, string][] = [
  ['#c4f70e', '#22d3ee'],
  ['#f97316', '#ef4444'],
  ['#8b5cf6', '#ec4899'],
  ['#06b6d4', '#3b82f6'],
  ['#10b981', '#14b8a6'],
  ['#eab308', '#f97316'],
  ['#ec4899', '#8b5cf6'],
];

function getAvatarColors(symbol: string | undefined): [string, string] {
  const safeSymbol = symbol || '??';
  const hash = safeSymbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Local image assets
const LOCAL_IMAGES: Record<string, any> = {
  'pump-fun': require('@/../assets/images/logos/pump-fun.png'),
};

interface TokenAvatarProps {
  imageUrl?: string | null;
  localImage?: string; // Key for local image (e.g., 'pump-fun')
  symbol: string;
  mint: string;
  size?: number;
}

export function TokenAvatar({ imageUrl, localImage, symbol, mint, size = 44 }: TokenAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const safeSymbol = symbol || '??';
  const [color1, color2] = getAvatarColors(safeSymbol);
  const initials = safeSymbol.slice(0, 2).toUpperCase();

  // Check for local image first
  const localSource = localImage ? LOCAL_IMAGES[localImage] : null;
  const dexScreenerUrl = `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`;
  const finalImageUrl = imageUrl || dexScreenerUrl;

  // Use local image if available
  if (localSource && !imgError) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size * 0.25,
          },
        ]}
      >
        <Image
          source={localSource}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size * 0.25,
            },
          ]}
          onError={() => setImgError(true)}
        />
      </View>
    );
  }

  if (imgError || !finalImageUrl) {
    return (
      <View
        style={[
          styles.fallback,
          {
            width: size,
            height: size,
            borderRadius: size * 0.25,
          },
        ]}
      >
        {/* Gradient background using overlays */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: color1, borderRadius: size * 0.25 },
          ]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: color2,
              opacity: 0.5,
              borderRadius: size * 0.25,
            },
          ]}
        />
        <Text
          style={[
            styles.initials,
            { fontSize: size * 0.35 },
          ]}
        >
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size * 0.25,
        },
      ]}
    >
      <Image
        source={{ uri: finalImageUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size * 0.25,
          },
        ]}
        onError={() => setImgError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#ffffff',
    fontWeight: '700',
    zIndex: 10,
  },
});
