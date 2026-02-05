// Agent archetype definitions — code constants (Option C)
// These define the two trading personalities users can choose from.

export interface ArchetypeStats {
  aggression: number;
  riskTolerance: number;
  speed: number;
  patience: number;
  selectivity: number;
}

export interface TradingParams {
  minMarketCap: number;
  maxMarketCap: number;
  signalTypes: string[];
  holdDuration: string;
  maxPositionSize: number;
  takeProfitTargets: number[];
  stopLossPercent: number;
}

export interface Archetype {
  id: string;
  name: string;
  description: string;
  emoji: string;
  stats: ArchetypeStats;
  tradingParams: TradingParams;
}

export const ARCHETYPES = {
  degen_hunter: {
    id: 'degen_hunter',
    name: 'Degen Hunter',
    description: 'Hunts low-cap gems fresh off migration. Fast entries, aggressive targets, high risk tolerance.',
    emoji: '🎯',
    stats: {
      aggression: 85,
      riskTolerance: 90,
      speed: 95,
      patience: 20,
      selectivity: 30,
    },
    tradingParams: {
      minMarketCap: 10_000,
      maxMarketCap: 1_000_000,
      signalTypes: ['migration', 'god_wallet'],
      holdDuration: '5m-2h',
      maxPositionSize: 0.5,
      takeProfitTargets: [2, 5, 10],
      stopLossPercent: 50,
    },
  },
  smart_money: {
    id: 'smart_money',
    name: 'Smart Money',
    description: 'Plays established meme momentum. Patient entries, calculated targets, disciplined risk management.',
    emoji: '🧠',
    stats: {
      aggression: 40,
      riskTolerance: 45,
      speed: 60,
      patience: 80,
      selectivity: 85,
    },
    tradingParams: {
      minMarketCap: 1_000_000,
      maxMarketCap: 50_000_000,
      signalTypes: ['god_wallet', 'ai_signal'],
      holdDuration: '1h-24h',
      maxPositionSize: 1.0,
      takeProfitTargets: [1.5, 3, 5],
      stopLossPercent: 30,
    },
  },
} as const satisfies Record<string, Archetype>;

export type ArchetypeId = keyof typeof ARCHETYPES;

export function getArchetype(id: string): Archetype | undefined {
  return ARCHETYPES[id as ArchetypeId];
}

export function getAllArchetypes(): Archetype[] {
  return Object.values(ARCHETYPES);
}
