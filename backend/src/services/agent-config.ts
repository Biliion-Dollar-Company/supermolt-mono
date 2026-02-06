/**
 * Agent Configuration - 5 Trading Personalities
 * 
 * Each agent has:
 * - Unique wallet (Alpha uses Henry's DR wallet)
 * - Trading personality and risk profile
 * - Token watchlist
 * - Trading parameters
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export interface AgentPersonality {
  id: string;
  name: string;
  description: string;
  emoji: string;
  walletAddress: string; // Public key
  privateKey?: string; // Only for Alpha (loaded from env)
  
  // Trading characteristics
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  aggression: number; // 0-100
  patience: number; // 0-100
  
  // Token preferences
  tokenWatchlist: string[]; // Token symbols
  tokenMints: string[]; // Token mint addresses
  
  // Trading parameters
  minMarketCap: number;
  maxMarketCap: number;
  maxPositionSize: number; // SOL
  takeProfitPercent: number;
  stopLossPercent: number;
  tradesPerDay: number; // Target trades per day
}

/**
 * Agent Alpha - Aggressive Day Trader (Henry's DR Wallet)
 * 
 * Uses existing wallet: DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy
 * Private key loaded from env: AGENT_ALPHA_PRIVATE_KEY
 */
export const AGENT_ALPHA: AgentPersonality = {
  id: 'alpha-wolf',
  name: 'Alpha Wolf',
  description: 'Aggressive day trader. High risk, high reward. Loves volatile meme coins.',
  emoji: '🐺',
  walletAddress: 'DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy',
  privateKey: undefined, // Loaded from env in agent-simulator.ts
  
  riskLevel: 'HIGH',
  aggression: 90,
  patience: 20,
  
  tokenWatchlist: ['BONK', 'WIF', 'POPCAT', 'MEW'],
  tokenMints: [
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
    '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
    'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', // MEW
  ],
  
  minMarketCap: 100_000,
  maxMarketCap: 50_000_000,
  maxPositionSize: 0.05, // 0.05 SOL per trade for testing
  takeProfitPercent: 25, // Take profit at +25%
  stopLossPercent: 15, // Stop loss at -15%
  tradesPerDay: 3, // 3 trades per day
};

/**
 * Agent Beta - Conservative Value Investor
 */
export const AGENT_BETA: AgentPersonality = {
  id: 'beta-brain',
  name: 'Beta Brain',
  description: 'Conservative value investor. Low risk, steady returns. Plays established tokens.',
  emoji: '🧠',
  walletAddress: '', // Generated on first run
  
  riskLevel: 'LOW',
  aggression: 30,
  patience: 85,
  
  tokenWatchlist: ['SOL', 'BONK', 'JUP'],
  tokenMints: [
    'So11111111111111111111111111111111111111112', // SOL (wrapped)
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
  ],
  
  minMarketCap: 10_000_000,
  maxMarketCap: 1_000_000_000,
  maxPositionSize: 0.03,
  takeProfitPercent: 15,
  stopLossPercent: 10,
  tradesPerDay: 1,
};

/**
 * Agent Gamma - Meme Coin Degen
 */
export const AGENT_GAMMA: AgentPersonality = {
  id: 'gamma-degen',
  name: 'Gamma Degen',
  description: 'Pure meme coin degen. EXTREME risk, chases moonshots. No fear.',
  emoji: '🚀',
  walletAddress: '',
  
  riskLevel: 'EXTREME',
  aggression: 95,
  patience: 10,
  
  tokenWatchlist: ['WIF', 'BONK', 'MYRO', 'SILLY'],
  tokenMints: [
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4', // MYRO
    '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs', // SILLY
  ],
  
  minMarketCap: 10_000,
  maxMarketCap: 10_000_000,
  maxPositionSize: 0.02,
  takeProfitPercent: 50, // Moon or bust
  stopLossPercent: 30,
  tradesPerDay: 5,
};

/**
 * Agent Delta - Swing Trader
 */
export const AGENT_DELTA: AgentPersonality = {
  id: 'delta-swinger',
  name: 'Delta Swinger',
  description: 'Patient swing trader. Medium risk, holds for days. Technical analysis focus.',
  emoji: '📊',
  walletAddress: '',
  
  riskLevel: 'MEDIUM',
  aggression: 50,
  patience: 70,
  
  tokenWatchlist: ['BONK', 'POPCAT', 'JUP'],
  tokenMints: [
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
  ],
  
  minMarketCap: 1_000_000,
  maxMarketCap: 100_000_000,
  maxPositionSize: 0.04,
  takeProfitPercent: 20,
  stopLossPercent: 12,
  tradesPerDay: 2,
};

/**
 * Agent Epsilon - Arbitrage Hunter
 */
export const AGENT_EPSILON: AgentPersonality = {
  id: 'epsilon-arb',
  name: 'Epsilon Arb',
  description: 'Arbitrage hunter. Low risk, high frequency. Exploits price differences.',
  emoji: '⚡',
  walletAddress: '',
  
  riskLevel: 'LOW',
  aggression: 40,
  patience: 60,
  
  tokenWatchlist: ['USDC', 'BONK', 'WIF'],
  tokenMints: [
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  ],
  
  minMarketCap: 5_000_000,
  maxMarketCap: 500_000_000,
  maxPositionSize: 0.025,
  takeProfitPercent: 8, // Quick scalps
  stopLossPercent: 5,
  tradesPerDay: 4,
};

/**
 * All 5 agents
 */
export const ALL_AGENTS: AgentPersonality[] = [
  AGENT_ALPHA,
  AGENT_BETA,
  AGENT_GAMMA,
  AGENT_DELTA,
  AGENT_EPSILON,
];

/**
 * Get agent by ID
 */
export function getAgent(agentId: string): AgentPersonality | undefined {
  return ALL_AGENTS.find(agent => agent.id === agentId);
}

/**
 * Get agent by wallet address
 */
export function getAgentByWallet(walletAddress: string): AgentPersonality | undefined {
  return ALL_AGENTS.find(agent => agent.walletAddress === walletAddress);
}
