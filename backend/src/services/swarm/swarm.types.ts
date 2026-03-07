/**
 * Polymarket Prediction Swarm — Shared Types
 * Multi-agent consensus system for prediction market trading
 */

export interface SwarmAgent {
  id: string;
  name: string;
  specialization: string;
  weight: number;
}

export interface MarketSignal {
  marketId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  combinedPrice: number;
  category: string;
  endDate: Date;
  volume?: number;
  liquidity?: number;
  priceHistory?: { timestamp: number; yesPrice: number }[];
}

export interface AgentVote {
  agentId: string;
  vote: 'YES' | 'NO' | 'ABSTAIN';
  confidence: number; // 0-1
  reasoning: string;
}

export interface SwarmDecision {
  marketId: string;
  question: string;
  consensus: 'BUY_YES' | 'BUY_NO' | 'NO_TRADE';
  votes: AgentVote[];
  confidence: number; // 0-1
  timestamp: Date;
}

export interface SwarmResult {
  decision: SwarmDecision;
  executed: boolean;
  txHash?: string;
  erc8004Logged: boolean;
}

export type AgentAnalyzeFunction = (signal: MarketSignal, context?: AgentContext) => Promise<AgentVote>;

export interface AgentContext {
  newsSignals?: NewsSignal[];
}

export interface NewsSignal {
  text: string;
  source: string;
  confidence: string;
  confidenceScore: number;
  category: string;
}
