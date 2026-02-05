// ============================================
// SR-Mobile Shared Types
// Used by both mobile and backend
// ============================================

// ============================================
// User Types
// ============================================
export interface User {
  id: string;
  privyId: string;
  walletAddress?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  notifications: boolean;
  autoSign: boolean;
  maxSlippage: number;
}

// ============================================
// Agent Types
// ============================================
export type AgentStatus = 'stopped' | 'running' | 'paused';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface TradingHours {
  enabled: boolean;
  start: string; // HH:mm format
  end: string; // HH:mm format
}

export interface AgentConfig {
  riskLevel: RiskLevel;
  maxPositionSize: number; // Percentage of portfolio
  stopLoss: number; // Percentage
  takeProfit: number; // Percentage
  allowedTokens: string[]; // Token addresses to trade
  tradingHours: TradingHours;
}

export interface AgentState {
  status: AgentStatus;
  config: AgentConfig;
  lastActivity?: string; // ISO date string
}

// ============================================
// Auth Types
// ============================================
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// ============================================
// Trade Types
// ============================================
export type TradeAction = 'buy' | 'sell';
export type TradeStatus = 'pending' | 'confirmed' | 'failed';

export interface Trade {
  id: string;
  userId: string;
  tokenAddress: string;
  tokenSymbol?: string;
  action: TradeAction;
  amount: number;
  priceSol?: number;
  txSignature?: string;
  status: TradeStatus;
  createdAt: string;
}

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ============================================
// WebSocket Message Types (for future use)
// ============================================
export type WSMessageType =
  | 'agent_status'
  | 'trade_signal'
  | 'trade_executed'
  | 'error'
  | 'ping'
  | 'pong';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: string;
}

export interface TradeSignal {
  tokenAddress: string;
  tokenSymbol: string;
  action: TradeAction;
  reason: string;
  confidence: number; // 0-100
  suggestedAmount: number;
}

// ============================================
// Config Update Types
// ============================================
export type UpdateAgentConfigRequest = Partial<AgentConfig>;

export interface UpdateSettingsRequest {
  notifications?: boolean;
  autoSign?: boolean;
  maxSlippage?: number;
}
