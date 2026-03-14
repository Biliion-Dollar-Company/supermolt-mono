/**
 * TEE + LayerZero integration helper.
 *
 * Provides a single sealAndBroadcast() entrypoint that:
 *  1. Seals a signal inside the Oasis ROFL TEE (runQuantInTEE + sealResult)
 *  2. Broadcasts the agent's reputation to all configured chains (LayerZero)
 *
 * Graceful degradation: any failure in either step returns a partial/mock result.
 * This function NEVER throws — safe to call in a production signal loop.
 *
 * @module
 */

import { runQuantInTEE, sealResult } from '../oasis/index.ts';
import { ReputationBroadcaster } from '../layerzero/index.ts';
import type { AgentSignal } from '../integrations/telegram-broadcaster.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Re-export AgentSignal as SignalData for semantic clarity in the TEE context */
export type SignalData = AgentSignal;

/** Result of a combined TEE seal + cross-chain broadcast */
export interface TEEBroadcastResult {
  /** Whether the TEE seal succeeded */
  sealed: boolean;
  /** HMAC seal hash (or 'mock-seal' on failure) */
  sealHash: string;
  /** Number of chains that acknowledged the broadcast */
  chainsReached: number;
  /** End-to-end latency in ms (0 on full failure) */
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Module-level broadcaster (shared, lazy-init)
// ---------------------------------------------------------------------------

let _broadcaster: ReputationBroadcaster | null = null;

function getBroadcaster(agentId: string): ReputationBroadcaster {
  if (!_broadcaster) {
    _broadcaster = new ReputationBroadcaster(agentId);
  }
  return _broadcaster;
}

/** Reset module broadcaster — used in tests */
export function _resetBroadcasterForTest(): void {
  _broadcaster = null;
}

// ---------------------------------------------------------------------------
// sealAndBroadcast
// ---------------------------------------------------------------------------

/**
 * Seals a trading signal inside the Oasis TEE and broadcasts the agent's
 * reputation score to all configured LayerZero chains.
 *
 * Steps:
 *  1. Build TEE input from the signal's key fields
 *  2. Call runQuantInTEE() — if it throws, fall back to mock
 *  3. Call sealResult() — catches internally, never throws
 *  4. Call ReputationBroadcaster.broadcastToAll() — if it throws, fall back to mock
 *  5. Return a TEEBroadcastResult
 *
 * @param signal - The trading signal to seal (AgentSignal / SignalData)
 * @param reputationScore - Brier-score-based reputation (0–1)
 * @param agentId - Agent identifier for the LZ broadcast (default: 'agent-alpha')
 * @returns TEEBroadcastResult — never throws
 *
 * @example
 * ```ts
 * const result = await sealAndBroadcast(signal, 0.85);
 * console.log(result.sealHash, result.chainsReached);
 * ```
 */
export async function sealAndBroadcast(
  signal: SignalData,
  reputationScore: number,
  agentId = 'agent-alpha',
): Promise<TEEBroadcastResult> {
  const startMs = Date.now();

  // --- Step 1 & 2: TEE seal ---
  let sealHash = 'mock-seal';
  let sealed = false;

  try {
    const teeInput = {
      payload: {
        marketName: signal.marketName,
        direction: signal.direction,
        currentPriceCents: signal.currentPriceCents,
        evScorePercent: signal.evScorePercent,
        kellySizePercent: signal.kellySizePercent,
        confidencePercent: signal.confidencePercent,
        reputationScore,
      },
    };

    const teeResult = await runQuantInTEE(teeInput);
    const sealedResult = sealResult(teeResult);

    sealHash = sealedResult.sealHash;
    sealed = true;
  } catch (err) {
    console.warn('[tee-integration] TEE sealing failed, using mock seal:', err);
    sealHash = 'mock-seal';
    sealed = false;
  }

  // --- Step 3: Cross-chain broadcast ---
  let chainsReached = 0;

  try {
    const broadcaster = getBroadcaster(agentId);
    const broadcastResult = await broadcaster.broadcastToAll(reputationScore, sealHash);
    chainsReached = broadcastResult.chainsReached;
  } catch (err) {
    console.warn('[tee-integration] LayerZero broadcast failed:', err);
    chainsReached = 0;
  }

  const latencyMs = Date.now() - startMs;

  return {
    sealed,
    sealHash,
    chainsReached,
    latencyMs,
  };
}
