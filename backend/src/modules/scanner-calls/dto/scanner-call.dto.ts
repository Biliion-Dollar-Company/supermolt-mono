/**
 * Scanner Call DTOs
 */

/**
 * Submit call request
 */
export interface SubmitCallDto {
  scannerId: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  convictionScore: number; // 0.00 - 1.00
  reasoning: string[];
  takeProfitPct?: number;
  stopLossPct?: number;
}

/**
 * Scanner call response
 */
export interface ScannerCallDto {
  id: string;
  scannerId: string;
  scannerName: string;
  epochId: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  convictionScore: number;
  reasoning: string[];
  entryPrice: number | null;
  exitPrice: number | null;
  currentPrice: number | null;
  pnlPercent: number | null;
  pnlUsd: number | null;
  status: string;
  takeProfitPct: number | null;
  stopLossPct: number | null;
  expiresAt: string | null;
  createdAt: string;
  closedAt: string | null;
}

/**
 * Close call request
 */
export interface CloseCallDto {
  exitPrice: number;
  status: 'win' | 'loss' | 'expired';
}

/**
 * Scanner calls list response
 */
export interface ScannerCallsListDto {
  scannerId: string;
  scannerName: string;
  calls: ScannerCallDto[];
  total: number;
  openCalls: number;
  closedCalls: number;
}

/**
 * Call statistics
 */
export interface CallStatsDto {
  total: number;
  open: number;
  wins: number;
  losses: number;
  expired: number;
  winRate: number;
  avgPnl: number;
}
