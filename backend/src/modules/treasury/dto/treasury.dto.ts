/**
 * Treasury DTOs (Data Transfer Objects)
 * 
 * Request/response types for treasury endpoints
 */

/**
 * Treasury status response
 */
export interface TreasuryStatusDto {
  totalBalance: number;
  allocated: number;
  distributed: number;
  available: number;
  currentEpoch: string | null;
  treasuryWallet: string;
  lastUpdated: string;
}

/**
 * Single allocation calculation
 */
export interface AllocationDto {
  scannerId: string;
  scannerName: string;
  pubkey: string;
  rank: number;
  performanceScore: number;
  winRate: number;
  totalCalls: number;
  usdcAmount: number;
  multiplier: number;
}

/**
 * Allocation calculation response
 */
export interface AllocationCalculationDto {
  epochId: string;
  epochName: string;
  allocations: AllocationDto[];
  totalAmount: number;
  scannerCount: number;
}

/**
 * Transaction result
 */
export interface TransactionResultDto {
  scannerId: string;
  scannerName: string;
  signature: string;
  status: 'success' | 'failed';
  amount: number;
  error?: string;
}

/**
 * Distribution result response
 */
export interface DistributionResultDto {
  epochId: string;
  epochName: string;
  allocations: AllocationDto[];
  transactions: TransactionResultDto[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    timestamp: string;
  };
}

/**
 * Scanner allocation history item
 */
export interface ScannerAllocationHistoryDto {
  id: string;
  epochId: string;
  epochName: string;
  amount: number;
  performanceScore: number;
  rank: number;
  txSignature: string | null;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt: string | null;
}

/**
 * Scanner allocation history response
 */
export interface ScannerAllocationsDto {
  scannerId: string;
  scannerName: string;
  allocations: ScannerAllocationHistoryDto[];
  totalEarned: number;
  allocationCount: number;
}

/**
 * Distribution request body
 */
export interface DistributeEpochRequestDto {
  epochId: string;
  dryRun?: boolean; // Preview only, don't execute
}
