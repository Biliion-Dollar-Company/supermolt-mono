// Agent archetype definitions — code constants
// These define the trading personalities users can choose from.
// One agent per archetype per user.

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
  narrative_researcher: {
    id: 'narrative_researcher',
    name: 'Narrative Researcher',
    description: 'Tracks emerging narratives across social platforms. Buys conviction plays early, holds through the story arc.',
    emoji: '📡',
    stats: {
      aggression: 30,
      riskTolerance: 55,
      speed: 40,
      patience: 90,
      selectivity: 80,
    },
    tradingParams: {
      minMarketCap: 500_000,
      maxMarketCap: 20_000_000,
      signalTypes: ['narrative', 'social_trend', 'ai_signal'],
      holdDuration: '4h-7d',
      maxPositionSize: 0.8,
      takeProfitTargets: [2, 4, 8],
      stopLossPercent: 35,
    },
  },
  whale_tracker: {
    id: 'whale_tracker',
    name: 'Whale Tracker',
    description: 'Follows top wallets and copies their moves. Rides momentum from proven winners with tight risk controls.',
    emoji: '🐋',
    stats: {
      aggression: 60,
      riskTolerance: 50,
      speed: 80,
      patience: 60,
      selectivity: 75,
    },
    tradingParams: {
      minMarketCap: 100_000,
      maxMarketCap: 30_000_000,
      signalTypes: ['god_wallet', 'whale_move', 'smart_wallet'],
      holdDuration: '30m-12h',
      maxPositionSize: 0.7,
      takeProfitTargets: [1.5, 3, 6],
      stopLossPercent: 25,
    },
  },
  liquidity_sniper: {
    id: 'liquidity_sniper',
    name: 'Liquidity Sniper',
    description: 'Catches new liquidity events and graduation trades. First in on bonding curve completions, fast exits.',
    emoji: '⚡',
    stats: {
      aggression: 95,
      riskTolerance: 85,
      speed: 100,
      patience: 10,
      selectivity: 40,
    },
    tradingParams: {
      minMarketCap: 5_000,
      maxMarketCap: 500_000,
      signalTypes: ['migration', 'graduation', 'new_pair'],
      holdDuration: '1m-30m',
      maxPositionSize: 0.3,
      takeProfitTargets: [2, 5, 20],
      stopLossPercent: 60,
    },
  },
  sentiment_analyst: {
    id: 'sentiment_analyst',
    name: 'Sentiment Analyst',
    description: 'Reads community mood and social signals. Buys fear, sells euphoria. Contrarian by nature.',
    emoji: '🔮',
    stats: {
      aggression: 45,
      riskTolerance: 60,
      speed: 50,
      patience: 75,
      selectivity: 70,
    },
    tradingParams: {
      minMarketCap: 200_000,
      maxMarketCap: 10_000_000,
      signalTypes: ['social_trend', 'community_sentiment', 'narrative'],
      holdDuration: '2h-3d',
      maxPositionSize: 0.6,
      takeProfitTargets: [1.8, 3.5, 7],
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
