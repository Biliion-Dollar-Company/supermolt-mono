/**
 * Circle Gateway Service
 *
 * Unified cross-chain USDC distribution layer using Circle's Gateway API.
 * Supports Solana, Ethereum, Base, Polygon, Avalanche, Optimism, and Arbitrum.
 *
 * Set CIRCLE_GATEWAY_MOCK=true for offline/CI use — all methods return
 * realistic mock data and no HTTP requests are made.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Aggregated USDC balance across all chains managed by Circle Gateway */
export interface CircleGatewayBalance {
  /** Total USDC held across all chains */
  totalUsdc: number;
  /** Per-chain breakdown: chain name → USDC amount */
  byChain: Record<string, number>;
  /** When this snapshot was fetched */
  lastUpdated: Date;
}

/** Fee estimate for a pending cross-chain transfer */
export interface TransferEstimate {
  /** Fee in USDC */
  fee: number;
  /** Chain the fee is charged on */
  feeChain: string;
  /** When this estimate expires (typically ~60 s) */
  expiresAt: Date;
  /** Human-readable time estimate, e.g. "< 30 seconds" */
  estimatedTime: string;
}

/** Result returned after executing a cross-chain USDC transfer */
export interface TransferResult {
  transactionHash: string;
  sourceChain: string;
  destinationChain: string;
  /** USDC amount sent (excluding fee) */
  amount: number;
  fee: number;
  status: 'pending' | 'completed' | 'failed';
  /** Block-explorer URL for the source transaction */
  explorerUrl: string;
}

/** One reward recipient in an epoch distribution */
export interface RewardRecipient {
  agentId: string;
  agentName: string;
  walletAddress: string;
  destinationChain: 'solana' | 'ethereum' | 'base' | 'polygon';
  /** USDC amount to send */
  amount: number;
  /** Leaderboard rank (1 = first place) */
  rank: number;
}

/** Summary returned after distributing rewards to all epoch winners */
export interface DistributionSummary {
  epochId: string;
  totalDistributed: number;
  totalFees: number;
  recipients: Array<RewardRecipient & { result: TransferResult }>;
  completedAt: Date;
  status: 'completed' | 'partial' | 'failed';
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const SUPPORTED_CHAINS = [
  'solana',
  'ethereum',
  'base',
  'polygon',
  'avalanche',
  'optimism',
  'arbitrum',
] as const;

type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

/** Exponential-backoff retry wrapper (max 3 attempts) */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = 200 * Math.pow(2, attempt - 1); // 200 ms, 400 ms, 800 ms
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw new Error(
    `[CircleGateway] ${label} failed after ${maxAttempts} attempts: ${String(lastError)}`,
  );
}

/** Build a Circle Gateway explorer URL for a given chain + tx hash */
function buildExplorerUrl(chain: string, txHash: string): string {
  const explorers: Record<string, string> = {
    solana: `https://solscan.io/tx/${txHash}`,
    ethereum: `https://etherscan.io/tx/${txHash}`,
    base: `https://basescan.org/tx/${txHash}`,
    polygon: `https://polygonscan.com/tx/${txHash}`,
    avalanche: `https://snowtrace.io/tx/${txHash}`,
    optimism: `https://optimistic.etherscan.io/tx/${txHash}`,
    arbitrum: `https://arbiscan.io/tx/${txHash}`,
  };
  return explorers[chain] ?? `https://etherscan.io/tx/${txHash}`;
}

// ── Mock data factories ───────────────────────────────────────────────────────

function mockBalance(): CircleGatewayBalance {
  return {
    totalUsdc: 10_000,
    byChain: {
      ethereum: 4_000,
      base: 2_500,
      polygon: 1_500,
      solana: 1_000,
      avalanche: 500,
      optimism: 300,
      arbitrum: 200,
    },
    lastUpdated: new Date(),
  };
}

function mockEstimate(destinationChain: string): TransferEstimate {
  return {
    fee: 0.25,
    feeChain: 'ethereum',
    expiresAt: new Date(Date.now() + 60_000),
    estimatedTime: destinationChain === 'solana' ? '< 30 seconds' : '< 15 seconds',
  };
}

function mockTransfer(
  to: string,
  amount: number,
  destinationChain: string,
  sourceChain: string,
): TransferResult {
  const fakeTxHash = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('')}`;

  return {
    transactionHash: fakeTxHash,
    sourceChain,
    destinationChain,
    amount,
    fee: 0.25,
    status: 'completed',
    explorerUrl: buildExplorerUrl(destinationChain, fakeTxHash),
  };
}

// ── Service class ─────────────────────────────────────────────────────────────

export class CircleGatewayService {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly mockMode: boolean;
  private readonly sourceChain: string;

  constructor() {
    this.baseUrl =
      process.env.CIRCLE_GATEWAY_BASE_URL ??
      'https://gateway-api-testnet.circle.com';
    this.apiKey = process.env.CIRCLE_GATEWAY_API_KEY ?? null;
    this.mockMode =
      (process.env.CIRCLE_GATEWAY_MOCK ?? '').toLowerCase() === 'true';
    this.sourceChain =
      process.env.CIRCLE_GATEWAY_SOURCE_CHAIN ?? 'ethereum';
  }

  /** Whether the service has real credentials configured */
  isConfigured(): boolean {
    return this.mockMode || this.apiKey !== null;
  }

  // ── Private HTTP client ─────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('[CircleGateway] CIRCLE_GATEWAY_API_KEY is not set');
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `[CircleGateway] HTTP ${res.status} ${res.statusText} for ${method} ${path}: ${text}`,
      );
    }

    return res.json() as Promise<T>;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Fetch unified USDC balance across all chains.
   *
   * In mock mode returns realistic static data so the system works fully
   * offline or in CI without real credentials.
   */
  async getUnifiedBalance(): Promise<CircleGatewayBalance> {
    if (this.mockMode) return mockBalance();

    return withRetry(async () => {
      const raw = await this.request<{
        totalUsdc: number;
        byChain: Record<string, number>;
      }>('GET', '/v1/balance');

      return {
        totalUsdc: raw.totalUsdc,
        byChain: raw.byChain,
        lastUpdated: new Date(),
      };
    }, 'getUnifiedBalance');
  }

  /**
   * Get fee + timing estimate for a cross-chain USDC transfer.
   *
   * @param to - Destination wallet address
   * @param amount - USDC amount to send
   * @param destinationChain - Target chain (e.g. "base", "solana")
   */
  async estimateTransfer(
    to: string,
    amount: number,
    destinationChain: string,
  ): Promise<TransferEstimate> {
    if (!SUPPORTED_CHAINS.includes(destinationChain as SupportedChain)) {
      throw new Error(
        `[CircleGateway] Unsupported destination chain: "${destinationChain}". ` +
          `Supported: ${SUPPORTED_CHAINS.join(', ')}`,
      );
    }

    if (this.mockMode) return mockEstimate(destinationChain);

    return withRetry(async () => {
      const raw = await this.request<{
        fee: number;
        feeChain: string;
        expiresAt: string;
        estimatedTime: string;
      }>('POST', '/v1/estimate', {
        sourceChain: this.sourceChain,
        destinationChain,
        recipientAddress: to,
        amount,
        currency: 'USDC',
      });

      return {
        fee: raw.fee,
        feeChain: raw.feeChain,
        expiresAt: new Date(raw.expiresAt),
        estimatedTime: raw.estimatedTime,
      };
    }, 'estimateTransfer');
  }

  /**
   * Execute a cross-chain USDC transfer from the treasury to a recipient.
   *
   * @param to - Destination wallet address
   * @param amount - USDC amount to send
   * @param destinationChain - Target chain
   */
  async executeTransfer(
    to: string,
    amount: number,
    destinationChain: string,
  ): Promise<TransferResult> {
    if (!SUPPORTED_CHAINS.includes(destinationChain as SupportedChain)) {
      throw new Error(
        `[CircleGateway] Unsupported destination chain: "${destinationChain}". ` +
          `Supported: ${SUPPORTED_CHAINS.join(', ')}`,
      );
    }

    if (amount <= 0) {
      throw new Error(`[CircleGateway] Transfer amount must be positive, got ${amount}`);
    }

    if (this.mockMode) {
      return mockTransfer(to, amount, destinationChain, this.sourceChain);
    }

    return withRetry(async () => {
      const raw = await this.request<{
        transactionHash: string;
        sourceChain: string;
        destinationChain: string;
        amount: number;
        fee: number;
        status: 'pending' | 'completed' | 'failed';
      }>('POST', '/v1/transfer', {
        sourceChain: this.sourceChain,
        destinationChain,
        recipientAddress: to,
        amount,
        currency: 'USDC',
      });

      return {
        transactionHash: raw.transactionHash,
        sourceChain: raw.sourceChain,
        destinationChain: raw.destinationChain,
        amount: raw.amount,
        fee: raw.fee,
        status: raw.status,
        explorerUrl: buildExplorerUrl(raw.destinationChain, raw.transactionHash),
      };
    }, `executeTransfer(${to}, ${amount} USDC → ${destinationChain})`);
  }

  /**
   * Batch-distribute USDC rewards to all epoch winners.
   *
   * Transfers are executed sequentially to avoid nonce collisions on the source
   * chain. The summary status is:
   * - "completed" — every transfer succeeded
   * - "partial"   — at least one succeeded but at least one failed
   * - "failed"    — every transfer failed
   *
   * @param recipients - Array of reward recipients with amounts and destination chains
   */
  async distributeRewards(
    recipients: RewardRecipient[],
  ): Promise<DistributionSummary> {
    if (recipients.length === 0) {
      throw new Error('[CircleGateway] distributeRewards called with empty recipients list');
    }

    const epochId = `epoch-${Date.now()}`;
    const resultsWithRecipients: Array<RewardRecipient & { result: TransferResult }> = [];
    let totalDistributed = 0;
    let totalFees = 0;
    let successCount = 0;

    for (const recipient of recipients) {
      try {
        const result = await this.executeTransfer(
          recipient.walletAddress,
          recipient.amount,
          recipient.destinationChain,
        );

        totalDistributed += recipient.amount;
        totalFees += result.fee;
        successCount++;

        resultsWithRecipients.push({ ...recipient, result });
      } catch (err) {
        const failedResult: TransferResult = {
          transactionHash: '',
          sourceChain: this.sourceChain,
          destinationChain: recipient.destinationChain,
          amount: recipient.amount,
          fee: 0,
          status: 'failed',
          explorerUrl: '',
        };

        resultsWithRecipients.push({ ...recipient, result: failedResult });
      }
    }

    let status: DistributionSummary['status'];
    if (successCount === recipients.length) {
      status = 'completed';
    } else if (successCount === 0) {
      status = 'failed';
    } else {
      status = 'partial';
    }

    return {
      epochId,
      totalDistributed,
      totalFees,
      recipients: resultsWithRecipients,
      completedAt: new Date(),
      status,
    };
  }
}

/** Singleton instance — import this throughout the app */
export const circleGateway = new CircleGatewayService();
