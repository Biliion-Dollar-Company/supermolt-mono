/**
 * Shared test helpers for Trench Terminal backend tests.
 *
 * Provides a mock Prisma client, JWT helpers, and factory functions
 * for building realistic test fixtures without touching a database.
 */

import { mock } from 'bun:test';

// ── Mock Prisma client ────────────────────────────────────────────────

type MockFn = ReturnType<typeof mock>;

function chainableMock(): MockFn {
  return mock(() => Promise.resolve(null));
}

export function createMockDb() {
  return {
    $transaction: mock(async (fn: (tx: any) => Promise<any>) => {
      // Execute the callback with a proxy that returns the same mock db
      // so tx.model.method() calls resolve to the same mocks.
      const txProxy = createMockDb();
      return fn(txProxy);
    }),
    narrativeThread: {
      findUnique: chainableMock(),
      findMany: chainableMock(),
      count: chainableMock(),
    },
    narrativeVote: {
      findUnique: chainableMock(),
      findMany: chainableMock(),
      count: chainableMock(),
      upsert: chainableMock(),
      deleteMany: chainableMock(),
      create: chainableMock(),
    },
    narrativeAnalysisRun: {
      findMany: chainableMock(),
      findUnique: chainableMock(),
      create: chainableMock(),
      update: chainableMock(),
    },
    agentPost: {
      findUnique: chainableMock(),
      findMany: chainableMock(),
      count: chainableMock(),
      create: chainableMock(),
      update: chainableMock(),
      delete: chainableMock(),
    },
    agentConversation: {
      findMany: chainableMock(),
    },
    scannerCall: {
      findMany: chainableMock(),
    },
    postLike: {
      findUnique: chainableMock(),
      create: chainableMock(),
      delete: chainableMock(),
    },
    postComment: {
      findMany: chainableMock(),
      count: chainableMock(),
      create: chainableMock(),
    },
    postShare: {
      create: chainableMock(),
    },
    paperTrade: {
      findFirst: chainableMock(),
    },
    tradingAgent: {
      findUnique: chainableMock(),
    },
  };
}

export type MockDb = ReturnType<typeof createMockDb>;

// ── JWT helpers ───────────────────────────────────────────────────────

export const TEST_AGENT_ID = 'agent-test-001';
export const TEST_USER_ID = 'user-test-001';
export const VALID_TOKEN = 'valid-test-token';
export const EXPIRED_TOKEN = 'expired-token';

export function authHeader(token = VALID_TOKEN) {
  return { Authorization: `Bearer ${token}` };
}

// ── Factory functions ─────────────────────────────────────────────────

let seq = 0;
function nextId() {
  return `cuid-${++seq}`;
}

export function resetSequence() {
  seq = 0;
}

export function buildNarrativeThread(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    slug: 'test-narrative',
    name: 'Test Narrative',
    emoji: '🔥',
    description: 'A test narrative for unit tests',
    keywords: ['test', 'narrative'],
    heatScore: 75,
    tweetCount24h: 42,
    kolMentions: 5,
    bullPercent: 68,
    lastDebateAt: new Date('2026-04-01'),
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-04-01'),
    ...overrides,
  };
}

export function buildAgentPost(overrides: Record<string, unknown> = {}) {
  const id = nextId();
  return {
    id,
    agentId: TEST_AGENT_ID,
    narrativeSlug: 'test-narrative',
    content: 'This is a test post',
    postType: 'INSIGHT',
    tokenMint: null,
    tokenSymbol: null,
    tradeId: null,
    image: null,
    metadata: {},
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    visibility: 'public',
    createdAt: new Date(),
    updatedAt: new Date(),
    agent: {
      id: TEST_AGENT_ID,
      displayName: 'Test Agent',
      avatarUrl: null,
      archetypeId: 'degen',
    },
    likes: [],
    comments: [],
    shares: [],
    _count: { likes: 0, comments: 0, shares: 0 },
    ...overrides,
  };
}

export function buildPostComment(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    postId: 'post-1',
    agentId: TEST_AGENT_ID,
    content: 'Test comment',
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    agent: {
      id: TEST_AGENT_ID,
      displayName: 'Test Agent',
      avatarUrl: null,
    },
    replies: [],
    _count: { likes: 0 },
    ...overrides,
  };
}

export function buildNarrativeVote(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    narrativeSlug: 'test-narrative',
    agentId: TEST_AGENT_ID,
    value: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
