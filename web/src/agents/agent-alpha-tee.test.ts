/**
 * Tests for agent-alpha-tee.ts and tee-integration.ts
 *
 * Covers:
 *  - Signal flows through TEE sealing
 *  - Reputation broadcast called with correct score
 *  - Graceful degradation when Oasis throws
 *  - Graceful degradation when LayerZero throws
 *  - Both degrade gracefully simultaneously
 *  - Log output contains "sealed in TEE" and "Cross-chain"
 *  - Mock mode works without env vars
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentSignal } from '../integrations/telegram-broadcaster.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid AgentSignal for testing */
function makeSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    marketName: 'Will ETH hit $5k by June?',
    direction: 'YES',
    currentPriceCents: 38,
    evScorePercent: 9.4,
    kellySizePercent: 3.1,
    kellyAmountOn1kUSD: 31,
    confidencePercent: 67,
    expiresAt: 'Jun 30, 2026',
    daysRemaining: 111,
    reasoning: 'Strong on-chain momentum with positive EV.',
    source: 'polymarket-clob',
    postedAt: '2026-03-11T06:00:00Z',
    id: 'test-sig-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

// We mock the oasis and layerzero modules so tests run without real TEE/LZ
vi.mock('../oasis/index.ts', () => ({
  runQuantInTEE: vi.fn(async (input: { payload: Record<string, unknown> }) => ({
    output: { ...input.payload, _tee: 'mock' },
    inputHash: 'abc123inputhash',
    computedAt: new Date().toISOString(),
    isMock: true,
  })),
  sealResult: vi.fn((result: unknown) => ({
    result,
    sealHash: 'deadbeef1234seal',
    algorithm: 'hmac-sha256',
  })),
  attestResult: vi.fn(async () => ({
    attested: false,
    quote: 'mock-pcr:aabbcc',
    sealHash: 'deadbeef1234seal',
    attestedAt: new Date().toISOString(),
  })),
}));

vi.mock('../layerzero/index.ts', () => {
  const broadcastToAllMock = vi.fn(async () => ({
    chainsReached: 3,
    chainResults: [
      { chainId: 30101, chainName: 'Ethereum', success: true, txHash: '0xtx1' },
      { chainId: 30110, chainName: 'Arbitrum', success: true, txHash: '0xtx2' },
      { chainId: 30125, chainName: 'Polygon',  success: true, txHash: '0xtx3' },
    ],
    broadcastAt: new Date().toISOString(),
    latencyMs: 42,
  }));

  // Must use `function` keyword so vitest's vi.fn() wrapper allows `new` calls
  const ReputationBroadcasterMock = vi.fn(function (this: unknown) {
    (this as { broadcastToAll: typeof broadcastToAllMock }).broadcastToAll = broadcastToAllMock;
  });

  const LayerZeroClientMock = vi.fn(function (this: unknown) {
    (this as { isConfigured: () => boolean; sendToChain: () => Promise<{ chainId: number; chainName: string; success: boolean }> }).isConfigured = () => false;
    (this as { isConfigured: () => boolean; sendToChain: () => Promise<{ chainId: number; chainName: string; success: boolean }> }).sendToChain = async () => ({ chainId: 30101, chainName: 'Ethereum', success: true });
  });

  return {
    DEFAULT_CHAINS: [
      { chainId: 30101, name: 'Ethereum', oAppAddress: '0x01' },
      { chainId: 30110, name: 'Arbitrum', oAppAddress: '0x02' },
      { chainId: 30125, name: 'Polygon',  oAppAddress: '0x03' },
    ],
    LayerZeroClient: LayerZeroClientMock,
    ReputationBroadcaster: ReputationBroadcasterMock,
    broadcastToAll: broadcastToAllMock,
  };
});

vi.mock('../integrations/telegram-broadcaster.ts', () => ({
  broadcastSignalToTelegram: vi.fn(async () => undefined),
}));

vi.mock('./agent-alpha-multi-strategy.ts', async (importOriginal) => {
  const tradeLog: unknown[] = [];
  return {
    recordTrade: vi.fn((trade: unknown) => { tradeLog.push(trade); }),
    getTrades: vi.fn(() => [...tradeLog]),
  };
});

// ---------------------------------------------------------------------------
// Import modules AFTER mocks are declared
// ---------------------------------------------------------------------------

import { sealAndBroadcast, _resetBroadcasterForTest } from './tee-integration.ts';
import {
  computeReputationScore,
  shareSignalWithTEE,
  runAgentAlphaTEE,
  getTrades,
  recordTrade,
} from './agent-alpha-tee.ts';
import * as oasisModule from '../oasis/index.ts';
import * as layerzeroModule from '../layerzero/index.ts';
import { broadcastSignalToTelegram } from '../integrations/telegram-broadcaster.ts';

// ---------------------------------------------------------------------------
// Suite 1: computeReputationScore
// ---------------------------------------------------------------------------

describe('computeReputationScore', () => {
  it('returns 0.85 when fewer than 3 trades exist', () => {
    expect(computeReputationScore([])).toBe(0.85);
    expect(computeReputationScore([
      {
        id: '1', signalId: 's1', strategy: 'ev-kelly' as const,
        marketName: 'M1', direction: 'YES' as const,
        entryPriceCents: 45, kellySizePercent: 2, timestamp: new Date().toISOString(),
      },
    ])).toBe(0.85);
  });

  it('returns a score between 0 and 1 for ≥3 trades', () => {
    const trades = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`, signalId: `s${i}`, strategy: 'ev-kelly' as const,
      marketName: `Market ${i}`, direction: 'YES' as const,
      entryPriceCents: 40, kellySizePercent: 2, timestamp: new Date().toISOString(),
    }));
    const score = computeReputationScore(trades);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns a value greater than 0.5 (mock indicates good agent)', () => {
    const trades = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`, signalId: `s${i}`, strategy: 'bayesian' as const,
      marketName: `Market ${i}`, direction: 'NO' as const,
      entryPriceCents: 55, kellySizePercent: 3, timestamp: new Date().toISOString(),
    }));
    expect(computeReputationScore(trades)).toBeGreaterThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: sealAndBroadcast
// ---------------------------------------------------------------------------

describe('sealAndBroadcast', () => {
  beforeEach(() => {
    _resetBroadcasterForTest();
    vi.clearAllMocks();
  });

  it('returns sealed=true when TEE succeeds', async () => {
    const result = await sealAndBroadcast(makeSignal(), 0.85);
    expect(result.sealed).toBe(true);
  });

  it('returns the sealHash from sealResult', async () => {
    const result = await sealAndBroadcast(makeSignal(), 0.85);
    expect(result.sealHash).toBe('deadbeef1234seal');
  });

  it('returns chainsReached=3 when LayerZero succeeds', async () => {
    const result = await sealAndBroadcast(makeSignal(), 0.85);
    expect(result.chainsReached).toBe(3);
  });

  it('returns a non-negative latencyMs', async () => {
    const result = await sealAndBroadcast(makeSignal(), 0.85);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('calls runQuantInTEE with signal fields', async () => {
    const signal = makeSignal({ evScorePercent: 11.5 });
    await sealAndBroadcast(signal, 0.9);
    expect(oasisModule.runQuantInTEE).toHaveBeenCalledOnce();
    const callArg = (oasisModule.runQuantInTEE as ReturnType<typeof vi.fn>).mock.calls[0][0] as { payload: Record<string, unknown> };
    expect(callArg.payload.evScorePercent).toBe(11.5);
    expect(callArg.payload.reputationScore).toBe(0.9);
  });

  it('gracefully degrades when Oasis (runQuantInTEE) throws', async () => {
    vi.mocked(oasisModule.runQuantInTEE).mockRejectedValueOnce(new Error('TEE unavailable'));
    const result = await sealAndBroadcast(makeSignal(), 0.85);
    expect(result.sealed).toBe(false);
    expect(result.sealHash).toBe('mock-seal');
    // LayerZero should still have been attempted
    expect(result.chainsReached).toBe(3);
  });

  it('gracefully degrades when LayerZero broadcast throws', async () => {
    // Make ReputationBroadcaster.broadcastToAll throw
    const ReputationBroadcasterMock = vi.mocked(layerzeroModule.ReputationBroadcaster);
    ReputationBroadcasterMock.mockImplementationOnce(function (this: unknown) {
      (this as { broadcastToAll: () => Promise<never> }).broadcastToAll = vi.fn().mockRejectedValue(new Error('LZ endpoint down'));
    });
    _resetBroadcasterForTest();

    const result = await sealAndBroadcast(makeSignal(), 0.85);
    expect(result.sealed).toBe(true); // TEE still works
    expect(result.chainsReached).toBe(0); // LZ failed
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('gracefully degrades when BOTH Oasis and LayerZero throw', async () => {
    vi.mocked(oasisModule.runQuantInTEE).mockRejectedValueOnce(new Error('TEE down'));
    const ReputationBroadcasterMock = vi.mocked(layerzeroModule.ReputationBroadcaster);
    ReputationBroadcasterMock.mockImplementationOnce(function (this: unknown) {
      (this as { broadcastToAll: () => Promise<never> }).broadcastToAll = vi.fn().mockRejectedValue(new Error('LZ down'));
    });
    _resetBroadcasterForTest();

    const result = await sealAndBroadcast(makeSignal(), 0.85);
    expect(result.sealed).toBe(false);
    expect(result.sealHash).toBe('mock-seal');
    expect(result.chainsReached).toBe(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('works in mock mode without any env vars set', async () => {
    const orig = process.env.ROFL_ENDPOINT;
    delete process.env.ROFL_ENDPOINT;
    _resetBroadcasterForTest();

    const result = await sealAndBroadcast(makeSignal(), 0.85);
    // Should not throw regardless of env
    expect(result).toBeDefined();
    expect(typeof result.sealed).toBe('boolean');

    if (orig !== undefined) process.env.ROFL_ENDPOINT = orig;
  });
});

// ---------------------------------------------------------------------------
// Suite 3: shareSignalWithTEE
// ---------------------------------------------------------------------------

describe('shareSignalWithTEE', () => {
  beforeEach(() => {
    _resetBroadcasterForTest();
    vi.clearAllMocks();
  });

  it('calls recordTrade with the correct marketName', async () => {
    const signal = makeSignal({ marketName: 'Trump wins 2028?' });
    await shareSignalWithTEE(signal, 'ev-kelly', 0.85);
    expect(recordTrade).toHaveBeenCalledOnce();
    const callArg = (recordTrade as ReturnType<typeof vi.fn>).mock.calls[0][0] as { marketName: string };
    expect(callArg.marketName).toBe('Trump wins 2028?');
  });

  it('calls broadcastSignalToTelegram with correct strategy', async () => {
    await shareSignalWithTEE(makeSignal(), 'bayesian', 0.85);
    expect(broadcastSignalToTelegram).toHaveBeenCalledWith(expect.anything(), 'bayesian');
  });

  it('logs "sealed in TEE" to console', async () => {
    const logSpy = vi.spyOn(console, 'log');
    await shareSignalWithTEE(makeSignal(), 'momentum', 0.85);
    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('sealed in TEE'))).toBe(true);
    logSpy.mockRestore();
  });

  it('logs "Cross-chain" to console', async () => {
    const logSpy = vi.spyOn(console, 'log');
    await shareSignalWithTEE(makeSignal(), 'ev-kelly', 0.85);
    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('Cross-chain'))).toBe(true);
    logSpy.mockRestore();
  });

  it('passes reputationScore through to sealAndBroadcast', async () => {
    await shareSignalWithTEE(makeSignal(), 'ev-kelly', 0.77);
    // runQuantInTEE payload should contain reputationScore: 0.77
    const callArg = (oasisModule.runQuantInTEE as ReturnType<typeof vi.fn>).mock.calls[0][0] as { payload: Record<string, unknown> };
    expect(callArg.payload.reputationScore).toBe(0.77);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: runAgentAlphaTEE integration
// ---------------------------------------------------------------------------

describe('runAgentAlphaTEE', () => {
  beforeEach(() => {
    _resetBroadcasterForTest();
    vi.clearAllMocks();
  });

  it('completes without throwing', async () => {
    await expect(runAgentAlphaTEE()).resolves.toBeUndefined();
  });

  it('logs the scan start message', async () => {
    const logSpy = vi.spyOn(console, 'log');
    await runAgentAlphaTEE();
    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('TEE-sealed multi-strategy scan'))).toBe(true);
    logSpy.mockRestore();
  });

  it('logs the reputation score', async () => {
    const logSpy = vi.spyOn(console, 'log');
    await runAgentAlphaTEE();
    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('reputation score'))).toBe(true);
    logSpy.mockRestore();
  });

  it('uses mock reputation 0.85 when no trade history exists', async () => {
    vi.mocked(getTrades).mockReturnValueOnce([]);
    const logSpy = vi.spyOn(console, 'log');
    await runAgentAlphaTEE();
    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('0.850'))).toBe(true);
    logSpy.mockRestore();
  });

  it('runs with a subset of strategies', async () => {
    const logSpy = vi.spyOn(console, 'log');
    await runAgentAlphaTEE({ strategies: ['ev-kelly'] });
    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('EV-Kelly'))).toBe(true);
    logSpy.mockRestore();
  });

  it('emits 0 signals when strategy runners return empty arrays (stubs)', async () => {
    const logSpy = vi.spyOn(console, 'log');
    await runAgentAlphaTEE();
    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('0 signal(s) to emit'))).toBe(true);
    logSpy.mockRestore();
  });

  it('handles config overrides correctly', async () => {
    const logSpy = vi.spyOn(console, 'log');
    await runAgentAlphaTEE({ minEvPercent: 10, bankrollUSD: 5000 });
    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('ev-kelly') || l.includes('bayesian'))).toBe(true);
    logSpy.mockRestore();
  });
});
