// User types
export interface User {
  id: string;
  privyId: string;
  walletAddress: string | null;
  email: string | null;
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  notifications: boolean;
  autoSign: boolean;
  maxSlippage: number;
}

// Agent types
export type AgentStatus = 'stopped' | 'running' | 'paused';

export interface AgentConfig {
  riskLevel: 'low' | 'medium' | 'high';
  maxPositionSize: number;
  stopLoss: number;
  takeProfit: number;
  allowedTokens: string[];
  tradingHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface AgentState {
  status: AgentStatus;
  config: AgentConfig;
  lastActivity?: string;
}

// Auth types
export interface JwtPayload {
  sub: string;
  privyId: string;
  wallet?: string;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// API types
export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
