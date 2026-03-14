/**
 * Integration tests: Prediction Coordinator
 *
 * Tests cycle execution: market selection, proposal building, consensus, DB writes.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPredCreate = mock(async () => ({ id: 'pred-1' }));
const mockStatsUpsert = mock(async () => ({}));
const mockAgentUpdate = mock(async () => ({ id: 'a1', xp: 100, level: 2 }));
const mockFindManyMarkets = mock(async (): Promise<any[]> => []);
const mockFindManyAgents = mock(async (): Promise<any[]> => []);

mock.module('../lib/db', () => ({
  db: {
    predictionMarket: { findMany: mockFindManyMarkets },
    tradingAgent: { findMany: mockFindManyAgents, update: mockAgentUpdate },
    agentPrediction: {
      create: mockPredCreate,
      count: mock(async () => 0),
      aggregate: mock(async () => ({ _sum: { totalCost: 0 } })),
      groupBy: mock(async (): Promise<any[]> => []),
    },
    predictionStats: { upsert: mockStatsUpsert },
    $transaction: mock(async (fn: (tx: any) => Promise<any>) =>
      fn({
        agentPrediction: { create: mockPredCreate },
        predictionStats: { upsert: mockStatsUpsert },
        tradingAgent: { update: mockAgentUpdate },
      }),
    ),
  },
}));

mock.module('../services/prediction-risk-policy', () => ({
  predictionRiskPolicy: {
    canPlacePrediction: mock(async () => ({ allowed: true, recommendedContracts: 5 })),
    getLimits: mock(() => ({ maxOpenPerAgent: 10, maxTotalExposure: 1000 })),
  },
}));

mock.module('../services/websocket-events', () => ({
  websocketEvents: {
    broadcastPredictionSignal: mock(() => {}),
    broadcastPredictionConsensus: mock(() => {}),
  },
}));

mock.module('../services/onboarding.service', () => ({
  calculateLevel: (xp: number) => Math.floor(xp / 100) + 1,
}));

const { PredictionCoordinator } = await import('../services/prediction-coordinator');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMarket(id: string, yesPrice = 0.6, noPrice = 0.4): any {
  return {
    id,
    externalId: `TICKER-${id}`,
    title: `Test Market ${id}`,
    yesPrice,
    noPrice,
    volume: 10000,
    status: 'open',
    outcome: 'PENDING',
    platform: 'POLYMARKET',
  };
}

function makeAgent(id: string, archetypeId = 'alpha', level = 1): any {
  return { id, name: `agent-${id}`, displayName: `Agent ${id}`, archetypeId, level };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PredictionCoordinator', () => {
  let coordinator: InstanceType<typeof PredictionCoordinator>;

  beforeEach(() => {
    coordinator = new PredictionCoordinator();
    mockFindManyMarkets.mockClear();
    mockFindManyAgents.mockClear();
    mockPredCreate.mockClear();
  });

  it('returns empty result when no markets', async () => {
    mockFindManyMarkets.mockResolvedValueOnce([]);
    mockFindManyAgents.mockResolvedValueOnce([makeAgent('a1')]);

    const result = await coordinator.runCycle();

    expect(result.marketsEvaluated).toBe(0);
    expect(result.predictionsCreated).toBe(0);
  });

  it('returns empty result when no agents', async () => {
    mockFindManyMarkets.mockResolvedValueOnce([makeMarket('m1')]);
    mockFindManyAgents.mockResolvedValueOnce([]);

    const result = await coordinator.runCycle();

    // marketsEvaluated reflects the markets queried, but no predictions created
    expect(result.predictionsCreated).toBe(0);
    expect(result.proposalsGenerated).toBe(0);
  });

  it('creates predictions for markets × agents', async () => {
    mockFindManyMarkets.mockResolvedValueOnce([makeMarket('m1'), makeMarket('m2')]);
    mockFindManyAgents.mockResolvedValueOnce([makeAgent('a1'), makeAgent('a2')]);

    const result = await coordinator.runCycle();

    expect(result.marketsEvaluated).toBe(2);
    expect(result.predictionsCreated).toBeGreaterThan(0);
    expect(result.cycleId).toMatch(/^pred_/);
    expect(result.startedAt).toBeTruthy();
  });

  it('assigns contrarian agents the opposite side', async () => {
    // yesPrice > 0.5 → momentum buys YES, contrarian buys NO
    mockFindManyMarkets.mockResolvedValueOnce([makeMarket('m1', 0.7, 0.3)]);
    mockFindManyAgents.mockResolvedValueOnce([
      makeAgent('momentum', 'alpha'),
      makeAgent('flip', 'contrarian'),
    ]);

    await coordinator.runCycle();

    const calls = mockPredCreate.mock.calls as any[][];
    const sides = calls.map((c) => c[0].data?.side ?? c[0].side);

    expect(sides).toContain('YES');
    expect(sides).toContain('NO');
  });

  it('records cycle result in status', async () => {
    mockFindManyMarkets.mockResolvedValueOnce([makeMarket('m1')]);
    mockFindManyAgents.mockResolvedValueOnce([makeAgent('a1')]);

    const result = await coordinator.runCycle();
    const status = coordinator.getStatus();

    expect(status.lastCycleAt).toBe(result.startedAt);
    expect(status.lastResult).toEqual(result);
  });

  it('throws when another cycle is already in progress', async () => {
    let resolveHang!: (v: any) => void;
    mockFindManyMarkets.mockImplementationOnce(
      () => new Promise((resolve) => { resolveHang = resolve; }),
    );
    mockFindManyAgents.mockResolvedValue([]);

    const firstCycle = coordinator.runCycle();
    await expect(coordinator.runCycle()).rejects.toThrow('cycle already in progress');

    resolveHang([]);
    await firstCycle;
  });
});
