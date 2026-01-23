import { sql } from '../lib/db';
import { redis, KEYS } from '../lib/redis';
import type { AgentState, AgentConfig, AgentStatus } from '../types';

const DEFAULT_CONFIG: AgentConfig = {
  riskLevel: 'medium',
  maxPositionSize: 10,
  stopLoss: 10,
  takeProfit: 50,
  allowedTokens: [],
  tradingHours: {
    enabled: false,
    start: '09:00',
    end: '17:00',
  },
};

// Helper to get/set cache
async function getCache(key: string): Promise<string | null> {
  if (redis) {
    return redis.get(key);
  }
  return null;
}

async function setCache(key: string, value: string, ttl: number): Promise<void> {
  if (redis) {
    await redis.setex(key, ttl, value);
  }
}

export async function getAgentState(userId: string): Promise<AgentState> {
  // Try cache first
  const cached = await getCache(KEYS.agentState(userId));
  if (cached) {
    return JSON.parse(cached);
  }

  // Get from DB
  const [state] = await sql`
    SELECT * FROM agent_states WHERE user_id = ${userId}
  `;

  if (!state) {
    return {
      status: 'stopped',
      config: DEFAULT_CONFIG,
    };
  }

  const agentState: AgentState = {
    status: state.status as AgentStatus,
    config: state.config as AgentConfig,
    lastActivity: state.last_activity?.toISOString(),
  };

  await setCache(KEYS.agentState(userId), JSON.stringify(agentState), 60);

  return agentState;
}

export async function startAgent(userId: string): Promise<AgentState> {
  const [existing] = await sql`
    SELECT id FROM agent_states WHERE user_id = ${userId}
  `;

  let state: AgentState;

  if (existing) {
    const [updated] = await sql`
      UPDATE agent_states
      SET status = 'running', last_activity = NOW(), updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `;
    state = {
      status: updated.status,
      config: updated.config as AgentConfig,
      lastActivity: updated.last_activity?.toISOString(),
    };
  } else {
    const configJson = JSON.stringify(DEFAULT_CONFIG);
    const [created] = await sql`
      INSERT INTO agent_states (user_id, status, config, last_activity)
      VALUES (${userId}, 'running', ${configJson}::jsonb, NOW())
      RETURNING *
    `;
    state = {
      status: created.status,
      config: created.config as AgentConfig,
      lastActivity: created.last_activity?.toISOString(),
    };
  }

  await setCache(KEYS.agentState(userId), JSON.stringify(state), 60);

  return state;
}

export async function stopAgent(userId: string): Promise<AgentState> {
  const [updated] = await sql`
    UPDATE agent_states
    SET status = 'stopped', last_activity = NOW(), updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING *
  `;

  if (!updated) {
    return {
      status: 'stopped',
      config: DEFAULT_CONFIG,
    };
  }

  const state: AgentState = {
    status: updated.status,
    config: updated.config as AgentConfig,
    lastActivity: updated.last_activity?.toISOString(),
  };

  await setCache(KEYS.agentState(userId), JSON.stringify(state), 60);

  return state;
}

export async function pauseAgent(userId: string): Promise<AgentState> {
  const [updated] = await sql`
    UPDATE agent_states
    SET status = 'paused', updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING *
  `;

  if (!updated) {
    return {
      status: 'stopped',
      config: DEFAULT_CONFIG,
    };
  }

  const state: AgentState = {
    status: updated.status,
    config: updated.config as AgentConfig,
    lastActivity: updated.last_activity?.toISOString(),
  };

  await setCache(KEYS.agentState(userId), JSON.stringify(state), 60);

  return state;
}

export async function updateAgentConfig(
  userId: string,
  config: Partial<AgentConfig>
): Promise<AgentState> {
  const current = await getAgentState(userId);
  const newConfig = { ...current.config, ...config };
  const configJson = JSON.stringify(newConfig);

  const [existing] = await sql`
    SELECT id FROM agent_states WHERE user_id = ${userId}
  `;

  let state: AgentState;

  if (existing) {
    const [updated] = await sql`
      UPDATE agent_states
      SET config = ${configJson}::jsonb, updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `;
    state = {
      status: updated.status,
      config: updated.config as AgentConfig,
      lastActivity: updated.last_activity?.toISOString(),
    };
  } else {
    const [created] = await sql`
      INSERT INTO agent_states (user_id, status, config)
      VALUES (${userId}, 'stopped', ${configJson}::jsonb)
      RETURNING *
    `;
    state = {
      status: created.status,
      config: created.config as AgentConfig,
      lastActivity: created.last_activity?.toISOString(),
    };
  }

  await setCache(KEYS.agentState(userId), JSON.stringify(state), 60);

  return state;
}
