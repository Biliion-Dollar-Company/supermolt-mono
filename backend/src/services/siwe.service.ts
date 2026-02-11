/**
 * SIWE (Sign-In With Ethereum) Service
 *
 * Mirrors siws.service.ts for BSC/EVM agent authentication.
 * Agents sign EIP-4361 messages with their Ethereum private key.
 */

import crypto from 'crypto';
import { SiweMessage } from 'siwe';

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_CLEANUP_INTERVAL_MS = 60 * 1000;
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

// Periodic cleanup of expired nonces
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of nonceStore) {
    if (now > value.expiresAt) {
      nonceStore.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[SIWE] Cleaned ${cleaned} expired nonces, ${nonceStore.size} active`);
  }
}, NONCE_CLEANUP_INTERVAL_MS).unref();

/**
 * Generate a random nonce for agent to sign
 */
export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store nonce with expiry
 */
export function storeNonce(nonce: string): void {
  nonceStore.set(nonce, {
    nonce,
    expiresAt: Date.now() + NONCE_EXPIRY_MS,
  });
}

/**
 * Verify nonce is valid and not expired
 */
export function verifyNonceExists(nonce: string): boolean {
  const stored = nonceStore.get(nonce);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    nonceStore.delete(nonce);
    return false;
  }
  return true;
}

/**
 * Consume nonce after successful verification
 */
export function consumeNonce(nonce: string): void {
  nonceStore.delete(nonce);
}

// BSC Testnet chain ID
const BSC_TESTNET_CHAIN_ID = 97;
const BSC_MAINNET_CHAIN_ID = 56;

// Statement for SIWE messages
const SIWE_STATEMENT = 'Sign this message to authenticate your BSC agent with SuperMolt Arena';

// Domain for SIWE messages
const SIWE_DOMAIN = process.env.SIWE_DOMAIN || 'supermolt.xyz';
const SIWE_URI = process.env.SIWE_URI || 'https://supermolt.xyz';

/**
 * Get challenge parameters for agent to construct SIWE message
 */
export function getChallengeParams(nonce: string) {
  return {
    nonce,
    statement: SIWE_STATEMENT,
    domain: SIWE_DOMAIN,
    uri: SIWE_URI,
    chainId: BSC_TESTNET_CHAIN_ID,
    version: '1',
    expiresIn: 300, // 5 minutes
  };
}

/**
 * Verify SIWE signature
 *
 * Agent constructs an EIP-4361 message locally and signs with their private key.
 * We verify using the `siwe` package which handles EIP-4361 parsing + EIP-191 sig recovery.
 */
export async function verifySIWESignature(
  messageStr: string,
  signature: string,
  expectedNonce: string
): Promise<{ valid: boolean; address?: string }> {
  try {
    // Verify nonce exists and is not expired
    if (!verifyNonceExists(expectedNonce)) {
      console.error('[SIWE] Nonce not found or expired');
      return { valid: false };
    }

    // Parse and verify the SIWE message
    const siweMessage = new SiweMessage(messageStr);

    // Verify the signature (recovers address from sig)
    const result = await siweMessage.verify({
      signature,
      nonce: expectedNonce,
      domain: SIWE_DOMAIN,
    });

    if (!result.success) {
      console.error('[SIWE] Signature verification failed:', result.error);
      return { valid: false };
    }

    const address = siweMessage.address;

    console.log('[SIWE] Signature valid for address:', address);

    // Consume nonce after successful verification
    consumeNonce(expectedNonce);

    return { valid: true, address };
  } catch (error) {
    console.error('[SIWE] Verification error:', error);
    return { valid: false };
  }
}

/**
 * Validate EVM address format (0x + 40 hex chars)
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}
