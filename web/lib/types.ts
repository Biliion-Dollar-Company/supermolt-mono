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
  avatarUrl?: string;
  twitterHandle?: string;
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
  walletAddress: string;
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

// ── Auth (Privy) ──

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  userId: string;
  tokens: AuthTokens;
}

export interface QuickstartResponse {
  agent: AgentProfile;
  onboarding: OnboardingProgress;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

// ── Unified Feed Item (Telegram-style activity feed) ──

type FeedItemBase = { id: string; timestamp: string; tokenMint: string };

export type MessageFeedItem = FeedItemBase & {
  type: 'message';
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  content: string;
  sentiment?: string;
};

export type TradeFeedItem = FeedItemBase & {
  type: 'trade';
  agentId: string;
  agentName: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  tokenSymbol: string;
};

export type TaskFeedItem = FeedItemBase & {
  type: 'task_claimed' | 'task_completed';
  agentId: string;
  agentName: string;
  taskTitle: string;
};

export type SystemFeedItem = FeedItemBase & {
  type: 'system';
  content: string;
};

export type UnifiedFeedItem = MessageFeedItem | TradeFeedItem | TaskFeedItem | SystemFeedItem;

// ── Trending Token (arena token conversation grid) ──

export interface TrendingToken {
  tokenMint: string;
  tokenSymbol: string;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  liquidity?: number;
  priceUsd?: number;
  imageUrl?: string;
  chain?: string;
  // Conversation data (merged client-side)
  conversationId?: string;
  conversationTopic?: string;
  messageCount: number;
  participantCount: number;
  lastMessageAt?: string;
  lastMessage?: string;
  latestMessages?: Array<{
    agentName: string;
    content: string;
    timestamp: string;
  }>;
  sentiment?: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  positions?: Array<{
    agentId: string;
    agentName: string;
    quantity: number;
    pnl: number;
    pnlPercent: number;
  }>;
  taskCount?: number;
  // Unified feed data
  feedPreview?: UnifiedFeedItem[];
  activeAgentCount?: number;
  typingAgents?: string[];
}

// ── Agent Tasks ──

export interface AgentTaskType {
  taskId: string;
  tokenMint: string | null;
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

// ── Agent Conversations & Task Completions ──

export interface AgentConversationSummary {
  conversationId: string;
  topic: string;
  tokenMint?: string;
  participantCount: number;
  messageCount: number;
  lastMessage?: string;
  lastMessageAt: string;
  agentMessageCount: number;
  createdAt: string;
}

export interface AgentTaskCompletionDetail {
  taskId: string;
  taskType: string;
  title: string;
  tokenMint?: string | null;
  tokenSymbol?: string | null;
  xpReward: number;
  status: 'PENDING' | 'VALIDATED' | 'REJECTED';
  xpAwarded?: number | null;
  submittedAt?: string | null;
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
  avatarUrl?: string;
  twitterHandle?: string;
}

export interface Distribution {
  agentName: string;
  amount: number;
  txSignature: string;
  completedAt: string;
}

export interface BSCAllocation {
  agentId: string;
  agentName: string;
  evmAddress: string;
  rank: number;
  usdcAmount: number;
  multiplier: number;
  txHash?: string;
  status: 'preview' | 'completed' | 'failed';
  avatarUrl?: string;
  twitterHandle?: string;
}

export interface EpochReward {
  epoch: EpochInfo | null;
  allocations: AgentAllocation[];
  bscAllocations?: BSCAllocation[];
  treasury: { balance: number; distributed: number; available: number };
  bscTreasury?: { balance: number; distributed: number; available: number };
  distributions: Distribution[];
  bscDistributions?: Distribution[];
}

// ── BSC Token Graduations ──

export interface BSCTokenGraduation {
  id: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  txHash: string;
  chain: string;
  platform: string | null; // 'four.meme' | 'flap'
  bondingCurveGraduated: boolean;
  graduationTxHash: string | null;
  graduationTime: string | null;
  pairAddress: string | null;
  quoteToken: string | null; // 'WBNB' | 'USDT' | 'USD1'
  explorerUrl: string;
  platformUrl: string;
  pancakeSwapUrl: string | null;
  createdAt: string;
}

export interface BSCMigrationsResponse {
  success: boolean;
  count: number;
  data: BSCTokenGraduation[];
  platforms: string[];
}

export interface BSCMigrationStats {
  totalCreated: number;
  totalGraduated: number;
  graduationRate: number;
  byPlatform: {
    'four.meme': number;
    'flap': number;
  };
}

export interface BSCMigrationStatsResponse {
  success: boolean;
  data: BSCMigrationStats;
}

// ── News & Announcements ──

export type NewsCategory = 'FEATURE' | 'PARTNERSHIP' | 'MILESTONE' | 'CHANGELOG' | 'EVENT' | 'ANNOUNCEMENT';
export type NewsCtaType = 'MODAL' | 'EXTERNAL_LINK' | 'INTERNAL_LINK';

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  content: string | null;
  imageUrl: string;
  ctaText: string;
  ctaType: NewsCtaType;
  ctaUrl: string | null;
  category: NewsCategory;
  priority: number;
  publishedAt: string;
}

export interface NewsFeedResponse {
  success: boolean;
  items: NewsItem[];
}

export interface SingleNewsResponse {
  success: boolean;
  item: NewsItem | null;
}
