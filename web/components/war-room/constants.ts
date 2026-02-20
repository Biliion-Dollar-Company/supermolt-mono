import type { FeedEvent } from './types';

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
