/**
 * Oasis ROFL TEE integration — stubs for on-chain Trusted Execution Environment.
 *
 * In production, these functions interact with the Oasis Network's ROFL TEE
 * runtime for hardware-attested computation sealing.
 *
 * Graceful degradation: all functions catch errors and return mock data
 * when the TEE runtime is unavailable (e.g., local development).
 *
 * @module
 */

import { createHash, createHmac } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input to TEE computation */
export interface TEEComputationInput {
  /** Serializable payload to compute inside the TEE */
  payload: Record<string, unknown>;
  /** Optional nonce for replay protection */
  nonce?: string;
}

/** Result of a TEE computation */
export interface TEEComputationResult {
  /** The computed output */
  output: Record<string, unknown>;
  /** SHA-256 hash of the input payload */
  inputHash: string;
  /** Timestamp of computation */
  computedAt: string;
  /** Whether this ran in a real TEE or mock mode */
  isMock: boolean;
}

/** HMAC-sealed result */
export interface SealedResult {
  /** The original result */
  result: TEEComputationResult;
  /** HMAC-SHA256 seal over the result content */
  sealHash: string;
  /** Seal algorithm identifier */
  algorithm: 'hmac-sha256';
}

/** TEE attestation report */
export interface AttestationReport {
  /** Whether attestation succeeded */
  attested: boolean;
  /** Quote (mock or real PCR measurements) */
  quote: string;
  /** Seal hash attested over */
  sealHash: string;
  /** Attestation timestamp */
  attestedAt: string;
}

// ---------------------------------------------------------------------------
// TEE secret (loaded from env; falls back to dev key)
// ---------------------------------------------------------------------------

const TEE_SECRET = process.env.OASIS_TEE_SECRET ?? 'dev-tee-secret-not-for-production';

// ---------------------------------------------------------------------------
// runQuantInTEE
// ---------------------------------------------------------------------------

/**
 * Runs a quantitative computation inside the Oasis ROFL Trusted Execution Environment.
 *
 * In production this dispatches to the ROFL runtime. In mock mode (no ROFL_ENDPOINT),
 * it performs the computation locally and marks the result as `isMock: true`.
 *
 * @param input - The computation payload to seal inside the TEE
 * @returns TEEComputationResult — never throws
 *
 * @example
 * ```ts
 * const result = await runQuantInTEE({ payload: { ev: 9.4, kelly: 0.03 } });
 * ```
 */
export async function runQuantInTEE(input: TEEComputationInput): Promise<TEEComputationResult> {
  const nonce = input.nonce ?? Date.now().toString(16);
  const payloadStr = JSON.stringify(input.payload);
  const inputHash = createHash('sha256').update(payloadStr).digest('hex');

  const roflEndpoint = process.env.ROFL_ENDPOINT;

  if (roflEndpoint) {
    try {
      const response = await fetch(`${roflEndpoint}/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: input.payload, nonce }),
      });

      if (!response.ok) {
        throw new Error(`ROFL endpoint error: ${response.status}`);
      }

      const data = (await response.json()) as { output: Record<string, unknown> };

      return {
        output: data.output,
        inputHash,
        computedAt: new Date().toISOString(),
        isMock: false,
      };
    } catch (err) {
      console.warn('[oasis-tee] ROFL endpoint unavailable, falling back to mock TEE:', err);
    }
  } else {
    console.log('[oasis-tee] ROFL_ENDPOINT not set — running in mock TEE mode');
  }

  // Mock TEE: compute locally, flag as mock
  return {
    output: { ...input.payload, _tee: 'mock' },
    inputHash,
    computedAt: new Date().toISOString(),
    isMock: true,
  };
}

// ---------------------------------------------------------------------------
// sealResult
// ---------------------------------------------------------------------------

/**
 * HMAC-seals a TEE computation result.
 *
 * Produces an HMAC-SHA256 seal over the canonical JSON of the result,
 * bound to the TEE_SECRET. In production the secret is a TEE-provisioned key.
 *
 * @param result - The TEE computation result to seal
 * @returns SealedResult — never throws
 *
 * @example
 * ```ts
 * const sealed = sealResult(teeResult);
 * console.log(sealed.sealHash); // "a3f9..."
 * ```
 */
export function sealResult(result: TEEComputationResult): SealedResult {
  try {
    const canonical = JSON.stringify({
      output: result.output,
      inputHash: result.inputHash,
      computedAt: result.computedAt,
    });

    const sealHash = createHmac('sha256', TEE_SECRET).update(canonical).digest('hex');

    return {
      result,
      sealHash,
      algorithm: 'hmac-sha256',
    };
  } catch (err) {
    console.error('[oasis-tee] sealResult failed, returning mock seal:', err);
    return {
      result,
      sealHash: 'mock-seal-fallback',
      algorithm: 'hmac-sha256',
    };
  }
}

// ---------------------------------------------------------------------------
// attestResult
// ---------------------------------------------------------------------------

/**
 * Generates a TEE attestation report for a sealed result.
 *
 * In production this calls the ROFL runtime's attestation API to get a
 * hardware-backed quote. In mock mode it returns a synthetic report.
 *
 * @param sealed - The sealed result to attest
 * @returns AttestationReport — never throws
 *
 * @example
 * ```ts
 * const report = await attestResult(sealedResult);
 * ```
 */
export async function attestResult(sealed: SealedResult): Promise<AttestationReport> {
  const roflEndpoint = process.env.ROFL_ENDPOINT;

  if (roflEndpoint) {
    try {
      const response = await fetch(`${roflEndpoint}/attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sealHash: sealed.sealHash }),
      });

      if (!response.ok) {
        throw new Error(`ROFL attest error: ${response.status}`);
      }

      const data = (await response.json()) as { quote: string };

      return {
        attested: true,
        quote: data.quote,
        sealHash: sealed.sealHash,
        attestedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('[oasis-tee] Attestation endpoint unavailable, returning mock report:', err);
    }
  }

  // Mock attestation report
  const mockQuote = createHash('sha256')
    .update(`mock-quote:${sealed.sealHash}`)
    .digest('hex');

  return {
    attested: false,
    quote: `mock-pcr:${mockQuote.slice(0, 32)}`,
    sealHash: sealed.sealHash,
    attestedAt: new Date().toISOString(),
  };
}
