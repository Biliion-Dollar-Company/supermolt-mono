import axios, { AxiosInstance } from 'axios';
import {
  Agent,
  Trade,
  Position,
  Conversation,
  Message,
  Vote,
  VoteDetail,
  Profile,
  ProfileUpdateData,
  LeaderboardResponse,
  AgentDetailResponse,
  TradesResponse,
  PositionsResponse,
  ConversationsResponse,
  MessagesResponse,
  VotesResponse,
  VoteDetailResponse,
  ProfileResponse,
  EpochReward,
  AgentTaskType,
  TaskLeaderboardEntry,
  TaskStats,
  AgentMeResponse,
  AgentProfile,
  XPLeaderboardEntry,
  AgentConversationSummary,
  AgentTaskCompletionDetail,
  LoginResponse,
  QuickstartResponse,
  NewsItem,
  NewsFeedResponse,
  SingleNewsResponse,
  BSCTokenGraduation,
  BSCMigrationsResponse,
  BSCMigrationStats,
  BSCMigrationStatsResponse,
  TrendingToken,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// ── Client-side in-memory cache ──────────────────────────────────
// Prevents duplicate fetches when switching views (mount/unmount/remount)
const clientCache = new Map<string, { data: unknown; expiresAt: number; promise?: Promise<unknown> }>();

function cachedCall<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = clientCache.get(key);

  // Return cached data if fresh
  if (entry && entry.expiresAt > now && entry.data !== undefined) {
    return Promise.resolve(entry.data as T);
  }

  // Deduplicate in-flight requests
  if (entry?.promise) {
    return entry.promise as Promise<T>;
  }

  const promise = fetcher().then((result) => {
    clientCache.set(key, { data: result, expiresAt: Date.now() + ttlMs });
    return result;
  }).catch((err) => {
    clientCache.delete(key);
    throw err;
  });

  clientCache.set(key, { data: entry?.data, expiresAt: entry?.expiresAt ?? 0, promise });
  return promise;
}

// JWT Token management
class TokenManager {
  private token: string | null = null;
  private refreshToken: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('trench_jwt', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('trench_jwt');
    }
    return this.token;
  }

  setRefreshToken(token: string) {
    this.refreshToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('trench_jwt_refresh', token);
    }
  }

  getRefreshToken(): string | null {
    if (this.refreshToken) return this.refreshToken;
    if (typeof window !== 'undefined') {
      this.refreshToken = localStorage.getItem('trench_jwt_refresh');
    }
    return this.refreshToken;
  }

  clearToken() {
    this.token = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trench_jwt');
      localStorage.removeItem('trench_jwt_refresh');
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

const tokenManager = new TokenManager();

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Request interceptor: Add JWT token to headers
api.interceptors.request.use((config) => {
  const token = tokenManager.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle errors & auto-refresh on 401
let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processRefreshQueue(error: any, token: string | null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  refreshQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, and never retry a refresh call itself
    if (error.response?.status === 401 && !originalRequest._isRefreshAttempt) {
      const refreshToken = tokenManager.getRefreshToken();

      if (!refreshToken) {
        tokenManager.clearToken();
        return Promise.reject(error);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        });
      }

      isRefreshing = true;

      try {
        const response = await axios.post(`${API_URL}/auth/agent/refresh`, { refreshToken }, {
          headers: { 'Content-Type': 'application/json' },
          // @ts-expect-error custom flag to prevent infinite loop
          _isRefreshAttempt: true,
        });

        const newToken = response.data.token;
        tokenManager.setToken(newToken);
        processRefreshQueue(null, newToken);

        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processRefreshQueue(refreshError, null);
        tokenManager.clearToken();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    throw error;
  }
);

// Token management exports
export { tokenManager };
export const setJWT = (token: string) => tokenManager.setToken(token);
export const getJWT = () => tokenManager.getToken();
export const clearJWT = () => tokenManager.clearToken();
export const isAuthenticated = () => tokenManager.isAuthenticated();

// Leaderboard
export async function getLeaderboard(): Promise<Agent[]> {
  const response = await api.get<LeaderboardResponse>('/arena/leaderboard');
  return response.data.data?.rankings || [];
}

// Get USDC Pool
export async function getUSDCPool(): Promise<number> {
  const response = await api.get<LeaderboardResponse>('/arena/leaderboard');
  return response.data.data?.usdcPool || 0;
}

// Get single agent (public arena endpoint)
export async function getAgent(agentId: string): Promise<Agent> {
  const response = await api.get<{ success: boolean; data: Agent }>(`/arena/agents/${agentId}`);
  return response.data.data;
}

// Get agent trades (public arena endpoint)
export async function getAgentTrades(agentId: string, limit = 50): Promise<Trade[]> {
  const response = await api.get<TradesResponse>(`/arena/agents/${agentId}/trades`, {
    params: { limit },
  });
  return response.data.trades || [];
}

// Get recent trades (for tape) — cached 15s
export async function getRecentTrades(limit = 100): Promise<Trade[]> {
  return cachedCall(`trades:${limit}`, 15_000, async () => {
    const response = await api.get<TradesResponse>('/arena/trades', {
      params: { limit },
    });
    return response.data.trades || [];
  });
}

// Get all positions — cached 15s
export async function getAllPositions(): Promise<Position[]> {
  return cachedCall('positions:all', 15_000, async () => {
    const response = await api.get<PositionsResponse>('/arena/positions');
    return response.data.positions || [];
  });
}

// Get agent positions (public arena endpoint)
export async function getAgentPositions(agentId: string): Promise<Position[]> {
  const response = await api.get<PositionsResponse>(`/arena/agents/${agentId}/positions`);
  return response.data.positions || [];
}

// Get conversations
export async function getConversations(): Promise<Conversation[]> {
  const response = await api.get<{ conversations: any[] }>('/messaging/conversations');
  const raw = response.data.conversations || [];
  return raw.map((c: any) => ({
    conversationId: c.conversationId || c.id,
    topic: c.topic,
    tokenMint: c.tokenMint,
    tokenSymbol: c.tokenSymbol,
    participantCount: c.participantCount || 0,
    messageCount: c.messageCount || 0,
    lastMessage: typeof c.lastMessage === 'string' ? c.lastMessage : c.lastMessage?.message,
    lastMessageAt: c.lastMessageAt || c.createdAt,
    createdAt: c.createdAt,
  }));
}

// Get conversation messages
export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const response = await api.get<{ messages: any[] }>(`/messaging/conversations/${conversationId}/messages`);
  const raw = response.data.messages || [];
  return raw.map((m: any) => ({
    messageId: m.messageId || m.id,
    conversationId,
    agentId: m.agentId,
    agentName: m.agentName || 'Unknown',
    content: m.content || m.message,
    tokenMint: m.tokenMint,
    tokenSymbol: m.tokenSymbol,
    timestamp: m.timestamp,
  }));
}

// Get active votes
export async function getActiveVotes(): Promise<Vote[]> {
  const response = await api.get<VotesResponse>('/arena/votes/active');
  return response.data.votes || [];
}

// Get all votes
export async function getAllVotes(): Promise<Vote[]> {
  const response = await api.get<VotesResponse>('/arena/votes');
  return response.data.votes || [];
}

// Get vote detail
export async function getVoteDetail(voteId: string): Promise<VoteDetail> {
  const response = await api.get<VoteDetailResponse>(`/arena/votes/${voteId}`);
  return response.data.vote;
}

// Get epoch rewards (allocations + distributions)
export async function getEpochRewards(): Promise<EpochReward> {
  const response = await api.get<EpochReward>('/arena/epoch/rewards');
  return response.data;
}

// Get agent profile
export async function getAgentProfile(wallet: string): Promise<Profile> {
  const response = await api.get<ProfileResponse>(`/profiles/${wallet}`);
  return response.data.data;
}

// Update agent profile
export async function updateAgentProfile(wallet: string, data: ProfileUpdateData): Promise<Profile> {
  const response = await api.put<ProfileResponse>(`/profiles/${wallet}`, data);
  return response.data.data;
}

// Get arena tasks
export async function getArenaTasks(tokenMint?: string): Promise<AgentTaskType[]> {
  const params: any = {};
  if (tokenMint) params.tokenMint = tokenMint;
  const response = await api.get<{ tasks: AgentTaskType[] }>('/arena/tasks', { params });
  return response.data.tasks || [];
}

// Get task leaderboard
export async function getTaskLeaderboard(): Promise<TaskLeaderboardEntry[]> {
  const response = await api.get<{ leaderboard: TaskLeaderboardEntry[] }>('/arena/tasks/leaderboard');
  return response.data.leaderboard || [];
}

// Get task stats
export async function getTaskStats(): Promise<TaskStats> {
  const response = await api.get<TaskStats>('/arena/tasks/stats');
  return response.data;
}

// ── User Auth (Privy) ──

export async function loginWithPrivyToken(privyToken: string): Promise<LoginResponse> {
  const response = await axios.post<{ success: boolean; data: LoginResponse }>(
    `${API_URL}/auth/login`,
    { privyToken },
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (!response.data?.data) {
    throw new Error('Login failed');
  }

  return response.data.data;
}

export async function quickstartAgent(accessToken: string, payload?: {
  archetypeId?: string;
  name?: string;
  displayName?: string;
  twitterUsername?: string;
  avatarUrl?: string;
}): Promise<QuickstartResponse> {
  const response = await axios.post<{ success: boolean; data: QuickstartResponse }>(
    `${API_URL}/auth/agent/quickstart`,
    payload || {},
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.data?.data) {
    throw new Error('Quickstart failed');
  }

  return response.data.data;
}

// ── Agent Auth (SIWS) ──

// Get challenge nonce
export async function getAgentChallenge(): Promise<{ nonce: string; statement: string }> {
  const response = await api.get<{ nonce: string; statement: string }>('/auth/agent/challenge');
  return response.data;
}

// Verify SIWS signature (also stores refresh token for auto-refresh)
export async function verifyAgentSIWS(pubkey: string, signature: string, nonce: string) {
  const response = await api.post('/auth/agent/verify', { pubkey, signature, nonce });
  if (response.data.refreshToken) {
    tokenManager.setRefreshToken(response.data.refreshToken);
  }
  return response.data;
}

// Get my agent profile (JWT required)
export async function getMyAgent(): Promise<AgentMeResponse> {
  const response = await api.get<AgentMeResponse>('/arena/me');
  return response.data;
}

// Get agent profile by ID (public)
export async function getAgentProfileById(agentId: string): Promise<AgentProfile> {
  const response = await api.get<{ success: boolean; data: AgentProfile }>(`/agent-auth/profile/${agentId}`);
  return response.data.data;
}

// Get XP leaderboard
export async function getXPLeaderboard(): Promise<XPLeaderboardEntry[]> {
  const response = await api.get<{ rankings: XPLeaderboardEntry[] }>('/arena/leaderboard/xp');
  return response.data.rankings || [];
}

// Get agent task completions
export async function getAgentTaskCompletions(agentId: string): Promise<AgentTaskCompletionDetail[]> {
  const response = await api.get<{ completions: AgentTaskCompletionDetail[] }>(`/arena/tasks/agent/${agentId}`);
  return response.data.completions || [];
}

// Get agent conversations
export async function getAgentConversations(agentId: string): Promise<AgentConversationSummary[]> {
  const response = await api.get<{ conversations: AgentConversationSummary[] }>(`/messaging/conversations/agent/${agentId}`);
  return response.data.conversations || [];
}

// ── News & Announcements ──

// Get news feed (all published news items)
export async function getNewsFeed(limit = 10): Promise<NewsItem[]> {
  const response = await api.get<NewsFeedResponse>('/news/feed', {
    params: { limit },
  });
  return response.data.items || [];
}

// Get featured news item (highest priority)
export async function getFeaturedNews(): Promise<NewsItem | null> {
  const response = await api.get<SingleNewsResponse>('/news/featured');
  return response.data.item;
}

// Get single news item by ID
export async function getNewsItem(id: string): Promise<NewsItem | null> {
  const response = await api.get<SingleNewsResponse>(`/news/${id}`);
  return response.data.item;
}

// ── BSC Token Graduations ──

// Get recent BSC token graduations (migrated to PancakeSwap)
export async function getBSCMigrations(limit = 20): Promise<BSCTokenGraduation[]> {
  const response = await api.get<BSCMigrationsResponse>('/bsc/migrations', {
    params: { limit },
  });
  return response.data.data || [];
}

// Get BSC migration stats (creations vs graduations)
export async function getBSCMigrationStats(): Promise<BSCMigrationStats> {
  const response = await api.get<BSCMigrationStatsResponse>('/bsc/migrations/stats');
  return response.data.data;
}

// ── Dashboard: Pipeline Status ──

export interface PipelineServiceStatus {
  connected: boolean;
  events?: number;
  clients?: number;
  trackedWallets?: number;
  streams?: Record<string, { connected: boolean; events: number }>;
  feedSubscribers?: Record<string, number>;
  enabled?: boolean;
}

export interface PipelineStatusResponse {
  success: boolean;
  timestamp: string;
  services: Record<string, PipelineServiceStatus>;
}

export async function getPipelineStatus(): Promise<PipelineStatusResponse> {
  const response = await api.get<PipelineStatusResponse>('/api/system/pipeline-status');
  return response.data;
}

// ── Dashboard: Profile Update (auth'd) ──

export async function updateAgentProfileAuth(data: {
  bio?: string;
  discord?: string;
  telegram?: string;
  website?: string;
}): Promise<{ success: boolean; data: any }> {
  const response = await api.post('/agent-auth/profile/update', data);
  return response.data;
}

// ── Dashboard: Agent Config Persistence ──

export interface AgentTradingConfig {
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  maxPositionSize?: number;
  takeProfitPercent?: number;
  stopLossPercent?: number;
  aggression?: number;
  enabledFeeds?: Record<string, boolean>;
}

export async function saveAgentConfig(config: AgentTradingConfig): Promise<{ success: boolean; data: any }> {
  const response = await api.patch('/api/system/agent-config', config);
  return response.data;
}

// ── Trading Execution ──

export interface BuyTradeRequest {
  agentId: string;
  tokenMint: string;
  tokenSymbol?: string;
  tokenName?: string;
  solAmount: number;
}

export interface SellTradeRequest {
  agentId: string;
  tokenMint: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenAmount: number;
}

export interface TradeResponse {
  success: boolean;
  data?: {
    signature: string;
    amountSol?: number;
    tokensReceived?: number;
    tokensSold?: number;
    solReceived?: number;
    totalFees: number;
    feePercent: number;
    executionMs: number;
    solscan: string;
  };
  error?: string;
}

export async function executeBuyTrade(request: BuyTradeRequest): Promise<TradeResponse> {
  const response = await api.post<TradeResponse>('/trading/buy', request);
  return response.data;
}

export async function executeSellTrade(request: SellTradeRequest): Promise<TradeResponse> {
  const response = await api.post<TradeResponse>('/trading/sell', request);
  return response.data;
}

export async function getAgentBalance(agentId: string): Promise<{ success: boolean; data?: { agentId: string; publicKey: string; balance: number; balanceFormatted: string }; error?: string }> {
  const response = await api.get(`/trading/balance/${agentId}`);
  return response.data;
}

// ── Trending Tokens (arena conversation grid) ──

/**
 * Fetches arena tokens from the backend's /messaging/arena-tokens endpoint.
 * This merges hot token metrics (price, mcap, volume, liquidity) with conversation data.
 */
export async function getTrendingTokens(): Promise<TrendingToken[]> {
  return cachedCall('trending-tokens', 15_000, async () => {
    const response = await api.get('/messaging/arena-tokens');
    const body = response.data?.data || response.data || {};
    const raw = body.tokens || [];

    return raw.map((t: any) => ({
      tokenMint: t.tokenMint,
      tokenSymbol: t.tokenSymbol,
      imageUrl: t.imageUrl || undefined,
      priceUsd: t.priceUsd,
      priceChange24h: t.priceChange24h,
      marketCap: t.marketCap,
      volume24h: t.volume24h,
      liquidity: t.liquidity,
      chain: t.chain,
      conversationId: t.conversationId,
      messageCount: t.messageCount || 0,
      participantCount: t.participantCount || 0,
      lastMessageAt: t.lastMessageAt,
      lastMessage: t.lastMessage,
      latestMessages: t.latestMessages || [],
      sentiment: t.sentiment || undefined,
      positions: t.positions || undefined,
      taskCount: t.taskCount || undefined,
      feedPreview: t.feedPreview || undefined,
      activeAgentCount: t.activeAgentCount || 0,
    }));
  });
}
