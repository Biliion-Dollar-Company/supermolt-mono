import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import crypto from 'crypto';

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

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
    const messageBuffer = Buffer.from(nonce);
    const signatureBuffer = Buffer.from(signature, 'base64');

    console.log('Verifying signature:', {
      pubkey,
      nonceLength: nonce.length,
      signatureLength: signatureBuffer.length,
      publicKeyBuffer: publicKey.toBuffer().toString('hex').slice(0, 20)
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
