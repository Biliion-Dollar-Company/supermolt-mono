/**
 * KeyManager — Centralized private key management with encryption at rest.
 *
 * Features:
 *   - AES-256-GCM encryption for stored keys (when KEY_ENCRYPTION_KEY is set)
 *   - In-memory cache (keys never written to disk decrypted)
 *   - Audit logging for every key access
 *   - Typed helpers for Solana (Keypair), BSC/ETH (viem Account), and raw PEM
 *   - Key rotation support via re-encryption
 *
 * Usage:
 *   import { keyManager } from '@/services/key-manager.service';
 *   const keypair = keyManager.getSolanaKeypair('AGENT_ALPHA_PRIVATE_KEY');
 *   const account = keyManager.getEvmAccount('BSC_TREASURY_PRIVATE_KEY');
 */

import crypto from 'crypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

// ── Types ─────────────────────────────────────────────────

interface KeyAccessLog {
  envVar: string;
  service: string;
  timestamp: number;
  action: 'load' | 'decrypt' | 'encrypt' | 'rotate';
}

interface EncryptedPayload {
  /** AES-256-GCM initialization vector (hex) */
  iv: string;
  /** AES-256-GCM auth tag (hex) */
  tag: string;
  /** Encrypted ciphertext (hex) */
  data: string;
}

// ── KeyManager ────────────────────────────────────────────

class KeyManager {
  /** 32-byte master key derived from KEY_ENCRYPTION_KEY (if set) */
  private masterKey: Buffer | null = null;
  /** In-memory cache: envVar → decrypted plaintext */
  private cache = new Map<string, string>();
  /** Audit trail (in-memory ring buffer, last 500 entries) */
  private auditLog: KeyAccessLog[] = [];
  private readonly MAX_LOG_ENTRIES = 500;
  /** Whether encryption is enabled */
  readonly encryptionEnabled: boolean;

  constructor() {
    const rawKey = process.env.KEY_ENCRYPTION_KEY;
    if (rawKey && rawKey.length >= 32) {
      // Derive a 32-byte key via SHA-256 for AES-256
      this.masterKey = crypto.createHash('sha256').update(rawKey).digest();
      this.encryptionEnabled = true;
      console.log('[KeyManager] Encryption enabled (AES-256-GCM)');
    } else {
      this.encryptionEnabled = false;
      if (process.env.NODE_ENV === 'production') {
        console.warn(
          '[KeyManager] ⚠️  KEY_ENCRYPTION_KEY not set or too short (<32 chars). Keys stored in plaintext env vars.',
        );
      }
    }
  }

  // ── Core: Load key ───────────────────────────────────────

  /**
   * Load a private key from environment. Checks encrypted store first,
   * then falls back to plaintext env var.
   */
  getKey(envVar: string, service = 'unknown'): string | null {
    // 1. Check in-memory cache
    if (this.cache.has(envVar)) {
      this.log({ envVar, service, timestamp: Date.now(), action: 'load' });
      return this.cache.get(envVar)!;
    }

    // 2. Check for encrypted version (stored as ENCRYPTED_<envVar> in env)
    const encryptedRaw = process.env[`ENCRYPTED_${envVar}`];
    if (encryptedRaw && this.masterKey) {
      try {
        const decrypted = this.decrypt(encryptedRaw);
        this.cache.set(envVar, decrypted);
        this.log({ envVar, service, timestamp: Date.now(), action: 'decrypt' });
        return decrypted;
      } catch (err) {
        console.error(`[KeyManager] Failed to decrypt ${envVar}:`, (err as Error).message);
      }
    }

    // 3. Fallback to plaintext env var
    const plaintext = process.env[envVar];
    if (plaintext) {
      this.cache.set(envVar, plaintext);
      this.log({ envVar, service, timestamp: Date.now(), action: 'load' });
      return plaintext;
    }

    return null;
  }

  /**
   * Load a key, throw if missing.
   */
  requireKey(envVar: string, service = 'unknown'): string {
    const key = this.getKey(envVar, service);
    if (!key) {
      throw new Error(`[KeyManager] Required key ${envVar} not found (service: ${service})`);
    }
    return key;
  }

  // ── Solana Helpers ──────────────────────────────────────

  /**
   * Load a Solana Keypair from a Base58-encoded private key env var.
   */
  getSolanaKeypair(envVar: string, service = 'unknown'): Keypair | null {
    const raw = this.getKey(envVar, service);
    if (!raw) return null;
    try {
      return Keypair.fromSecretKey(bs58.decode(raw));
    } catch {
      console.error(`[KeyManager] Invalid Base58 Solana key in ${envVar}`);
      return null;
    }
  }

  /**
   * Load a Solana Keypair, throw if missing or invalid.
   */
  requireSolanaKeypair(envVar: string, service = 'unknown'): Keypair {
    const kp = this.getSolanaKeypair(envVar, service);
    if (!kp) {
      throw new Error(`[KeyManager] Valid Solana keypair required: ${envVar} (service: ${service})`);
    }
    return kp;
  }

  /**
   * Get a Solana keypair for an agent by ID.
   * Tries AGENT_PRIVATE_KEY_<ID> first, then optional fallback env var.
   */
  getAgentSolanaKeypair(agentId: string, fallbackEnvVar?: string, service = 'auto-buy'): Keypair | null {
    const envVar = `AGENT_PRIVATE_KEY_${agentId.toUpperCase()}`;
    const kp = this.getSolanaKeypair(envVar, service);
    if (kp) return kp;

    if (fallbackEnvVar) {
      return this.getSolanaKeypair(fallbackEnvVar, service);
    }
    return null;
  }

  // ── EVM Helpers (BSC / Ethereum) ────────────────────────

  /**
   * Load an EVM PrivateKeyAccount from a 0x-prefixed hex private key.
   */
  getEvmAccount(envVar: string, service = 'unknown'): PrivateKeyAccount | null {
    const raw = this.getKey(envVar, service);
    if (!raw) return null;
    try {
      const hex = raw.startsWith('0x') ? raw : `0x${raw}`;
      return privateKeyToAccount(hex as `0x${string}`);
    } catch {
      console.error(`[KeyManager] Invalid EVM private key in ${envVar}`);
      return null;
    }
  }

  /**
   * Load an EVM account, throw if missing or invalid.
   */
  requireEvmAccount(envVar: string, service = 'unknown'): PrivateKeyAccount {
    const acct = this.getEvmAccount(envVar, service);
    if (!acct) {
      throw new Error(`[KeyManager] Valid EVM account required: ${envVar} (service: ${service})`);
    }
    return acct;
  }

  /**
   * Get a BSC account for an agent by ID.
   * Tries BSC_PRIVATE_KEY_<ID> first, falls back to BSC_TREASURY_PRIVATE_KEY.
   */
  getAgentBscAccount(agentId: string, service = 'auto-buy'): PrivateKeyAccount | null {
    const envVar = `BSC_PRIVATE_KEY_${agentId.toUpperCase()}`;
    const acct = this.getEvmAccount(envVar, service);
    if (acct) return acct;

    return this.getEvmAccount('BSC_TREASURY_PRIVATE_KEY', service);
  }

  // ── PEM Helpers (Kalshi) ────────────────────────────────

  /**
   * Load a PEM-formatted private key. Handles base64-encoded PEM.
   */
  getPemKey(envVar: string, service = 'unknown'): string | null {
    const raw = this.getKey(envVar, service);
    if (!raw) return null;

    // If it's base64-wrapped PEM, decode it
    if (!raw.startsWith('-----BEGIN') && raw.length > 100) {
      try {
        return Buffer.from(raw, 'base64').toString('utf-8');
      } catch {
        return raw;
      }
    }
    return raw;
  }

  // ── Encryption / Decryption ─────────────────────────────

  /**
   * Encrypt a plaintext key for storage.
   * Returns JSON string of { iv, tag, data } (all hex).
   */
  encrypt(plaintext: string): string {
    if (!this.masterKey) {
      throw new Error('[KeyManager] Cannot encrypt: KEY_ENCRYPTION_KEY not set');
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted.toString('hex'),
    };
    return JSON.stringify(payload);
  }

  /**
   * Decrypt an encrypted payload string back to plaintext.
   */
  private decrypt(encryptedJson: string): string {
    if (!this.masterKey) {
      throw new Error('[KeyManager] Cannot decrypt: KEY_ENCRYPTION_KEY not set');
    }
    const payload: EncryptedPayload = JSON.parse(encryptedJson);
    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');
    const data = Buffer.from(payload.data, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  /**
   * Encrypt a plaintext env var and return the encrypted payload.
   * Useful for migrating from plaintext to encrypted storage.
   */
  encryptEnvVar(envVar: string): string | null {
    const plaintext = process.env[envVar];
    if (!plaintext) return null;
    return this.encrypt(plaintext);
  }

  // ── Key Rotation ────────────────────────────────────────

  /**
   * Re-encrypt all cached keys with a new master key.
   * Call after updating KEY_ENCRYPTION_KEY.
   */
  rotateEncryptionKey(newMasterKeyRaw: string): Map<string, string> {
    const newMasterKey = crypto.createHash('sha256').update(newMasterKeyRaw).digest();
    const reEncrypted = new Map<string, string>();

    for (const [envVar, plaintext] of this.cache) {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', newMasterKey, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();

      const payload: EncryptedPayload = {
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        data: encrypted.toString('hex'),
      };
      reEncrypted.set(`ENCRYPTED_${envVar}`, JSON.stringify(payload));
      this.log({ envVar, service: 'key-rotation', timestamp: Date.now(), action: 'rotate' });
    }

    this.masterKey = newMasterKey;
    return reEncrypted;
  }

  // ── Audit ───────────────────────────────────────────────

  private log(entry: KeyAccessLog) {
    this.auditLog.push(entry);
    if (this.auditLog.length > this.MAX_LOG_ENTRIES) {
      this.auditLog = this.auditLog.slice(-this.MAX_LOG_ENTRIES);
    }
  }

  /**
   * Get recent key access logs. Useful for admin endpoints.
   */
  getAuditLog(limit = 50): KeyAccessLog[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get stats about loaded keys.
   */
  getStats(): { cachedKeys: number; encryptionEnabled: boolean; auditEntries: number } {
    return {
      cachedKeys: this.cache.size,
      encryptionEnabled: this.encryptionEnabled,
      auditEntries: this.auditLog.length,
    };
  }

  /**
   * Clear all cached keys from memory. Use during shutdown.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ── Singleton Export ──────────────────────────────────────

export const keyManager = new KeyManager();
