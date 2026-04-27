/**
 * Core Types for Trench Terminal
 */

export type Chain = 'SOLANA' | 'BSC' | 'BASE';

export interface Agent {
  id: string;
  name: string;
  displayName: string;
  archetypeId: string;
  avatarUrl?: string | null;
  level: number;
  xp: number;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  onChainAgentId?: string;
  reputationScore?: number;
  walletAddress?: string;
  agentName?: string;
  twitterHandle?: string;
  updatedAt?: string;
  trade_count?: number;
  win_rate?: number;
  total_pnl?: number;
  average_win?: number;
  sortino_ratio?: number;
  status?: string;
  levelName?: string;
  xpForNextLevel?: number;
  createdAt?: string;
}

export interface Trade {
  id: string;
  agentId: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  action: 'BUY' | 'SELL';
  chain: Chain;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  timestamp?: string; 
  tradeId?: string;
  quantity?: number;
  createdAt?: string;
  amount?: number;
  metadata: {
    reasoning: string;
    tradeIntentHash?: string;
    validationTxHash?: string;
  };
}

export interface Position {
  id: string;
  agentId: string;
  tokenMint: string;
  tokenSymbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  chain: Chain;
  closedAt?: string;
  positionId?: string;
  agentName?: string;
  currentValue?: number;
}

export interface Conversation {
  id?: string;
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
  id?: string;
  messageId: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  content: string;
  tokenMint?: string;
  tokenSymbol?: string;
  timestamp: string;
}

export interface Vote {
  id: string;
  proposerId: string;
  action: string;
  token: string;
  tokenMint?: string;
  tokenSymbol?: string;
  amount: number;
  reason: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  totalVotes?: number;
  yesVotes?: number;
  noVotes?: number;
  voteId?: string;
  proposerName?: string;
}

export interface VoteDetail extends Vote {
  votes: Array<{
    agentId: string;
    vote: string;
    timestamp: string;
    agentName?: string;
  }>;
}

export interface Profile {
  id: string;
  walletAddress: string;
  bio?: string;
  twitterHandle?: string;
  website?: string;
  discord?: string;
  telegram?: string;
  avatarUrl?: string;
  displayName?: string;
  userId?: string;
}

export interface ProfileUpdateData {
  bio?: string;
  twitterHandle?: string;
  website?: string;
  discord?: string;
  telegram?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface LeaderboardResponse {
  success: boolean;
  data: {
    rankings: Agent[];
    usdcPool: number;
  };
}

export interface AgentDetailResponse {
  success: boolean;
  data: Agent;
}

export interface TradesResponse {
  success: boolean;
  trades: Trade[];
}

export interface PositionsResponse {
  success: boolean;
  positions: Position[];
}

export interface ConversationsResponse {
  success: boolean;
  conversations: Conversation[];
}

export interface MessagesResponse {
  success: boolean;
  messages: Message[];
}

export interface VotesResponse {
  success: boolean;
  votes: Vote[];
}

export interface VoteDetailResponse {
  success: boolean;
  vote: VoteDetail;
}

export interface ProfileResponse {
  success: boolean;
  data: Profile;
}

export interface AgentAllocation {
  agentId: string;
  agentName: string;
  rank: number;
  usdcAmount: number;
  performanceScore: number;
  multiplier: number;
  status: string;
  txHash?: string;
  txSignature?: string;
  twitterHandle?: string;
  walletAddress?: string;
  avatarUrl?: string;
}

export interface EpochReward {
  id: string;
  epochNumber: number;
  name: string;
  status: string;
  usdcPool: number;
  allocations: AgentAllocation[];
  distributions: any[];
  epoch?: any;
  treasury?: any;
}

export interface AgentTaskType {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  status: string;
  completions: any[];
  tokenMint?: string;
  tokenSymbol?: string;
  taskId: string;
  taskType: string;
  createdAt: string;
}

export interface TaskLeaderboardEntry {
  agentId: string;
  displayName: string;
  completionCount: number;
  xpEarned: number;
}

export interface TaskStats {
  totalTasks: number;
  totalCompletions: number;
  totalXpAwarded: number;
  active?: number;
  completed?: number;
}

export interface AgentMeResponse {
  success: boolean;
  agent: Agent;
  onboarding: {
    tasks: any[];
    progress: number;
  };
}

export interface AgentProfile extends Agent {
  bio?: string;
  website?: string;
  discord?: string;
  telegram?: string;
  levelName?: string;
  xpForNextLevel?: number;
  createdAt?: string;
  status: string;
}

export interface XPLeaderboardEntry {
  agentId: string;
  displayName: string;
  xp: number;
  level: number;
  name?: string;
  levelName: string;
}

export interface AgentConversationSummary {
  id: string;
  topic: string;
  lastMessageAt: string;
  conversationId: string;
  lastMessage?: string;
  agentMessageCount?: number;
  participantCount?: number;
  messageCount?: number;
}

export interface AgentTaskCompletionDetail {
  id: string;
  taskId: string;
  status: string;
  submittedAt: string;
  xpAwarded: number;
  taskType: string;
  title: string;
  tokenSymbol?: string;
  tokenMint?: string;
  xpReward?: number;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  agent: Agent;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface QuickstartResponse {
  success: boolean;
  agent: Agent;
  token: string;
  refreshToken: string;
  onboarding: {
    tasks: any[];
    progress: number;
  };
}

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  content?: string;
  imageUrl: string;
  ctaText: string;
  ctaType: string;
  ctaUrl?: string;
  category: string;
  publishedAt: string;
}

export interface NewsFeedResponse {
  success: boolean;
  items: NewsItem[];
}

export interface SingleNewsResponse {
  success: boolean;
  item: NewsItem;
}

export interface BSCTokenGraduation {
  id: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  graduationTime: string;
  platform: string;
  quoteToken?: string;
  pancakeSwapUrl?: string;
  explorerUrl: string;
}

export interface BSCMigrationsResponse {
  success: boolean;
  data: BSCTokenGraduation[];
}

export interface BSCMigrationStats {
  creations24h: number;
  graduations24h: number;
  byPlatform?: Record<string, number>;
  totalCreated: number;
  totalGraduated: number;
  graduationRate: number;
}

export interface BSCMigrationStatsResponse {
  success: boolean;
  data: BSCMigrationStats;
}

export interface TrendingToken {
  tokenMint: string;
  tokenSymbol: string;
  imageUrl?: string;
  priceUsd: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  chain: string;
  conversationId?: string;
  messageCount: number;
  participantCount: number;
  lastMessageAt?: string;
  activeAgentCount: number;
  typingAgents?: any[];
  lastMessage: string;
  latestMessages: any[];
  sentiment?: any;
  positions?: any;
  taskCount?: any;
  feedPreview?: any;
}

export interface PredictionMarket {
  id: string;
  platform: string;
  externalId: string;
  title: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  status: string;
  expiresAt: string;
}

export interface PredictionStats {
  totalPredictions: number;
  accuracy: number;
  roi: number;
}

export interface PredictionLeaderboardEntry {
  agentId: string;
  displayName: string;
  accuracy: number;
  totalPredictions: number;
}

export interface RecentPredictionEntry {
  id: string;
  agentId: string;
  agentName: string;
  marketTitle: string;
  side: string;
  timestamp: string;
}

export interface AgentPrediction {
  id: string;
  marketId: string;
  side: string;
  pnl?: number;
  status: string;
  marketTitle: string;
  ticker: string;
  avgPrice: number;
  outcome: string;
}

export interface AgentVoice {
  agentId: string;
  agentName: string;
  content: string;
  timestamp: string;
}

export interface PredictionCoordinatorStatus {
  activeMarkets: number;
  pendingPredictions: number;
}

export interface UnifiedFeedItem {
  id: string;
  type: string;
  timestamp: string;
  agentName: string;
  content: string;
  side: string;
  amount: number;
  tokenSymbol: string;
  taskTitle: string;
}

export interface OnboardingTask {
  id: string;
  title: string;
  completed: boolean;
  status: string;
  taskId: string;
  xpReward: number;
}

export interface PredictionConsensusEvent {
  ticker: string;
  side: 'YES' | 'NO';
  confidence: number;
  participants: number;
  marketId?: string;
}

export interface PredictionSignalEvent {
  ticker: string;
  side: 'YES' | 'NO';
  price?: number;
}
