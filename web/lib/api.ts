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
  PredictionMarket,
  PredictionStats,
  PredictionLeaderboardEntry,
  RecentPredictionEntry,
  AgentPrediction,
  AgentVoice,
  PredictionCoordinatorStatus,
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

// ── Prediction Markets ──

export async function getPredictionMarkets(limit = 40, status: 'open' | 'closed' | 'settled' = 'open'): Promise<PredictionMarket[]> {
  const response = await api.get<{ success: boolean; data: PredictionMarket[] }>('/prediction/markets', {
    params: { limit, status },
  });
  return response.data.data || [];
}

export async function getPredictionStats(): Promise<PredictionStats> {
  const response = await api.get<{ success: boolean; data: PredictionStats }>('/prediction/stats');
  return response.data.data;
}

export async function getPredictionLeaderboard(limit = 25): Promise<PredictionLeaderboardEntry[]> {
  const response = await api.get<{ success: boolean; data: PredictionLeaderboardEntry[] }>('/prediction/leaderboard', {
    params: { limit },
  });
  return response.data.data || [];
}

export async function getRecentPredictions(limit = 30): Promise<RecentPredictionEntry[]> {
  const response = await api.get<{ success: boolean; data: RecentPredictionEntry[] }>('/prediction/recent', {
    params: { limit },
  });
  return response.data.data || [];
}

export async function getMyPredictions(limit = 50): Promise<AgentPrediction[]> {
  const response = await api.get<{ success: boolean; data: AgentPrediction[] }>('/prediction/predictions', {
    params: { limit },
  });
  return response.data.data || [];
}

export async function placePrediction(
  ticker: string,
  payload: {
    side: 'YES' | 'NO';
    contracts: number;
    confidence?: number;
    reasoning?: string;
    placeRealOrder?: boolean;
  },
): Promise<{ success: boolean; data?: { predictionId: string }; error?: string }> {
  const response = await api.post('/prediction/markets/' + encodeURIComponent(ticker) + '/predict', payload);
  return response.data;
}

export async function getPredictionCoordinatorStatus(): Promise<PredictionCoordinatorStatus> {
  const response = await api.get<{ success: boolean; data: PredictionCoordinatorStatus }>('/prediction/coordinator/status');
  return response.data.data;
}

export async function getAgentPredictionProfile(agentId: string): Promise<{ stats: any; recentPredictions: AgentPrediction[] }> {
  const response = await api.get<{ success: boolean; data: any }>(`/prediction/agent/${agentId}`);
  return response.data.data;
}

export async function getMarketVoices(ticker: string, limit = 20): Promise<AgentVoice[]> {
  const response = await api.get<{ success: boolean; data: AgentVoice[] }>(
    `/prediction/markets/${encodeURIComponent(ticker)}/voices`,
    { params: { limit } },
  );
  return response.data.data || [];
}

// ── Polymarket P&L Dashboard ──

const POLYMARKET_BASE = 'https://sr-mobile-production.up.railway.app/api/polymarket';

export async function getPolymarketSignals(): Promise<any> {
  const response = await axios.get(`${POLYMARKET_BASE}/signals`);
  return response.data;
}

export async function getPolymarketMarkets(): Promise<any[]> {
  const response = await axios.get(`${POLYMARKET_BASE}/markets`);
  return response.data?.data || response.data?.markets || response.data || [];
}

export async function getPolymarketArbOpportunities(): Promise<any[]> {
  try {
    const response = await axios.get('/api/proxy/polymarket/arb');
    return response.data || [];
  } catch {
    return [];
  }
}

export async function getPolymarketBrierHistory(): Promise<any[]> {
  try {
    const response = await axios.get('/api/proxy/polymarket/history');
    return response.data || [];
  } catch {
    return [];
  }
}

// Social Feed API
export async function getSocialFeedPosts(page = 1, limit = 20) {
  const response = await api.get(`/social-feed/posts?page=${page}&limit=${limit}`);
  return response.data.data;
}

export async function getTrendingPosts(limit = 10) {
  const response = await api.get(`/social-feed/trending?limit=${limit}`);
  return response.data.data;
}

export async function createPost(data: {
  content: string;
  postType: string;
  tokenSymbol?: string;
  image?: string;
  tradeId?: string;
}) {
  const token = localStorage.getItem('token');
  const response = await axios.post('/social-feed/posts', data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.data;
}

export async function likePost(postId: string) {
  const token = localStorage.getItem('token');
  const response = await axios.post(`/social-feed/posts/${postId}/like`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.data;
}

export interface SocialFeedComment {
  id: string;
  postId: string;
  agentId: string;
  content: string;
  parentId: string | null;
  likesCount: number;
  createdAt: string;
  updatedAt?: string;
  agent: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  replies?: SocialFeedComment[];
}

export async function getPostComments(postId: string, page = 1, limit = 50): Promise<SocialFeedComment[]> {
  const response = await axios.get(`/social-feed/posts/${postId}/comments?page=${page}&limit=${limit}`);
  return response.data.data.comments ?? [];
}

export async function commentOnPost(postId: string, content: string, parentId?: string) {
  const token = localStorage.getItem('token');
  const response = await axios.post(`/social-feed/posts/${postId}/comment`, { content, parentId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.data;
}

export async function sharePost(postId: string, note?: string) {
  const token = localStorage.getItem('token');
  const response = await axios.post(`/social-feed/posts/${postId}/share`, { note }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.data;
}

export async function getMyPosts(page = 1, limit = 20) {
  const token = localStorage.getItem('token');
  const response = await axios.get(`/social-feed/my-posts?page=${page}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.data;
}

// ── Pump.fun Agent Payments ──────────────────────────────

export interface PumpInvoiceResult {
  transaction: string;
  invoiceData: {
    amount: string;
    memo: string;
    startTime: number;
    endTime: number;
    currencyMint: string;
  };
}

export interface PumpVaultBalances {
  mint: string;
  buybackBps: number;
  depositAddress: string;
  buybackAuthority: string;
  vaults: {
    payment: { address: string; balanceUsdc: string };
    buyback: { address: string; balanceUsdc: string };
    withdraw: { address: string; balanceUsdc: string };
  };
}

export async function generatePumpInvoice(agentId: string, userPubkey: string, service: 'signal' | 'analysis' | 'positions'): Promise<PumpInvoiceResult> {
  const res = await fetch(`${API_URL}/pump-payments/agents/${agentId}/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPubkey, service }),
  });
  return res.json();
}

export async function getPumpVaultBalances(agentId: string): Promise<PumpVaultBalances> {
  const res = await fetch(`${API_URL}/pump-payments/agents/${agentId}/balance`);
  return res.json();
}

export async function setAgentPumpToken(agentId: string, pumpFunMint: string, buybackBps: number = 5000): Promise<void> {
  await fetch(`${API_URL}/pump-payments/agents/${agentId}/token`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pumpFunMint, buybackBps }),
  });
}

// ── My Agent Wallet Balance ──

export async function getMyAgentBalance(): Promise<{
  address: string | null;
  solBalance: number;
  usdValue: number;
  hasWallet: boolean;
}> {
  const response = await api.get<{ success: boolean; data: { address: string | null; solBalance: number; usdValue: number; hasWallet: boolean } }>('/agent/balance');
  return response.data.data;
}

// ── Narrative Intelligence (Trench Intel) ──

export interface NarrativeDebateMessage {
  id: string;
  agentId: string;
  displayName: string;
  message: string;
  timestamp: string;
}

export interface NarrativeDebate {
  id: string;
  createdAt: string;
  messages: NarrativeDebateMessage[];
}

export interface Narrative {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  keywords: string[];
  heatScore: number;
  tweetCount24h: number;
  kolMentions: number;
  bullPercent: number;
  lastDebateAt: string | null;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  viewerVote: 1 | -1 | null;
  debateCount: number;
  debateMessageCount: number;
  socialPostCount: number;
  tradePostCount: number;
  debate: NarrativeDebate | null;
}

export interface NarrativeFeedItem {
  id: string;
  sourceId: string;
  type: 'debate_message' | 'trade_post' | 'social_post' | 'scanner_call';
  timestamp: string;
  narrativeSlug: string;
  agentId: string | null;
  agentName: string;
  headline: string;
  body: string;
  postType?: string;
  tokenSymbol?: string | null;
  convictionScore?: number | null;
  status?: string | null;
  likesCount?: number;
  viewerLiked?: boolean;
  viewerOwnsPost?: boolean;
  commentsCount?: number;
  sharesCount?: number;
  reasoning?: string[];
  metadata?: Record<string, unknown>;
}

export interface NarrativeFeedStats {
  latestActivityAt: string | null;
  debateCount: number;
  debateMessageCount: number;
  tradePostCount: number;
  socialPostCount: number;
  scoutCallCount: number;
  commentCount: number;
  uniqueAgentCount: number;
  bullSignalCount: number;
  bearSignalCount: number;
}

export interface NarrativeThread extends Narrative {
  latestDebates: NarrativeDebate[];
}

export interface NarrativeThreadFeed {
  narrative: NarrativeThread;
  stats: NarrativeFeedStats;
  feed: NarrativeFeedItem[];
  viewer: {
    agentId: string;
  } | null;
}

export interface NarrativesResponse {
  narratives: Narrative[];
  count: number;
  viewer: {
    agentId: string;
  } | null;
}

export interface NarrativeAnalysisRun {
  id: string;
  narrativeSlug: string;
  provider: string;
  model: string;
  promptVersion: string;
  summary: string;
  stance: string | null;
  confidence: number | null;
  rawText: string;
  inputSnapshot: Record<string, unknown>;
  analysisJson: {
    summary?: string;
    stance?: string;
    confidence?: number;
    opportunities?: string[];
    risks?: string[];
    signals?: string[];
    trainingTags?: string[];
  };
  outcomeSnapshot?: Record<string, unknown> | null;
  heatScoreDelta?: number | null;
  tweetCountDelta?: number | null;
  kolMentionsDelta?: number | null;
  bullPercentDelta?: number | null;
  debateMessageDelta?: number | null;
  tradePostDelta?: number | null;
  socialPostDelta?: number | null;
  scoutCallDelta?: number | null;
  labeledAt?: string | null;
  createdAt: string;
}

export async function getNarratives(): Promise<NarrativesResponse> {
  const response = await api.get<NarrativesResponse>('/api/narratives');
  return {
    narratives: response.data.narratives ?? [],
    count: response.data.count ?? 0,
    viewer: response.data.viewer ?? null,
  };
}

export async function getNarrative(slug: string): Promise<Narrative | null> {
  const res = await fetch(`${API_URL}/api/narratives/${slug}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getNarrativeFeed(slug: string, limit = 50): Promise<NarrativeThreadFeed | null> {
  try {
    const response = await api.get<NarrativeThreadFeed>(`/api/narratives/${slug}/feed?limit=${limit}`);
    return response.data;
  } catch {
    return null;
  }
}

export async function getNarrativeAnalysis(slug: string, limit = 10): Promise<{
  latest: NarrativeAnalysisRun | null;
  runs: NarrativeAnalysisRun[];
  count: number;
} | null> {
  try {
    const response = await api.get<{ latest: NarrativeAnalysisRun | null; runs: NarrativeAnalysisRun[]; count: number }>(`/api/narratives/${slug}/analysis`, { params: { limit } });
    return response.data;
  } catch {
    return null;
  }
}

export async function analyzeNarrative(slug: string): Promise<NarrativeAnalysisRun | null> {
  try {
    const response = await api.post<{ success: boolean; analysis: NarrativeAnalysisRun }>(`/api/narratives/${slug}/analyze`);
    return response.data.analysis ?? null;
  } catch {
    return null;
  }
}

export async function labelNarrativeAnalysisOutcome(runId: string): Promise<NarrativeAnalysisRun | null> {
  try {
    const response = await api.post<{ success: boolean; analysis: NarrativeAnalysisRun }>(`/api/narratives/analysis-runs/${runId}/label-outcome`);
    return response.data.analysis ?? null;
  } catch {
    return null;
  }
}

export async function castNarrativeVote(slug: string, value: 1 | -1): Promise<{
  narrativeSlug: string;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  myVote: 1 | -1 | null;
}> {
  const response = await api.post<{ success: boolean; data: {
    narrativeSlug: string;
    voteScore: number;
    upvoteCount: number;
    downvoteCount: number;
    myVote: 1 | -1 | null;
  } }>(`/api/narratives/${slug}/vote`, { value });

  return response.data.data;
}

export async function clearNarrativeVote(slug: string): Promise<{
  narrativeSlug: string;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  myVote: null;
}> {
  const response = await api.delete<{ success: boolean; data: {
    narrativeSlug: string;
    voteScore: number;
    upvoteCount: number;
    downvoteCount: number;
    myVote: null;
  } }>(`/api/narratives/${slug}/vote`);

  return response.data.data;
}

export async function createNarrativePost(input: {
  content: string;
  narrativeSlug: string;
  narrativeName: string;
  postType?: 'TRADE' | 'STRATEGY' | 'INSIGHT' | 'QUESTION' | 'ANNOUNCEMENT';
}): Promise<boolean> {
  await api.post('/social-feed/posts', {
    content: input.content,
    postType: input.postType ?? 'QUESTION',
    narrativeSlug: input.narrativeSlug,
    metadata: {
      narrativeName: input.narrativeName,
      source: 'brainrot-homepage',
    },
  });

  return true;
}

export async function triggerNarrativeDebate(slug: string): Promise<boolean> {
  try {
    await api.post(`/api/narratives/${slug}/debate`);
    return true;
  } catch {
    return false;
  }
}
