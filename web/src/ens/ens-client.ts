/**
 * ENS Client — Name resolution utilities for AI agent identity.
 *
 * Provides ENS name→address, address→name, avatar, and full agent profile
 * resolution using viem's publicClient. Falls back to a mock AgentProfile
 * when RPC is unavailable or the name is unregistered.
 *
 * @module ens-client
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Structured profile for an ENS-named agent.
 */
export type AgentProfile = {
  /** ENS name (e.g. "surgecast.eth") */
  name: string;
  /** Resolved Ethereum address, or null if unregistered */
  address: string | null;
  /** Avatar URL from the ENS avatar text record, or null */
  avatar: string | null;
  /** Description from the ENS "description" text record, or null */
  description: string | null;
  /** True when data is synthetic (RPC unavailable / name not found) */
  isMock: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Demo fallback profile used when the RPC or ENS lookup fails. */
export const MOCK_AGENT_PROFILE: AgentProfile = {
  name: 'surgecast.eth',
  address: '0x000000000000000000000000000000000000dEaD',
  avatar: null,
  description: 'SurgeCast AI prediction agent — demo mode (no live RPC)',
  isMock: true,
};

/** Public Ethereum mainnet RPC (rate-limited but free). */
const DEFAULT_RPC = 'https://eth.llamarpc.com';

// ---------------------------------------------------------------------------
// Client factory (injectable for tests)
// ---------------------------------------------------------------------------

let _clientOverride: PublicClient | null = null;

/**
 * Overrides the viem publicClient used for ENS resolution.
 * Intended for tests — pass `null` to reset to the real client.
 *
 * @param client - A mock or custom publicClient, or null to clear
 */
export function setEnsClientOverride(client: PublicClient | null): void {
  _clientOverride = client;
}

/**
 * Returns the active viem publicClient, preferring any injected override.
 */
export function getEnsClient(): PublicClient {
  if (_clientOverride !== null) return _clientOverride;
  return createPublicClient({
    chain: mainnet,
    transport: http(DEFAULT_RPC),
  });
}

// ---------------------------------------------------------------------------
// Core resolution functions
// ---------------------------------------------------------------------------

/**
 * Resolves an ENS name to its registered Ethereum address.
 *
 * @param name - ENS name (e.g. "surgecast.eth")
 * @returns Ethereum address string, or null if unregistered / RPC error
 *
 * @example
 * const addr = await resolveAddress('surgecast.eth');
 * // "0xAbC..." or null
 */
export async function resolveAddress(name: string): Promise<string | null> {
  try {
    const client = getEnsClient();
    const address = await client.getEnsAddress({ name: normalize(name) });
    return address ?? null;
  } catch {
    return null;
  }
}

/**
 * Reverse-looks up an Ethereum address to its primary ENS name.
 *
 * @param address - Ethereum address (checksummed or lowercase)
 * @returns ENS name string, or null if no reverse record / RPC error
 *
 * @example
 * const name = await resolveName('0xAbC...');
 * // "surgecast.eth" or null
 */
export async function resolveName(address: string): Promise<string | null> {
  try {
    const client = getEnsClient();
    const name = await client.getEnsName({ address: address as `0x${string}` });
    return name ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches the avatar text record for an ENS name.
 *
 * @param name - ENS name
 * @returns Avatar URL string, or null if not set / RPC error
 */
export async function getEnsAvatar(name: string): Promise<string | null> {
  try {
    const client = getEnsClient();
    const avatar = await client.getEnsAvatar({ name: normalize(name) });
    return avatar ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches a single text record for an ENS name.
 *
 * @param name - ENS name
 * @param key  - Text record key (e.g. "description", "url")
 * @returns Text record value, or null if not set / RPC error
 */
export async function getEnsText(name: string, key: string): Promise<string | null> {
  try {
    const client = getEnsClient();
    const text = await client.getEnsText({ name: normalize(name), key });
    return text ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves a full agent profile from an ENS name.
 *
 * Fetches address, avatar, and description in parallel. If the primary
 * address lookup fails entirely (RPC error), returns {@link MOCK_AGENT_PROFILE}.
 *
 * @param name - ENS name (e.g. "surgecast.eth")
 * @returns Populated AgentProfile (possibly mock)
 *
 * @example
 * const profile = await getAgentProfile('surgecast.eth');
 * console.log(profile.address); // "0x..." or null
 * console.log(profile.isMock);  // false (live) | true (demo fallback)
 */
export async function getAgentProfile(name: string): Promise<AgentProfile> {
  try {
    const [address, avatar, description] = await Promise.all([
      resolveAddress(name),
      getEnsAvatar(name),
      getEnsText(name, 'description'),
    ]);

    // If address came back null the name simply isn't registered — still real data
    return {
      name,
      address,
      avatar,
      description,
      isMock: false,
    };
  } catch {
    // Complete RPC failure → return demo profile so the UI still renders
    return { ...MOCK_AGENT_PROFILE, name };
  }
}
