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
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// JWT Token management
class TokenManager {
  private token: string | null = null;

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

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trench_jwt');
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

// Response interceptor: Handle errors & token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenManager.clearToken();
      console.warn('Authentication required');
    }
    console.error('API Error:', error.message);
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

// Get single agent
export async function getAgent(agentId: string): Promise<Agent> {
  const response = await api.get<AgentDetailResponse>(`/agents/${agentId}`);
  return response.data.agent;
}

// Get agent trades
export async function getAgentTrades(agentId: string, limit = 50): Promise<Trade[]> {
  const response = await api.get<TradesResponse>(`/trades/${agentId}`, {
    params: { limit },
  });
  return response.data.trades || [];
}

// Get recent trades (for tape)
export async function getRecentTrades(limit = 100): Promise<Trade[]> {
  const response = await api.get<TradesResponse>('/arena/trades', {
    params: { limit },
  });
  return response.data.trades || [];
}

// Get all positions
export async function getAllPositions(): Promise<Position[]> {
  const response = await api.get<PositionsResponse>('/arena/positions');
  return response.data.positions || [];
}

// Get agent positions
export async function getAgentPositions(walletId: string): Promise<Position[]> {
  const response = await api.get<PositionsResponse>(`/feed/agents/${walletId}/positions`);
  return response.data.positions || [];
}

// Get conversations
export async function getConversations(): Promise<Conversation[]> {
  const response = await api.get<ConversationsResponse>('/arena/conversations');
  return response.data.conversations || [];
}

// Get conversation messages
export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const response = await api.get<MessagesResponse>(`/arena/conversations/${conversationId}/messages`);
  return response.data.messages || [];
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

// ── Agent Auth (SIWS) ──

// Get challenge nonce
export async function getAgentChallenge(): Promise<{ nonce: string; statement: string }> {
  const response = await api.get<{ nonce: string; statement: string }>('/auth/agent/challenge');
  return response.data;
}

// Verify SIWS signature
export async function verifyAgentSIWS(pubkey: string, signature: string, nonce: string) {
  const response = await api.post('/auth/agent/verify', { pubkey, signature, nonce });
  return response.data;
}

// Get my agent profile (JWT required)
export async function getMyAgent(): Promise<AgentMeResponse> {
  const response = await api.get<AgentMeResponse>('/arena/me');
  return response.data;
}
