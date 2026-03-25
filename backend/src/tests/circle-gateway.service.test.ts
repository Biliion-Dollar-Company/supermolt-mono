/**
 * Tests: CircleGatewayService
 *
 * All tests run in mock mode (CIRCLE_GATEWAY_MOCK=true).
 * No network calls are made.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

// ── Helpers ───────────────────────────────────────────────────────────────────

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

function makeRecipients(count: number) {
  const chains = ['ethereum', 'base', 'polygon', 'solana'] as const;
  return Array.from({ length: count }, (_, i) => ({
    agentId: `agent-${i + 1}`,
    agentName: `Agent ${i + 1}`,
    walletAddress: `0x${(i + 1).toString(16).padStart(40, '0')}`,
    destinationChain: chains[i % chains.length],
    amount: 100 * (5 - i),
    rank: i + 1,
  }));
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  // Snapshot env before each test
  originalEnv = {
    CIRCLE_GATEWAY_MOCK: process.env.CIRCLE_GATEWAY_MOCK,
    CIRCLE_GATEWAY_API_KEY: process.env.CIRCLE_GATEWAY_API_KEY,
    CIRCLE_GATEWAY_BASE_URL: process.env.CIRCLE_GATEWAY_BASE_URL,
    CIRCLE_GATEWAY_SOURCE_CHAIN: process.env.CIRCLE_GATEWAY_SOURCE_CHAIN,
  };

  // Default: mock mode on
  process.env.CIRCLE_GATEWAY_MOCK = 'true';
  delete process.env.CIRCLE_GATEWAY_API_KEY;
});

afterEach(() => {
  setEnv(originalEnv);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CircleGatewayService — mock mode', () => {
  it('isConfigured() returns true when mock mode is on', async () => {
    const { CircleGatewayService } = await import('../services/circle-gateway.service');
    const svc = new CircleGatewayService();
    expect(svc.isConfigured()).toBe(true);
  });

  it('isConfigured() returns false with no api key and mock off', async () => {
    process.env.CIRCLE_GATEWAY_MOCK = 'false';
    delete process.env.CIRCLE_GATEWAY_API_KEY;
    const { CircleGatewayService } = await import('../services/circle-gateway.service');
    const svc = new CircleGatewayService();
    expect(svc.isConfigured()).toBe(false);
  });

  describe('getUnifiedBalance()', () => {
    it('returns a CircleGatewayBalance with totalUsdc > 0', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();
      const balance = await svc.getUnifiedBalance();

      expect(balance.totalUsdc).toBeGreaterThan(0);
      expect(balance.byChain).toBeDefined();
      expect(Object.keys(balance.byChain).length).toBeGreaterThan(0);
      expect(balance.lastUpdated).toBeInstanceOf(Date);
    });

    it('byChain values sum to approximately totalUsdc', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();
      const balance = await svc.getUnifiedBalance();

      const chainSum = Object.values(balance.byChain).reduce((a, b) => a + b, 0);
      expect(Math.abs(chainSum - balance.totalUsdc)).toBeLessThan(1);
    });
  });

  describe('estimateTransfer()', () => {
    it('returns a TransferEstimate with fee and expiresAt', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();
      const estimate = await svc.estimateTransfer('0xabc', 100, 'base');

      expect(estimate.fee).toBeGreaterThan(0);
      expect(estimate.feeChain).toBeTruthy();
      expect(estimate.expiresAt).toBeInstanceOf(Date);
      expect(estimate.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(estimate.estimatedTime).toBeTruthy();
    });

    it('throws on an unsupported destination chain', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();

      expect(svc.estimateTransfer('0xabc', 100, 'fantom')).rejects.toThrow(
        'Unsupported destination chain',
      );
    });

    it('accepts all supported chains without throwing', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();
      const chains = ['solana', 'ethereum', 'base', 'polygon', 'avalanche', 'optimism', 'arbitrum'];

      for (const chain of chains) {
        const estimate = await svc.estimateTransfer('0xabc', 50, chain);
        expect(estimate.fee).toBeGreaterThan(0);
      }
    });
  });

  describe('executeTransfer()', () => {
    it('returns a completed TransferResult with a tx hash', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();
      const result = await svc.executeTransfer('0xrecipient', 250, 'base');

      expect(result.transactionHash).toBeTruthy();
      expect(result.status).toBe('completed');
      expect(result.amount).toBe(250);
      expect(result.destinationChain).toBe('base');
      expect(result.explorerUrl).toContain('basescan.org');
    });

    it('explorer URL is chain-specific for solana', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();
      const result = await svc.executeTransfer('SolAdr123', 50, 'solana');

      expect(result.explorerUrl).toContain('solscan.io');
    });

    it('throws when amount is zero or negative', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();

      expect(svc.executeTransfer('0xabc', 0, 'ethereum')).rejects.toThrow(
        'amount must be positive',
      );
      expect(svc.executeTransfer('0xabc', -10, 'ethereum')).rejects.toThrow(
        'amount must be positive',
      );
    });

    it('throws on unsupported chain', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();

      expect(svc.executeTransfer('0xabc', 100, 'bsc')).rejects.toThrow(
        'Unsupported destination chain',
      );
    });
  });

  describe('distributeRewards()', () => {
    it('distributes to 5 recipients across different chains', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();
      const recipients = makeRecipients(5);

      const summary = await svc.distributeRewards(recipients);

      expect(summary.recipients).toHaveLength(5);
      expect(summary.status).toBe('completed');
      expect(summary.totalDistributed).toBeGreaterThan(0);
      expect(summary.totalFees).toBeGreaterThan(0);
      expect(summary.completedAt).toBeInstanceOf(Date);
    });

    it('status is "completed" when all transfers succeed', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();
      const summary = await svc.distributeRewards(makeRecipients(3));

      expect(summary.status).toBe('completed');
      expect(summary.recipients.every((r) => r.result.status === 'completed')).toBe(true);
    });

    it('each recipient result includes transactionHash and explorerUrl', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();
      const summary = await svc.distributeRewards(makeRecipients(2));

      for (const r of summary.recipients) {
        expect(r.result.transactionHash).toBeTruthy();
        expect(r.result.explorerUrl).toBeTruthy();
        expect(r.agentId).toBeTruthy();
        expect(r.agentName).toBeTruthy();
      }
    });

    it('throws when recipients list is empty', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();

      expect(svc.distributeRewards([])).rejects.toThrow('empty recipients');
    });

    it('status is "failed" when all transfers fail (no api key + mock off)', async () => {
      // Force real mode with no api key — every executeTransfer will throw immediately
      process.env.CIRCLE_GATEWAY_MOCK = 'false';
      delete process.env.CIRCLE_GATEWAY_API_KEY;

      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();

      // executeTransfer throws before hitting the network (API key guard)
      const summary = await svc.distributeRewards(makeRecipients(2));

      expect(summary.status).toBe('failed');
      expect(summary.totalDistributed).toBe(0);
      expect(summary.recipients.every((r) => r.result.status === 'failed')).toBe(true);
    });

    it('preserves agent metadata in summary recipients', async () => {
      const { CircleGatewayService } = await import('../services/circle-gateway.service');
      const svc = new CircleGatewayService();
      const recipients = makeRecipients(1);

      const summary = await svc.distributeRewards(recipients);

      const r = summary.recipients[0];
      expect(r.agentId).toBe(recipients[0].agentId);
      expect(r.agentName).toBe(recipients[0].agentName);
      expect(r.rank).toBe(1);
      expect(r.amount).toBe(recipients[0].amount);
    });
  });
});

describe('CircleGatewayService — no-mock guard (real mode, no key)', () => {
  it('getUnifiedBalance throws a descriptive error without API key', async () => {
    process.env.CIRCLE_GATEWAY_MOCK = 'false';
    delete process.env.CIRCLE_GATEWAY_API_KEY;

    const { CircleGatewayService } = await import('../services/circle-gateway.service');
    const svc = new CircleGatewayService();

    expect(svc.getUnifiedBalance()).rejects.toThrow('CIRCLE_GATEWAY_API_KEY is not set');
  });
});
