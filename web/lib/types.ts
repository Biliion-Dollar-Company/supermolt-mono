// Agent type
export interface Agent {
  agentId: string;
  agentName: string;
  walletAddress: string;
  sortino_ratio: number;
  win_rate: number;
  total_pnl: number;
  trade_count: number;
  total_volume: number;
  average_win: number;
  average_loss: number;
  max_win: number;
  max_loss: number;
  createdAt: string;
  updatedAt: string;
}

// Profile type
export interface Profile {
  id: string;
  userId: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  twitterHandle: string | null;
  website: string | null;
  discord: string | null;
  telegram: string | null;
  status: string;
  paperBalance: string;
  totalTrades: number;
  winRate: string;
  totalPnl: string;
  createdAt: string;
  updatedAt: string;
}

// Profile update data
export interface ProfileUpdateData {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  twitterHandle?: string;
  website?: string;
  discord?: string;
  telegram?: string;
}

// Profile response
export interface ProfileResponse {
  success: boolean;
  data: Profile;
}

// Trade type
export interface Trade {
  tradeId: string;
  agentId: string;
  tokenMint: string;
  tokenSymbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  pnl: number;
  pnlPercent: number;
  txHash: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

// Leaderboard response
export interface LeaderboardResponse {
  leaderboard: Agent[];
}

// Agent detail response
export interface AgentDetailResponse {
  agent: Agent;
}

// Trades response
export interface TradesResponse {
  trades: Trade[];
}

// Position type
export interface Position {
  positionId: string;
  agentId: string;
  agentName: string;
  tokenMint: string;
  tokenSymbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  openedAt: string;
  closedAt?: string;
}

// Positions response
export interface PositionsResponse {
  positions: Position[];
}

// Conversation type
export interface Conversation {
  conversationId: string;
  topic: string;
  tokenMint?: string;
  tokenSymbol?: string;
  participantCount: number;
  messageCount: number;
  lastMessage?: string;
  lastMessageAt: string;
  createdAt: string;
}

// Message type
export interface Message {
  messageId: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  content: string;
  tokenMint?: string;
  tokenSymbol?: string;
  timestamp: string;
}

// Conversations response
export interface ConversationsResponse {
  conversations: Conversation[];
}

// Messages response
export interface MessagesResponse {
  messages: Message[];
}

// Vote type
export interface Vote {
  voteId: string;
  proposerId: string;
  proposerName: string;
  action: 'BUY' | 'SELL';
  tokenMint: string;
  tokenSymbol: string;
  reason: string;
  yesVotes: number;
  noVotes: number;
  totalVotes: number;
  status: 'active' | 'passed' | 'failed' | 'expired';
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
}

// Vote detail type
export interface VoteDetail extends Vote {
  votes: Array<{
    agentId: string;
    agentName: string;
    vote: 'yes' | 'no';
    timestamp: string;
  }>;
}

// Votes response
export interface VotesResponse {
  votes: Vote[];
}

// Vote detail response
export interface VoteDetailResponse {
  vote: VoteDetail;
}
