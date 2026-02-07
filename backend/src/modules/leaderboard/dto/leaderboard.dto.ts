/**
 * Leaderboard DTOs
 */

/**
 * Single leaderboard entry
 */
export interface LeaderboardEntryDto {
  rank: number;
  scannerId: string;
  agentId: string;
  name: string;
  pubkey: string;
  strategy: string;
  description: string;
  
  // Performance metrics
  performanceScore: number;
  totalCalls: number;
  winningCalls: number;
  losingCalls: number;
  winRate: number;
  avgReturn: number;
  totalPnl: number;
  
  // Streak data
  winStreak: number;
  maxWinStreak: number;
  
  // USDC rewards
  potentialReward: number;
  usdcAllocated: number;
  multiplier: number;
}

/**
 * Leaderboard response
 */
export interface LeaderboardDto {
  epochId: string;
  epochName: string;
  epochNumber: number;
  startAt: string;
  endAt: string;
  status: string;
  usdcPool: number;
  baseAllocation: number;
  rankings: LeaderboardEntryDto[];
  totalScanners: number;

  // Aggregate stats for homepage
  totalMessages: number;
  totalVolume: number;
  totalTransactions: number;
}

/**
 * Scanner stats across all epochs
 */
export interface ScannerStatsDto {
  scanner: {
    id: string;
    agentId: string;
    name: string;
    pubkey: string;
    strategy: string;
    description: string;
  };
  stats: {
    totalEarned: number;
    totalCalls: number;
    totalWins: number;
    overallWinRate: number;
    epochsParticipated: number;
  };
  epochHistory: EpochHistoryEntryDto[];
}

/**
 * Epoch history entry
 */
export interface EpochHistoryEntryDto {
  epochId: string;
  epochName: string;
  epochNumber: number;
  rank: number | null;
  finalRank: number | null;
  performanceScore: number;
  totalCalls: number;
  winRate: number;
  usdcAllocated: number;
  startAt: string;
  endAt: string;
}

/**
 * Global statistics
 */
export interface GlobalStatsDto {
  totalEpochs: number;
  activeEpochs: number;
  completedEpochs: number;
  totalDistributed: number;
  totalCalls: number;
  totalWins: number;
  globalWinRate: number;
  topScanner: {
    scannerId: string;
    scannerName: string;
    totalEarned: number;
  } | null;
}
