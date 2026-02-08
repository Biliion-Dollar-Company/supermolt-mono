import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import crypto from 'crypto';

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_CLEANUP_INTERVAL_MS = 60 * 1000; // Cleanup every 60 seconds
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

// Periodic cleanup of expired nonces to prevent memory leak
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
    console.log(`[SIWS] Cleaned ${cleaned} expired nonces, ${nonceStore.size} active`);
  }
}, NONCE_CLEANUP_INTERVAL_MS).unref(); // .unref() so this doesn't prevent process exit

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
    expiresAt: Date.now() + NONCE_EXPIRY_MS
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
 * Clean up nonce after use
 */
export function consumeNonce(nonce: string): void {
  nonceStore.delete(nonce);
}

/** The statement sent to the frontend in the challenge response */
const SIWS_STATEMENT = 'Sign this message to authenticate your Solana agent with Trench';

/**
 * Verify SIWS signature
 */
export function verifySIWSSignature(
  pubkey: string,
  signature: string,
  nonce: string
): boolean {
  try {
    // Verify nonce exists and is not expired
    if (!verifyNonceExists(nonce)) {
      console.error('Nonce not found or expired');
      return false;
    }

    // Convert to Solana keypair format
    const publicKey = new PublicKey(pubkey);

    // The frontend signs: "${statement}\n\nNonce: ${nonce}"
    // We must verify against the same message
    const fullMessage = `${SIWS_STATEMENT}\n\nNonce: ${nonce}`;
    const messageBuffer = Buffer.from(fullMessage);

    // Frontend encodes signature as base58 (bs58.encode)
    // Try base58 first, fall back to base64 for backwards compatibility
    let signatureBuffer: Uint8Array;
    try {
      signatureBuffer = bs58.decode(signature);
    } catch {
      signatureBuffer = Buffer.from(signature, 'base64');
    }

    console.log('Verifying signature:', {
      pubkey,
      messageLength: fullMessage.length,
      signatureLength: signatureBuffer.length,
      signatureEncoding: signatureBuffer.length === 64 ? 'valid' : 'suspicious',
    });

    // Verify the signature using tweetnacl
    const isValid = nacl.sign.detached.verify(
      messageBuffer,
      signatureBuffer,
      publicKey.toBuffer()
    );

    console.log('Signature valid:', isValid);

    if (isValid) {
      consumeNonce(nonce); // Use once, then discard
    }

    return isValid;
  } catch (error) {
    console.error('SIWS verification error:', error);
    return false;
  }
}

/**
 * Extract agent pubkey from Solana address
 */
export function extractPubkeyFromAddress(address: string): string {
  try {
    new PublicKey(address); // Validate it's a valid Solana address
    return address;
  } catch {
    throw new Error('Invalid Solana address');
  }
}
