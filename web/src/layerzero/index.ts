/**
 * LayerZero cross-chain reputation broadcast integration.
 *
 * Broadcasts agent reputation scores to multiple EVM chains via LayerZero's
 * messaging protocol. Enables cross-chain verifiable signal provenance.
 *
 * Graceful degradation: all functions catch errors and log warnings when
 * the LayerZero endpoint or private key is not configured.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Chain descriptor */
export interface ChainTarget {
  /** LayerZero chain ID */
  chainId: number;
  /** Human-readable chain name */
  name: string;
  /** OApp contract address on the target chain */
  oAppAddress: string;
}

/** Reputation payload to broadcast */
export interface ReputationPayload {
  /** Agent identifier (e.g. ENS name or wallet address) */
  agentId: string;
  /** Brier-score-based reputation (0–1, higher is better) */
  reputationScore: number;
  /** Number of resolved predictions used to compute score */
  sampleCount: number;
  /** ISO timestamp of the broadcast */
  broadcastAt: string;
  /** Optional signal hash for provenance */
  signalHash?: string;
}

/** Result of a single chain broadcast */
export interface ChainBroadcastResult {
  chainId: number;
  chainName: string;
  success: boolean;
  txHash?: string;
  errorMessage?: string;
}

/** Aggregated broadcast result */
export interface BroadcastAllResult {
  chainsReached: number;
  chainResults: ChainBroadcastResult[];
  broadcastAt: string;
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Default chain targets
// ---------------------------------------------------------------------------

/** Default chains targeted by reputation broadcasts */
export const DEFAULT_CHAINS: ChainTarget[] = [
  { chainId: 30101, name: 'Ethereum', oAppAddress: '0x0000000000000000000000000000000000000001' },
  { chainId: 30110, name: 'Arbitrum', oAppAddress: '0x0000000000000000000000000000000000000002' },
  { chainId: 30125, name: 'Polygon', oAppAddress: '0x0000000000000000000000000000000000000003' },
];

// ---------------------------------------------------------------------------
// LayerZeroClient
// ---------------------------------------------------------------------------

/**
 * Client for the LayerZero OApp messaging protocol.
 *
 * Wraps low-level LZ endpoint calls with mock fallback.
 */
export class LayerZeroClient {
  private readonly endpoint: string | undefined;
  private readonly privateKey: string | undefined;

  constructor() {
    this.endpoint = process.env.LAYERZERO_ENDPOINT;
    this.privateKey = process.env.LAYERZERO_PRIVATE_KEY;
  }

  /**
   * Returns true if the client is configured for production use.
   */
  isConfigured(): boolean {
    return Boolean(this.endpoint && this.privateKey);
  }

  /**
   * Sends a message to a single chain via LayerZero.
   *
   * @param target - Target chain descriptor
   * @param payload - Reputation payload to transmit
   * @returns ChainBroadcastResult — never throws
   */
  async sendToChain(
    target: ChainTarget,
    payload: ReputationPayload,
  ): Promise<ChainBroadcastResult> {
    if (!this.isConfigured()) {
      console.log(
        `[layerzero] Mock broadcast → chain ${target.name} (${target.chainId}) | score=${payload.reputationScore.toFixed(3)}`,
      );
      // Mock mode: simulate success with a fake tx hash
      return {
        chainId: target.chainId,
        chainName: target.name,
        success: true,
        txHash: `0xmock${Date.now().toString(16)}${target.chainId}`,
      };
    }

    try {
      const response = await fetch(`${this.endpoint}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.privateKey}`,
        },
        body: JSON.stringify({
          dstChainId: target.chainId,
          dstOApp: target.oAppAddress,
          payload,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as { txHash: string };

      return {
        chainId: target.chainId,
        chainName: target.name,
        success: true,
        txHash: data.txHash,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[layerzero] Failed to broadcast to ${target.name}: ${errorMessage}`,
      );
      return {
        chainId: target.chainId,
        chainName: target.name,
        success: false,
        errorMessage,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// ReputationBroadcaster
// ---------------------------------------------------------------------------

/**
 * Broadcasts agent reputation scores to all configured chains.
 */
export class ReputationBroadcaster {
  private readonly client: LayerZeroClient;
  private readonly chains: ChainTarget[];
  private readonly agentId: string;

  constructor(agentId: string, chains: ChainTarget[] = DEFAULT_CHAINS) {
    this.client = new LayerZeroClient();
    this.chains = chains;
    this.agentId = agentId;
  }

  /**
   * Broadcasts the reputation score to all configured chains.
   *
   * @param reputationScore - Brier-score-based reputation (0–1)
   * @param signalHash - Optional signal hash for provenance
   * @returns BroadcastAllResult — never throws
   */
  async broadcastToAll(
    reputationScore: number,
    signalHash?: string,
  ): Promise<BroadcastAllResult> {
    return broadcastToAll(this.agentId, reputationScore, this.chains, this.client, signalHash);
  }
}

// ---------------------------------------------------------------------------
// broadcastToAll (standalone)
// ---------------------------------------------------------------------------

/**
 * Broadcasts an agent's reputation score to all target chains.
 *
 * Standalone function usable without instantiating ReputationBroadcaster.
 *
 * @param agentId - Agent identifier
 * @param reputationScore - Brier-score-based reputation (0–1)
 * @param chains - Target chains (defaults to DEFAULT_CHAINS)
 * @param client - Optional pre-configured LayerZeroClient
 * @param signalHash - Optional signal hash for provenance
 * @returns BroadcastAllResult — never throws
 *
 * @example
 * ```ts
 * const result = await broadcastToAll('surgecast.eth', 0.85);
 * console.log(`Reached ${result.chainsReached} chains`);
 * ```
 */
export async function broadcastToAll(
  agentId: string,
  reputationScore: number,
  chains: ChainTarget[] = DEFAULT_CHAINS,
  client: LayerZeroClient = new LayerZeroClient(),
  signalHash?: string,
): Promise<BroadcastAllResult> {
  const startMs = Date.now();
  const broadcastAt = new Date().toISOString();

  const payload: ReputationPayload = {
    agentId,
    reputationScore,
    sampleCount: 0, // caller can extend with real sample count
    broadcastAt,
    signalHash,
  };

  const results = await Promise.allSettled(
    chains.map((chain) => client.sendToChain(chain, payload)),
  );

  const chainResults: ChainBroadcastResult[] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      chainId: chains[i]!.chainId,
      chainName: chains[i]!.name,
      success: false,
      errorMessage: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  const chainsReached = chainResults.filter((r) => r.success).length;
  const latencyMs = Date.now() - startMs;

  console.log(
    `[layerzero] Broadcast complete: ${chainsReached}/${chains.length} chains reached in ${latencyMs}ms`,
  );

  return {
    chainsReached,
    chainResults,
    broadcastAt,
    latencyMs,
  };
}
