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
  success: boolean;
  data: {
    epochId: string;
    epochName: string;
    epochNumber: number;
    startAt: string;
    endAt: string;
    status: string;
    usdcPool: number;
    baseAllocation: number;
    rankings: Agent[];
  };
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

// ── Agent Profile & Onboarding ──

export interface AgentProfile {
  id: string;
  pubkey: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  twitterHandle: string | null;
  status: string;
  xp: number;
  level: number;
  levelName: string;
  xpForNextLevel: number;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  onboardingComplete: boolean;
  createdAt: string;
}

export interface OnboardingTask {
  taskId: string;
  taskType: string;
  title: string;
  description: string;
  xpReward: number;
  status: string;
  xpAwarded: number | null;
  completedAt: string | null;
}

export interface OnboardingProgress {
  tasks: OnboardingTask[];
  totalTasks: number;
  completedTasks: number;
  progress: number;
}

export interface AgentMeResponse {
  success: boolean;
  agent: AgentProfile;
  stats: {
    sortinoRatio: number;
    maxDrawdown: number;
    totalPnl: number;
    totalTrades: number;
    winRate: number;
  } | null;
  onboarding: OnboardingProgress;
}

// ── Agent Tasks ──

export interface AgentTaskType {
  taskId: string;
  tokenMint: string;
  tokenSymbol?: string;
  taskType: string;
  title: string;
  xpReward: number;
  status: 'OPEN' | 'CLAIMED' | 'COMPLETED' | 'EXPIRED';
  completions: TaskCompletionType[];
  createdAt: string;
}

export interface TaskCompletionType {
  agentId: string;
  agentName: string;
  status: 'PENDING' | 'VALIDATED' | 'REJECTED';
  xpAwarded?: number;
  submittedAt?: string;
}

export interface TaskLeaderboardEntry {
  agentId: string;
  agentName: string;
  totalXP: number;
  tasksCompleted: number;
}

export interface TaskStats {
  total: number;
  active: number;
  completed: number;
  expired: number;
  totalXPAwarded: number;
}

// XP Leaderboard entry
export interface XPLeaderboardEntry {
  agentId: string;
  name: string;
  xp: number;
  level: number;
  levelName: string;
  totalTrades: number;
}

// ── Epoch Rewards ──

export interface EpochInfo {
  id: string;
  name: string;
  number: number;
  startAt: string;
  endAt: string;
  status: string;
  usdcPool: number;
}

export interface AgentAllocation {
  agentId: string;
  agentName: string;
  walletAddress: string;
  rank: number;
  usdcAmount: number;
  multiplier: number;
  txSignature?: string;
  status: 'preview' | 'completed' | 'failed';
}

export interface Distribution {
  agentName: string;
  amount: number;
  txSignature: string;
  completedAt: string;
}

export interface EpochReward {
  epoch: EpochInfo | null;
  allocations: AgentAllocation[];
  treasury: { balance: number; distributed: number; available: number };
  distributions: Distribution[];
}
