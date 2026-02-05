/**
 * PositionCard - Matching superRouter PositionProgressCard design
 *
 * Features:
 * - Token avatar with gradient fallback
 * - Ticker with Entry/Current MCap
 * - Current P&L display (percentage + SOL)
 * - Progress bar with TP targets
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TokenAvatar } from './TokenAvatar';

export interface PositionData {
  id: string;
  mint: string;
  ticker: string;
  tokenName: string;
  imageUrl?: string;
  localImage?: string; // Key for local image (e.g., 'pump-fun')
  entryMcap: number;
  entrySolValue: number;
  entryTime: string;
  currentMcap: number;
  multiplier: number;
  pnlPct: number;
  pnlSol: number;
  peakPnlPct: number;
  nextTarget: number | null;
  targetProgress: number | null;
  targetsHit: number[];
  buySignature?: string;
}

interface PositionCardProps {
  position: PositionData;
  onPress?: () => void;
  index?: number;
}

function formatMarketCap(mcap: number | undefined | null): string {
  const value = mcap ?? 0;
  if (value === 0) return '—';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

export function PositionCard({ position, onPress, index = 0 }: PositionCardProps) {
  // Safeguard all position values
  const pnlPct = position.pnlPct ?? 0;
  const entryMcap = position.entryMcap ?? 0;
  const currentMcap = position.currentMcap ?? 0;
  const ticker = position.ticker || '??';
  const mint = position.mint || '';

  const isPositive = pnlPct >= 0;
  const targetsHit = position.targetsHit || [];

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
    >
      <Pressable
        onPress={onPress}
        className="p-6 rounded-2xl bg-white/5 border border-white/10 active:opacity-80"
      >
        {/* Header: Token + Current P&L */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-3">
            <TokenAvatar
              imageUrl={position.imageUrl}
              localImage={position.localImage}
              symbol={ticker}
              mint={mint}
              size={56}
            />
            <View>
              <View className="flex-row items-center gap-2">
                <Text className="font-bold text-white text-lg">
                  {ticker}
                </Text>
                {position.buySignature && (
                  <View className="p-1">
                    <Ionicons name="open-outline" size={12} color="rgba(255,255,255,0.4)" />
                  </View>
                )}
              </View>
              {/* Entry & Current MCap stacked */}
              <View className="mt-0.5 gap-0.5">
                <View className="flex-row items-center gap-1">
                  <Text className="text-white/40 text-[10px] uppercase">Entry</Text>
                  <Text className="font-semibold text-white/70 text-[11px]">
                    {formatMarketCap(entryMcap)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Text className="text-white/40 text-[10px] uppercase">MCap</Text>
                  <Text className="font-semibold text-white text-[11px]">
                    {formatMarketCap(currentMcap)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Current P&L + TP hit */}
          <View className="items-end">
            <Text
              className={`text-2xl font-bold font-mono ${
                isPositive ? 'text-success' : 'text-error'
              }`}
            >
              {isPositive ? '+' : ''}{Math.round(pnlPct)}%
            </Text>
            {targetsHit.length > 0 && (
              <View className="flex-row items-center gap-1 mt-1">
                <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
                <Text className="text-white/50 text-xs">
                  TP{targetsHit[targetsHit.length - 1]} hit
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
