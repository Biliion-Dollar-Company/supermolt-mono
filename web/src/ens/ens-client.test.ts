/**
 * Tests for ENS client and AgentIdentity.
 *
 * All tests run with zero network calls — the viem publicClient is
 * replaced with a lightweight mock via setEnsClientOverride().
 *
 * Coverage: resolveAddress, resolveName, getEnsAvatar, getEnsText,
 *           getAgentProfile (full / partial / mock fallback),
 *           AgentIdentity lifecycle and getIdentityCard format.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PublicClient } from 'viem';
import {
  resolveAddress,
  resolveName,
  getEnsAvatar,
  getEnsText,
  getAgentProfile,
  setEnsClientOverride,
  MOCK_AGENT_PROFILE,
} from './ens-client.ts';
import { AgentIdentity, defaultAgentIdentity } from './agent-identity.ts';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Creates a partial PublicClient mock with controllable ENS methods. */
function makeClient(overrides: Partial<{
  getEnsAddress: (args: { name: string }) => Promise<`0x${string}` | null>;
  getEnsName: (args: { address: `0x${string}` }) => Promise<string | null>;
  getEnsAvatar: (args: { name: string }) => Promise<string | null>;
  getEnsText: (args: { name: string; key: string }) => Promise<string | null>;
}>): PublicClient {
  return {
    getEnsAddress: overrides.getEnsAddress ?? vi.fn().mockResolvedValue(null),
    getEnsName: overrides.getEnsName ?? vi.fn().mockResolvedValue(null),
    getEnsAvatar: overrides.getEnsAvatar ?? vi.fn().mockResolvedValue(null),
    getEnsText: overrides.getEnsText ?? vi.fn().mockResolvedValue(null),
  } as unknown as PublicClient;
}

const REAL_ADDRESS = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12' as `0x${string}`;
const REAL_AVATAR = 'https://ipfs.io/ipfs/QmSurgecastAvatar';
const REAL_DESCRIPTION = 'SurgeCast AI prediction agent';

beforeEach(() => {
  // Reset override before each test
  setEnsClientOverride(null);
});

afterEach(() => {
  setEnsClientOverride(null);
});

// ---------------------------------------------------------------------------
// 1. resolveAddress — success
// ---------------------------------------------------------------------------

describe('resolveAddress', () => {
  it('returns address when ENS name is registered', async () => {
    setEnsClientOverride(
      makeClient({
        getEnsAddress: vi.fn().mockResolvedValue(REAL_ADDRESS),
      }),
    );

    const result = await resolveAddress('surgecast.eth');
    expect(result).toBe(REAL_ADDRESS);
  });

  // -------------------------------------------------------------------------
  // 2. resolveAddress — null for unknown name
  // -------------------------------------------------------------------------

  it('returns null when ENS name is not registered', async () => {
    setEnsClientOverride(
      makeClient({
        getEnsAddress: vi.fn().mockResolvedValue(null),
      }),
    );

    const result = await resolveAddress('unknown-name-that-does-not-exist.eth');
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 3. resolveAddress — mock fallback on RPC error
  // -------------------------------------------------------------------------

  it('returns null (graceful degradation) when RPC throws', async () => {
    setEnsClientOverride(
      makeClient({
        getEnsAddress: vi.fn().mockRejectedValue(new Error('Network error')),
      }),
    );

    const result = await resolveAddress('surgecast.eth');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. resolveName — success
// ---------------------------------------------------------------------------

describe('resolveName', () => {
  it('returns ENS name for a known address', async () => {
    setEnsClientOverride(
      makeClient({
        getEnsName: vi.fn().mockResolvedValue('surgecast.eth'),
      }),
    );

    const result = await resolveName(REAL_ADDRESS);
    expect(result).toBe('surgecast.eth');
  });

  // -------------------------------------------------------------------------
  // 5. resolveName — null for address with no reverse record
  // -------------------------------------------------------------------------

  it('returns null when address has no reverse ENS record', async () => {
    setEnsClientOverride(
      makeClient({
        getEnsName: vi.fn().mockResolvedValue(null),
      }),
    );

    const result = await resolveName('0x0000000000000000000000000000000000000001');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. getAgentProfile — full profile
// ---------------------------------------------------------------------------

describe('getAgentProfile', () => {
  it('returns full AgentProfile when all records are available', async () => {
    setEnsClientOverride(
      makeClient({
        getEnsAddress: vi.fn().mockResolvedValue(REAL_ADDRESS),
        getEnsAvatar: vi.fn().mockResolvedValue(REAL_AVATAR),
        getEnsText: vi.fn().mockResolvedValue(REAL_DESCRIPTION),
      }),
    );

    const profile = await getAgentProfile('surgecast.eth');

    expect(profile.name).toBe('surgecast.eth');
    expect(profile.address).toBe(REAL_ADDRESS);
    expect(profile.avatar).toBe(REAL_AVATAR);
    expect(profile.description).toBe(REAL_DESCRIPTION);
    expect(profile.isMock).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 7. getAgentProfile — partial (address only, no avatar/description)
  // -------------------------------------------------------------------------

  it('returns partial profile when only address is resolved', async () => {
    setEnsClientOverride(
      makeClient({
        getEnsAddress: vi.fn().mockResolvedValue(REAL_ADDRESS),
        getEnsAvatar: vi.fn().mockResolvedValue(null),
        getEnsText: vi.fn().mockResolvedValue(null),
      }),
    );

    const profile = await getAgentProfile('surgecast.eth');

    expect(profile.address).toBe(REAL_ADDRESS);
    expect(profile.avatar).toBeNull();
    expect(profile.description).toBeNull();
    expect(profile.isMock).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 8. getAgentProfile — unregistered name (address null, isMock false)
  // -------------------------------------------------------------------------

  it('returns isMock=false profile with null address for unregistered name', async () => {
    setEnsClientOverride(
      makeClient({
        getEnsAddress: vi.fn().mockResolvedValue(null),
        getEnsAvatar: vi.fn().mockResolvedValue(null),
        getEnsText: vi.fn().mockResolvedValue(null),
      }),
    );

    const profile = await getAgentProfile('not-registered.eth');

    expect(profile.address).toBeNull();
    expect(profile.isMock).toBe(false);
    expect(profile.name).toBe('not-registered.eth');
  });

  // -------------------------------------------------------------------------
  // 9. getAgentProfile — graceful degradation when all RPC calls fail
  // -------------------------------------------------------------------------

  it('returns isMock=false profile with all nulls when all RPC calls fail gracefully', async () => {
    // Each inner function (resolveAddress, getEnsAvatar, getEnsText) catches its
    // own errors and returns null — so the outer getAgentProfile always resolves,
    // returning a real (non-mock) profile with null fields. This is the intended
    // graceful-degradation behaviour.
    setEnsClientOverride(
      makeClient({
        getEnsAddress: vi.fn().mockRejectedValue(new Error('RPC timeout')),
        getEnsAvatar: vi.fn().mockRejectedValue(new Error('RPC timeout')),
        getEnsText: vi.fn().mockRejectedValue(new Error('RPC timeout')),
      }),
    );

    const profile = await getAgentProfile('surgecast.eth');

    expect(profile.name).toBe('surgecast.eth');
    expect(profile.address).toBeNull();
    expect(profile.avatar).toBeNull();
    expect(profile.description).toBeNull();
    // isMock is false because we got a real (empty) response — not a hardcoded demo fallback
    expect(profile.isMock).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 10. MOCK_AGENT_PROFILE — shape validation
  // -------------------------------------------------------------------------

  it('MOCK_AGENT_PROFILE has the correct structure', () => {
    expect(MOCK_AGENT_PROFILE.name).toBe('surgecast.eth');
    expect(MOCK_AGENT_PROFILE.isMock).toBe(true);
    expect(typeof MOCK_AGENT_PROFILE.address).toBe('string');
    expect(MOCK_AGENT_PROFILE.avatar).toBeNull();
    expect(typeof MOCK_AGENT_PROFILE.description).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// 11. AgentIdentity.getIdentityCard() — format tests
// ---------------------------------------------------------------------------

describe('AgentIdentity', () => {
  it('getIdentityCard() returns "(identity not loaded)" before load()', () => {
    const identity = new AgentIdentity('surgecast.eth');
    const card = identity.getIdentityCard();
    expect(card).toContain('surgecast.eth');
    expect(card).toContain('identity not loaded');
  });

  it('getIdentityCard() shows truncated address after load()', async () => {
    setEnsClientOverride(
      makeClient({
        getEnsAddress: vi.fn().mockResolvedValue(REAL_ADDRESS),
        getEnsAvatar: vi.fn().mockResolvedValue(null),
        getEnsText: vi.fn().mockResolvedValue(null),
      }),
    );

    const identity = new AgentIdentity('surgecast.eth');
    await identity.load();

    const card = identity.getIdentityCard();
    // Should contain the ENS name
    expect(card).toContain('surgecast.eth');
    // Should contain truncated address (0xAbCd…eF12 format)
    expect(card).toMatch(/0x[a-fA-F0-9]{4}…[a-fA-F0-9]{4}/);
    // Should NOT contain demo mode badge for live data
    expect(card).not.toContain('demo mode');
  });

  it('getIdentityCard() shows demo mode badge when profile is injected as mock', () => {
    // Use _setProfileForTesting to inject a mock profile directly,
    // simulating the scenario where ENS resolution returned the demo fallback.
    const identity = new AgentIdentity('surgecast.eth');
    identity._setProfileForTesting({
      name: 'surgecast.eth',
      address: '0x000000000000000000000000000000000000dEaD',
      avatar: null,
      description: 'Demo mode',
      isMock: true,
    });

    const card = identity.getIdentityCard();
    expect(card).toContain('surgecast.eth');
    expect(card).toContain('demo mode');
  });

  it('recordSignal() appends to history and getSignalHistory() returns it', () => {
    const identity = new AgentIdentity('surgecast.eth');
    identity.recordSignal({
      timestamp: '2026-03-10T12:00:00Z',
      market: 'Will ETH hit $5K?',
      direction: 'YES',
      evPercent: 8.5,
    });

    const history = identity.getSignalHistory();
    expect(history).toHaveLength(1);
    expect(history[0].market).toBe('Will ETH hit $5K?');
  });

  it('defaultAgentIdentity is anchored to surgecast.eth', () => {
    expect(defaultAgentIdentity.ensName).toBe('surgecast.eth');
  });
});
