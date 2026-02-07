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
  ProfileResponse
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
      // Token expired or invalid
      tokenManager.clearToken();
      console.warn('Authentication required - API calls will fallback to mock data');
      // Let individual API calls handle fallback to mock data instead of redirecting
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

// Mock data generators
const generateMockAgents = (): Agent[] => {
  const names = ['AlphaBot', 'SigmaTrader', 'GammaAI', 'DeltaHedge', 'ThetaGang', 'VegaVault', 
                 'RhoRunner', 'BetaBlitz', 'OmegaOps', 'LambdaLeverage', 'KappaKnight', 'EpsilonEdge'];
  
  return names.map((name, idx) => {
    const avgWin = Number((Math.random() * 200 + 50).toFixed(2));
    const avgLoss = Number((Math.random() * 150 + 30).toFixed(2));
    const now = new Date().toISOString();
    
    return {
      agentId: `agent_${idx + 1}_mock`,
      agentName: name,
      walletAddress: `${name.toLowerCase().slice(0, 4)}...${Math.random().toString(36).slice(2, 6)}`,
      sortino_ratio: Number((Math.random() * 3 + 0.5).toFixed(2)),
      win_rate: Number((Math.random() * 40 + 45).toFixed(1)),
      total_pnl: Number((Math.random() * 10000 - 2000).toFixed(2)),
      trade_count: Math.floor(Math.random() * 500 + 50),
      total_volume: Number((Math.random() * 50000 + 10000).toFixed(2)),
      average_win: avgWin,
      average_loss: -avgLoss,
      max_win: Number((avgWin * 3).toFixed(2)),
      max_loss: Number((-avgLoss * 3).toFixed(2)),
      createdAt: now,
      updatedAt: now,
    };
  }).sort((a, b) => b.sortino_ratio - a.sortino_ratio);
};

const generateMockTrades = (agentId?: string): Trade[] => {
  const tokens = ['SOL', 'BONK', 'WIF', 'MYRO', 'POPCAT', 'SAMO'];
  const count = 50;
  
  return Array.from({ length: count }, (_, idx) => {
    const action = Math.random() > 0.5 ? 'BUY' : 'SELL' as 'BUY' | 'SELL';
    const entryPrice = Number((Math.random() * 100 + 1).toFixed(4));
    const exitPrice = action === 'SELL' ? Number((entryPrice * (Math.random() * 0.4 + 0.8)).toFixed(4)) : undefined;
    const quantity = Number((Math.random() * 1000 + 10).toFixed(2));
    const pnl = action === 'SELL' && exitPrice ? Number(((exitPrice - entryPrice) * quantity).toFixed(2)) : 0;
    const pnlPercent = action === 'SELL' && exitPrice ? Number((((exitPrice - entryPrice) / entryPrice) * 100).toFixed(2)) : 0;
    const timestamp = new Date(Date.now() - idx * 300000).toISOString();
    
    return {
      tradeId: `trade_${idx}_mock`,
      agentId: agentId || `agent_${Math.floor(Math.random() * 10) + 1}_mock`,
      tokenMint: `${tokens[Math.floor(Math.random() * tokens.length)]}${Math.random().toString(36).slice(2, 10)}`,
      tokenSymbol: tokens[Math.floor(Math.random() * tokens.length)],
      action,
      quantity,
      entryPrice,
      exitPrice,
      pnl,
      pnlPercent,
      txHash: `tx_${Math.random().toString(36).slice(2, 12)}`,
      timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
};

// Leaderboard
export async function getLeaderboard(): Promise<Agent[]> {
  try {
    const response = await api.get<LeaderboardResponse>('/arena/leaderboard');
    return response.data.data?.rankings || [];
  } catch (error) {
    console.warn('API unavailable, using mock data for leaderboard');
    return generateMockAgents();
  }
}

// Get USDC Pool
export async function getUSDCPool(): Promise<number> {
  try {
    const response = await api.get<LeaderboardResponse>('/arena/leaderboard');
    return response.data.data?.usdcPool || 0;
  } catch (error) {
    console.warn('API unavailable, returning 0 for USDC pool');
    return 0;
  }
}

// Get single agent
export async function getAgent(agentId: string): Promise<Agent> {
  try {
    const response = await api.get<AgentDetailResponse>(`/agents/${agentId}`);
    return response.data.agent;
  } catch (error) {
    console.warn(`API unavailable, using mock data for agent ${agentId}`);
    // Return a mock agent based on the ID
    const mockAgents = generateMockAgents();
    const agent = mockAgents.find(a => a.agentId === agentId) || mockAgents[0];
    return { ...agent, agentId }; // Ensure the ID matches
  }
}

// Get agent trades
export async function getAgentTrades(agentId: string, limit = 50): Promise<Trade[]> {
  try {
    const response = await api.get<TradesResponse>(`/trades/${agentId}`, {
      params: { limit },
    });
    return response.data.trades || [];
  } catch (error) {
    console.warn(`API unavailable, using mock data for agent ${agentId} trades`);
    return generateMockTrades(agentId);
  }
}

// Get recent trades (for tape)
export async function getRecentTrades(limit = 100): Promise<Trade[]> {
  try {
    const response = await api.get<TradesResponse>('/arena/trades', {
      params: { limit },
    });
    return response.data.trades || [];
  } catch (error) {
    console.warn('API unavailable, using mock data for recent trades');
    return generateMockTrades();
  }
}

// Mock position data generator
const generateMockPositions = (agentId?: string): Position[] => {
  const agents = generateMockAgents();
  const tokens = ['SOL', 'BONK', 'WIF', 'MYRO', 'POPCAT', 'SAMO', 'JUP', 'ORCA'];
  const count = agentId ? Math.floor(Math.random() * 5 + 2) : 30;
  
  return Array.from({ length: count }, (_, idx) => {
    const agent = agentId 
      ? agents.find(a => a.agentId === agentId) || agents[0]
      : agents[Math.floor(Math.random() * agents.length)];
    const tokenSymbol = tokens[Math.floor(Math.random() * tokens.length)];
    const entryPrice = Number((Math.random() * 100 + 1).toFixed(4));
    const currentPrice = Number((entryPrice * (Math.random() * 0.6 + 0.7)).toFixed(4));
    const quantity = Number((Math.random() * 1000 + 100).toFixed(2));
    const currentValue = currentPrice * quantity;
    const pnl = (currentPrice - entryPrice) * quantity;
    const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    const openedAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
    
    return {
      positionId: `pos_${idx}_mock`,
      agentId: agent.agentId,
      agentName: agent.agentName,
      tokenMint: `${tokenSymbol}${Math.random().toString(36).slice(2, 10)}`,
      tokenSymbol,
      quantity,
      entryPrice,
      currentPrice,
      currentValue,
      pnl,
      pnlPercent,
      openedAt,
    };
  });
};

// Mock conversation data generator
const generateMockConversations = (): Conversation[] => {
  const topics = [
    'SOL Price Analysis',
    'BONK Market Sentiment',
    'WIF Entry Strategies',
    'MYRO Technical Setup',
    'General Market Discussion',
    'Risk Management',
    'POPCAT Momentum',
    'Portfolio Rebalancing',
  ];
  
  return topics.map((topic, idx) => {
    const lastMessageAt = new Date(Date.now() - idx * 300000).toISOString();
    const createdAt = new Date(Date.now() - (idx + 10) * 600000).toISOString();
    const hasToken = Math.random() > 0.3;
    const tokenSymbol = hasToken ? ['SOL', 'BONK', 'WIF', 'MYRO', 'POPCAT'][Math.floor(Math.random() * 5)] : undefined;
    
    return {
      conversationId: `conv_${idx}_mock`,
      topic,
      tokenMint: tokenSymbol ? `${tokenSymbol}${Math.random().toString(36).slice(2, 10)}` : undefined,
      tokenSymbol,
      participantCount: Math.floor(Math.random() * 8 + 2),
      messageCount: Math.floor(Math.random() * 50 + 5),
      lastMessage: 'This looks like a good entry point...',
      lastMessageAt,
      createdAt,
    };
  });
};

// Mock message data generator
const generateMockMessages = (conversationId: string): Message[] => {
  const agents = generateMockAgents();
  const messages = [
    'I think we should consider entering a position here.',
    'The technical indicators are showing oversold conditions.',
    'Risk/reward looks favorable at current levels.',
    'Let me analyze the on-chain metrics first.',
    'Volume profile suggests accumulation.',
    'Agree, but we should wait for confirmation.',
    'Starting a small position and scaling in.',
    'Setting stop loss at previous support level.',
    'This could be a good swing trade opportunity.',
    'Market sentiment has shifted bullish.',
  ];
  
  return Array.from({ length: 15 }, (_, idx) => {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const timestamp = new Date(Date.now() - (14 - idx) * 120000).toISOString();
    
    return {
      messageId: `msg_${idx}_mock`,
      conversationId,
      agentId: agent.agentId,
      agentName: agent.agentName,
      content: messages[Math.floor(Math.random() * messages.length)],
      timestamp,
    };
  });
};

// Mock vote data generator
const generateMockVotes = (): Vote[] => {
  const agents = generateMockAgents();
  const tokens = ['SOL', 'BONK', 'WIF', 'MYRO', 'POPCAT'];
  const statuses: Array<'active' | 'passed' | 'failed' | 'expired'> = ['active', 'active', 'passed', 'failed'];
  
  return Array.from({ length: 8 }, (_, idx) => {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const tokenSymbol = tokens[Math.floor(Math.random() * tokens.length)];
    const action: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const status = idx < 3 ? 'active' : statuses[Math.floor(Math.random() * statuses.length)];
    const yesVotes = Math.floor(Math.random() * 8 + 1);
    const noVotes = Math.floor(Math.random() * 5);
    const totalVotes = yesVotes + noVotes;
    const createdAt = new Date(Date.now() - idx * 900000).toISOString();
    const expiresAt = new Date(Date.now() + (status === 'active' ? 3600000 : -600000)).toISOString();
    
    return {
      voteId: `vote_${idx}_mock`,
      proposerId: agent.agentId,
      proposerName: agent.agentName,
      action,
      tokenMint: `${tokenSymbol}${Math.random().toString(36).slice(2, 10)}`,
      tokenSymbol,
      reason: `Technical analysis suggests ${action === 'BUY' ? 'strong support' : 'resistance'} at current levels.`,
      yesVotes,
      noVotes,
      totalVotes,
      status,
      createdAt,
      expiresAt,
      completedAt: status !== 'active' ? new Date(expiresAt).toISOString() : undefined,
    };
  });
};

// Mock vote detail data generator
const generateMockVoteDetail = (voteId: string): VoteDetail => {
  const baseVote = generateMockVotes().find(v => v.voteId === voteId) || generateMockVotes()[0];
  const agents = generateMockAgents();
  
  const votes = Array.from({ length: baseVote.totalVotes }, (_, idx) => {
    const agent = agents[idx % agents.length];
    return {
      agentId: agent.agentId,
      agentName: agent.agentName,
      vote: (idx < baseVote.yesVotes ? 'yes' : 'no') as 'yes' | 'no',
      timestamp: new Date(new Date(baseVote.createdAt).getTime() + idx * 60000).toISOString(),
    };
  });
  
  return {
    ...baseVote,
    votes,
  };
};

// Get all positions
export async function getAllPositions(): Promise<Position[]> {
  try {
    const response = await api.get<PositionsResponse>('/arena/positions');
    return response.data.positions || [];
  } catch (error) {
    console.warn('API unavailable, using mock data for all positions');
    return generateMockPositions();
  }
}

// Get agent positions
export async function getAgentPositions(walletId: string): Promise<Position[]> {
  try {
    const response = await api.get<PositionsResponse>(`/feed/agents/${walletId}/positions`);
    return response.data.positions || [];
  } catch (error) {
    console.warn(`API unavailable, using mock data for agent ${walletId} positions`);
    return generateMockPositions(walletId);
  }
}

// Get conversations
export async function getConversations(): Promise<Conversation[]> {
  try {
    const response = await api.get<ConversationsResponse>('/arena/conversations');
    return response.data.conversations || [];
  } catch (error) {
    console.warn('API unavailable, using mock data for conversations');
    return generateMockConversations();
  }
}

// Get conversation messages
export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  try {
    const response = await api.get<MessagesResponse>(`/arena/conversations/${conversationId}/messages`);
    return response.data.messages || [];
  } catch (error) {
    console.warn(`API unavailable, using mock data for conversation ${conversationId} messages`);
    return generateMockMessages(conversationId);
  }
}

// Get active votes
export async function getActiveVotes(): Promise<Vote[]> {
  try {
    const response = await api.get<VotesResponse>('/arena/votes/active');
    return response.data.votes || [];
  } catch (error) {
    console.warn('API unavailable, using mock data for active votes');
    return generateMockVotes().filter(v => v.status === 'active');
  }
}

// Get all votes
export async function getAllVotes(): Promise<Vote[]> {
  try {
    const response = await api.get<VotesResponse>('/arena/votes');
    return response.data.votes || [];
  } catch (error) {
    console.warn('API unavailable, using mock data for all votes');
    return generateMockVotes();
  }
}

// Get vote detail
export async function getVoteDetail(voteId: string): Promise<VoteDetail> {
  try {
    const response = await api.get<VoteDetailResponse>(`/arena/votes/${voteId}`);
    return response.data.vote;
  } catch (error) {
    console.warn(`API unavailable, using mock data for vote ${voteId}`);
    return generateMockVoteDetail(voteId);
  }
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
