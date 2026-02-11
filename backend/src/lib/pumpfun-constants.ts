/**
 * Pump.fun Program Constants — Solana Token Launcher
 *
 * Program: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P (mainnet)
 *
 * Pump.fun is the dominant Solana token launcher with bonding curve trading
 * and automatic graduation to PumpSwap at ~85 SOL raised.
 *
 * Sources:
 *   - github.com/pump-fun/pump-public-docs
 *   - pumpportal.fun/trading-api
 */

import { PublicKey } from '@solana/web3.js';

// ── Program Addresses ────────────────────────────────────

/** Pump.fun main program */
export const PUMP_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

/** Global state account */
export const PUMP_GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');

/** Fee recipient */
export const PUMP_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');

/** Event authority (for logging) */
export const PUMP_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');

/** Metaplex Token Metadata program */
export const MPL_TOKEN_METADATA = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// ── API Endpoints ────────────────────────────────────────

/** Pump.fun IPFS metadata upload */
export const PUMP_IPFS_URL = 'https://pump.fun/api/ipfs';

/** PumpPortal local transaction builder (no API key needed) */
export const PUMPPORTAL_LOCAL_TX_URL = 'https://pumpportal.fun/api/trade-local';

/** PumpPortal bundle endpoint for Jito bundles */
export const PUMPPORTAL_BUNDLE_URL = 'https://pumpportal.fun/api/trade';

// ── Tokenomics ───────────────────────────────────────────

/** Fixed total supply: 1 billion tokens */
export const PUMP_TOTAL_SUPPLY = 1_000_000_000;

/** Token decimals */
export const PUMP_TOKEN_DECIMALS = 6;

/** Tokens available for bonding curve trading (~79.3%) */
export const PUMP_TRADABLE_SUPPLY = 793_100_000;

/** SOL needed to fill bonding curve (~85 SOL) */
export const PUMP_GRADUATION_SOL = 85;

/** Creator reward on graduation */
export const PUMP_GRADUATION_REWARD_SOL = 0.5;

// ── Instruction Discriminators ───────────────────────────

/** SHA-256("global:create")[0..8] */
export const CREATE_DISCRIMINATOR = Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]);

/** SHA-256("global:buy")[0..8] */
export const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

/** SHA-256("global:sell")[0..8] */
export const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);
