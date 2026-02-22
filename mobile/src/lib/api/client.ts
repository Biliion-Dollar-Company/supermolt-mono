import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:3001' : '');

const TOKEN_KEY = 'sr_access_token';
const REFRESH_TOKEN_KEY = 'sr_refresh_token';

export interface SRTokens {
  accessToken: string;
  refreshToken: string;
}

// Token storage
export async function storeTokens(tokens: SRTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// Auth endpoints (no JWT needed)
export async function loginWithPrivyToken(privyToken: string): Promise<{
  userId: string;
  tokens: SRTokens;
}> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privyToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Login failed' }));
    const msg = body?.error?.message || body?.error || `Login failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  const json = await res.json();
  // Backend wraps in { success, data: { userId, tokens } }
  const data = json.data ?? json;
  const tokens: SRTokens = {
    accessToken: data.tokens?.accessToken || data.accessToken,
    refreshToken: data.tokens?.refreshToken || data.refreshToken,
  };
  if (!tokens.accessToken) {
    throw new Error('No access token in login response');
  }
  await storeTokens(tokens);
  return { userId: data.userId, tokens };
}

export async function refreshAccessToken(): Promise<SRTokens | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const json = await res.json();
    const data = json.data ?? json;
    const tokens: SRTokens = {
      accessToken: data.tokens?.accessToken || data.accessToken,
      refreshToken: data.tokens?.refreshToken || data.refreshToken,
    };
    if (!tokens.accessToken) return null;
    await storeTokens(tokens);
    return tokens;
  } catch {
    await clearTokens();
    return null;
  }
}

// Authenticated fetch wrapper with auto-refresh
let isRefreshing = false;
let refreshPromise: Promise<SRTokens | null> | null = null;

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = await getAccessToken();

  const doFetch = async (accessToken: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return fetch(`${API_URL}${path}`, { ...options, headers });
  };

  let res = await doFetch(token);

  // If 401, try refreshing the token once
  if (res.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken();
    }

    const newTokens = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (newTokens) {
      res = await doFetch(newTokens.accessToken);
    } else {
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    const msg = body?.error?.message || body?.error || `Request failed (${res.status})`;
    throw new ApiError(res.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  const json = await res.json();
  // Backend wraps responses in { success, data }
  return (json.data ?? json) as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Arena API Endpoints ──

import type {
  Agent,
  Trade,
  Position,
  Conversation,
  Message,
  AgentMeResponse,
  AgentTaskType,
  XPLeaderboardEntry,
  EpochReward,
  NewsItem,
  BSCTokenGraduation,
  QuickstartResponse,
  Vote,
  VoteDetail,
  Archetype,
  UserAgent,
  SwitchAgentResponse,
  ActiveToken,
} from '@/types/arena';

export async function getLeaderboard(): Promise<Agent[]> {
  const data = await apiFetch<{ rankings: Agent[] }>('/arena/leaderboard');
  return data.rankings || [];
}

export async function getRecentTrades(limit = 100): Promise<Trade[]> {
  const data = await apiFetch<{ trades: Trade[] }>(`/arena/trades?limit=${limit}`);
  return data.trades || [];
}

export async function getAllPositions(): Promise<Position[]> {
  const data = await apiFetch<{ positions: Position[] }>('/arena/positions');
  return data.positions || [];
}

export async function getAgentById(agentId: string): Promise<Agent> {
  return apiFetch<Agent>(`/arena/agents/${agentId}`);
}

export async function getAgentTrades(agentId: string, limit = 50): Promise<Trade[]> {
  const data = await apiFetch<{ trades: Trade[] }>(`/arena/agents/${agentId}/trades?limit=${limit}`);
  return data.trades || [];
}

export async function getAgentPositions(agentId: string): Promise<Position[]> {
  const data = await apiFetch<{ positions: Position[] }>(`/arena/agents/${agentId}/positions`);
  return data.positions || [];
}

export async function getConversations(): Promise<Conversation[]> {
  const data = await apiFetch<{ conversations: Conversation[] }>('/arena/conversations');
  return data.conversations || [];
}

export async function getMyAgent(): Promise<AgentMeResponse> {
  return apiFetch<AgentMeResponse>('/arena/me');
}

export async function getArenaTasks(tokenMint?: string): Promise<AgentTaskType[]> {
  const params = tokenMint ? `?tokenMint=${tokenMint}` : '';
  const data = await apiFetch<{ tasks: AgentTaskType[] }>(`/arena/tasks${params}`);
  return data.tasks || [];
}

export async function getXPLeaderboard(): Promise<XPLeaderboardEntry[]> {
  const data = await apiFetch<{ rankings: XPLeaderboardEntry[] }>('/arena/leaderboard/xp');
  return data.rankings || [];
}

export async function getEpochRewards(): Promise<EpochReward> {
  return apiFetch<EpochReward>('/arena/epoch/rewards');
}

export async function getNewsFeed(limit = 10): Promise<NewsItem[]> {
  const data = await apiFetch<{ items: NewsItem[] }>(`/news/feed?limit=${limit}`);
  return data.items || [];
}

export async function getBSCMigrations(limit = 20): Promise<BSCTokenGraduation[]> {
  const data = await apiFetch<{ data: BSCTokenGraduation[] }>(`/bsc/migrations?limit=${limit}`);
  return data.data || [];
}

export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const data = await apiFetch<{ messages: Message[] }>(`/arena/conversations/${conversationId}/messages`);
  return data.messages || [];
}

export async function getActiveVotes(): Promise<Vote[]> {
  const data = await apiFetch<{ votes: Vote[] }>('/arena/votes/active');
  return data.votes || [];
}

export async function getAllVotes(): Promise<Vote[]> {
  const data = await apiFetch<{ votes: Vote[] }>('/arena/votes');
  return data.votes || [];
}

export async function getVoteDetail(voteId: string): Promise<VoteDetail> {
  return apiFetch<VoteDetail>(`/arena/votes/${voteId}`);
}

export async function quickstartAgent(payload?: {
  archetypeId?: string;
  name?: string;
  displayName?: string;
}): Promise<QuickstartResponse> {
  return apiFetch<QuickstartResponse>('/auth/agent/quickstart', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

// ── Multi-Agent Endpoints ──

export async function getMyAgents(): Promise<UserAgent[]> {
  const data = await apiFetch<UserAgent[]>('/agents');
  return Array.isArray(data) ? data : [];
}

export async function createNewAgent(archetypeId: string, name: string): Promise<UserAgent> {
  return apiFetch<UserAgent>('/agents', {
    method: 'POST',
    body: JSON.stringify({ archetypeId, name }),
  });
}

export async function switchAgent(agentId: string): Promise<SwitchAgentResponse> {
  return apiFetch<SwitchAgentResponse>(`/agents/${agentId}/switch`, {
    method: 'POST',
  });
}

export async function getArchetypes(): Promise<Archetype[]> {
  const data = await apiFetch<Archetype[]>('/agents/archetypes');
  return Array.isArray(data) ? data : [];
}

export async function deleteAgentById(agentId: string): Promise<void> {
  await apiFetch(`/agents/${agentId}`, { method: 'DELETE' });
}

// ── Agent Configuration Endpoints ──

export interface TrackedWalletConfig {
  id?: string;
  address: string;
  label?: string;
  chain?: 'SOLANA' | 'BSC';
  createdAt?: string;
}

export interface BuyTriggerConfig {
  id?: string;
  type: 'consensus' | 'volume' | 'liquidity' | 'godwallet' | 'trending';
  enabled: boolean;
  config: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentConfiguration {
  archetypeId?: string;
  config?: Record<string, any>;
  trackedWallets: TrackedWalletConfig[];
  buyTriggers: BuyTriggerConfig[];
}

export async function getAgentConfig(): Promise<AgentConfiguration> {
  return apiFetch<AgentConfiguration>('/arena/me/config');
}

export async function updateAgentConfig(payload: {
  archetypeId?: string;
  trackedWallets?: TrackedWalletConfig[];
  triggers?: BuyTriggerConfig[];
}): Promise<void> {
  await apiFetch('/arena/me/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function addTrackedWallet(wallet: {
  address: string;
  label?: string;
  chain?: 'SOLANA' | 'BSC';
}): Promise<TrackedWalletConfig> {
  return apiFetch<TrackedWalletConfig>('/arena/me/wallets', {
    method: 'POST',
    body: JSON.stringify(wallet),
  });
}

export async function removeTrackedWallet(walletId: string): Promise<void> {
  await apiFetch(`/arena/me/wallets/${walletId}`, { method: 'DELETE' });
}

// ── Active Tokens (Hot Tokens) ──

export async function getActiveTokens(hours = 24): Promise<ActiveToken[]> {
  const data = await apiFetch<{ tokens: ActiveToken[] }>(`/arena/tokens/active?hours=${hours}`);
  return data.tokens || [];
}

// ── Vote Casting ──

export async function castVote(
  voteId: string,
  agentId: string,
  vote: 'YES' | 'NO',
): Promise<void> {
  await apiFetch(`/voting/${voteId}/cast`, {
    method: 'POST',
    body: JSON.stringify({ agentId, vote }),
  });
}

// ── Agent Detail Endpoints ──

export async function getAgentTaskCompletions(agentId: string): Promise<AgentTaskType[]> {
  const data = await apiFetch<{ tasks: AgentTaskType[] }>(`/arena/agents/${agentId}/task-completions`);
  return data.tasks || [];
}

export async function getAgentConversations(agentId: string): Promise<Conversation[]> {
  const data = await apiFetch<{ conversations: Conversation[] }>(`/arena/agents/${agentId}/conversations`);
  return data.conversations || [];
}

// ── Agent Balance ──

export async function getAgentBalance(agentId: string): Promise<{ balance: number; balanceFormatted: string }> {
  return apiFetch<{ balance: number; balanceFormatted: string }>(`/trading/balance/${agentId}`);
}

// ── Twitter Linking ──

export async function requestTwitterVerification(): Promise<{
  code: string;
  expiresAt: number;
  tweetTemplate: string;
  instructions: string[];
}> {
  return apiFetch('/agent-auth/twitter/request', { method: 'POST' });
}

export async function verifyTwitterLink(tweetUrl: string): Promise<{ twitterHandle: string }> {
  return apiFetch('/agent-auth/twitter/verify', {
    method: 'POST',
    body: JSON.stringify({ tweetUrl }),
  });
}
