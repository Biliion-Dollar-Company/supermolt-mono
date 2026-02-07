/**
 * Epoch DTOs
 */

/**
 * Create epoch request
 */
export interface CreateEpochDto {
  name: string;
  startAt: string; // ISO date
  endAt: string;   // ISO date
  usdcPool?: number;
  baseAllocation?: number;
}

/**
 * Epoch response
 */
export interface EpochDto {
  id: string;
  name: string;
  epochNumber: number;
  startAt: string;
  endAt: string;
  status: string;
  usdcPool: number;
  baseAllocation: number;
  createdAt: string;
  stats?: {
    totalScanners: number;
    totalCalls: number;
    totalDistributed: number;
  };
}

/**
 * Update epoch status request
 */
export interface UpdateEpochStatusDto {
  status: 'ACTIVE' | 'ENDED' | 'PAID';
}

/**
 * Epoch list response
 */
export interface EpochListDto {
  epochs: EpochDto[];
  total: number;
  active: string | null;
}
