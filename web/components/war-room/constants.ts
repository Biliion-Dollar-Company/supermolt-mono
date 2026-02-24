import type { FeedEvent } from './types';

/** Shared monospace font family used across all PixiJS Text and React inline styles */
export const MONO_FONT = 'JetBrains Mono, monospace';

export const STATION_POSITIONS = [
  { rx: 0.12, ry: 0.22 },
  { rx: 0.38, ry: 0.16 },
  { rx: 0.65, ry: 0.24 },
  { rx: 0.88, ry: 0.19 },
  { rx: 0.08, ry: 0.60 },
  { rx: 0.33, ry: 0.67 },
  { rx: 0.62, ry: 0.60 },
  { rx: 0.87, ry: 0.65 },
];

export const ACTION_COLORS: Record<string, number> = {
  BUY:       0x00ff41,
  SELL:      0xff0033,
  ANALYZING: 0xffaa00,
};

export const ACTIONS: FeedEvent['action'][] = ['BUY', 'SELL', 'ANALYZING'];

/** Scanner-specific colors (Pixi hex) keyed by scanner name */
export const SCANNER_COLORS: Record<string, number> = {
  alpha:   0xe8b45e,  // gold
  beta:    0x00d4ff,  // cyan
  gamma:   0x00ff41,  // green
  delta:   0xb388ff,  // purple
  epsilon: 0xff4444,  // red
};

/** All 5 scanner IDs */
export const SCANNER_IDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'] as const;
