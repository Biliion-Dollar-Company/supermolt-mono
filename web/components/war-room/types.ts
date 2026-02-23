import type {
  Graphics as PixiGraphics,
  Text as PixiText,
  Container as PixiContainer,
  Sprite as PixiSprite,
} from 'pixi.js';

export interface AgentData {
  id: string;
  name: string;
  rank: number;
  winRate: number;
  pnl: number;
  totalTrades: number;
  trustScore: number;
  color?: number;
  pfpUrl?: string;
  twitterHandle?: string;
  notes?: string;
  bestTradePct?: number;
}

export interface FeedEvent {
  timestamp: string;
  agentName: string;
  action: 'BUY' | 'SELL' | 'ANALYZING';
  token: string;
}

export interface HoveredAgentInfo {
  agent: AgentData;
  currentStation: string;
  x: number;
  y: number;
}

export type Chain = 'SOL' | 'BASE' | 'BSC';

export interface DevPrintToken {
  symbol: string;
  name: string;
  mint: string;
  detection_source: string;
  detected_at: string;
  twitter_url: string | null;
  image_url: string | null;
  chain?: Chain;
}

export interface DevPrintTransaction {
  id: string;
  wallet_label: string;
  action: 'BUY' | 'SELL';
  token_symbol: string;
  token_mint?: string;
  usd_amount: number;
  timestamp: string;
}

export interface LiveTxNotification {
  id: string;
  text: string;
  action: 'BUY' | 'SELL';
  agentName: string;
  token: string;
  amount: string;
}

export interface Conversation {
  conversationId: string;
  topic: string;
  tokenMint: string;
  participantCount: number;
  messageCount: number;
  lastMessage: string | null;
  lastMessageAt: string;
  createdAt: string;
}

export interface TokenDef {
  ticker: string;
  name: string;
  mint?: string;
  imageUrl?: string;
  chain: Chain;
  rx: number;
  ry: number;
  detectedAt: Date;
  isNew: boolean;
  isOld: boolean;
}

export interface TokenStation {
  ticker: string;
  name: string;
  mint?: string;
  imageUrl?: string;
  chain: Chain;
  rx: number;
  ry: number;
  detectedAt: Date;
  isNew: boolean;
  isOld: boolean;
  container: PixiContainer;
  priceText: PixiText;
  dot: PixiGraphics;
  box: PixiGraphics;
  glowGraphics: PixiGraphics;
  timeText: PixiText;
  coordinationRing: PixiGraphics;
  chatIcon: PixiText;
  imageSprite: PixiSprite | null;
  // Collapsed state elements
  collapsedGroup: PixiContainer;
  collapsedBox: PixiGraphics;
  collapsedBorder: PixiGraphics;
  // Expanded state elements
  expandedGroup: PixiContainer;
  expandedBox: PixiGraphics;
  expandedBorder: PixiGraphics;
  metricPriceText: PixiText;
  metricHoldersText: PixiText;
  metrics: TokenMetrics | null;
  expanded: boolean;
  expandProgress: number;   // 0 = collapsed, 1 = expanded (animated)
  expandTarget: number;     // 0 or 1
  visitCount: number;
  scaleTarget: number;
  scaleCurrent: number;
}

export interface AgentState {
  data: AgentData;
  color: number;
  trustScore: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  targetStationIdx: number;
  currentStationIdx: number;
  homeStationIdx: number;
  travelDuration: number;
  travelElapsed: number;
  dwellTimer: number;
  arrived: boolean;
  breathOffset: number;
  isUrgent: boolean;
  pnlScale: number;
  container: PixiContainer;
  ring: PixiGraphics;
  circle: PixiGraphics;
  label: PixiText;
  bubbleText: PixiText;
  bubbleBg: PixiGraphics;
  bubbleTimer: number;
  avatarSprite: PixiSprite | null;
}

export interface TokenMetrics {
  marketCap: number;
  holders: number;
}

export interface Popup {
  container: PixiContainer;
  elapsed: number;
  duration: number;
  startY: number;
}
