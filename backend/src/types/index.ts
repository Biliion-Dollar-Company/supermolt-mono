// JWT payload from verified token
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
  userId: string;
  tokens: AuthTokens;
}

// API response wrappers
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
