// Arena types — ported from web/lib/types.ts

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
  chain?: string;
  evmAddress?: string;
}

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
  agentName?: string;
  tokenName?: string;
}

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

// Agent Profile & Onboarding

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

// Agent Tasks & Gamification

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

export interface XPLeaderboardEntry {
  agentId: string;
  name: string;
  xp: number;
  level: number;
  levelName: string;
  totalTrades: number;
}

// Epoch Rewards

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

export interface EpochReward {
  epoch: EpochInfo | null;
  allocations: AgentAllocation[];
  treasury: { balance: number; distributed: number; available: number };
  bscTreasury?: { balance: number; distributed: number; available: number };
  distributions: { agentName: string; amount: number; txSignature: string; completedAt: string }[];
  bscDistributions?: { agentName: string; amount: number; txSignature: string; completedAt: string }[];
}

// BSC

export interface BSCTokenGraduation {
  id: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  txHash: string;
  chain: string;
  platform: string | null;
  bondingCurveGraduated: boolean;
  graduationTxHash: string | null;
  graduationTime: string | null;
  pairAddress: string | null;
  quoteToken: string | null;
  explorerUrl: string;
  platformUrl: string;
  pancakeSwapUrl: string | null;
  createdAt: string;
}

// News

export type NewsCategory = 'FEATURE' | 'PARTNERSHIP' | 'MILESTONE' | 'CHANGELOG' | 'EVENT' | 'ANNOUNCEMENT';

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  content: string | null;
  imageUrl: string;
  ctaText: string;
  ctaType: 'MODAL' | 'EXTERNAL_LINK' | 'INTERNAL_LINK';
  ctaUrl: string | null;
  category: NewsCategory;
  priority: number;
  publishedAt: string;
}

// Voting

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

export interface VoteDetail extends Vote {
  votes: Array<{
    agentId: string;
    agentName: string;
    vote: 'yes' | 'no';
    timestamp: string;
  }>;
}

// Archetypes & Multi-Agent

export interface ArchetypeStats {
  aggression: number;
  riskTolerance: number;
  speed: number;
  patience: number;
  selectivity: number;
}

export interface Archetype {
  id: string;
  name: string;
  description: string;
  emoji: string;
  stats: ArchetypeStats;
}

export interface UserAgent {
  id: string;
  userId: string;
  archetypeId: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  twitterHandle: string | null;
  status: string;
  chain: string;
  xp: number;
  level: number;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    paperTrades: number;
    feedbacks: number;
  };
}

export interface SwitchAgentResponse {
  agent: UserAgent;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  expiresIn: number;
}

// Active / Hot Tokens

export interface ActiveToken {
  tokenMint: string;
  tokenSymbol: string;
  agentCount: number;
  tradeCount: number;
  conversationCount: number;
  positionCount: number;
  taskCount: number;
  voteCount: number;
  volume: number;
  netPnl: number;
  lastTradeTime: string | null;
  activityScore: number;
}

// Trending Tokens (Discussion Engine)

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
}

// Auth

export interface QuickstartResponse {
  agent: AgentProfile;
  onboarding: OnboardingProgress;
  token: string;
  refreshToken: string;
  expiresIn: number;
}
