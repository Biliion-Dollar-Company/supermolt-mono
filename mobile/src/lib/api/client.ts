import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const TOKEN_KEY = 'sr_access_token';
const REFRESH_TOKEN_KEY = 'sr_refresh_token';

export interface SRTokens {
  accessToken: string;
  refreshToken: string;
}

// Token storage
export async function storeTokens(tokens: SRTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// Auth endpoints (no JWT needed)
export async function loginWithPrivyToken(privyToken: string): Promise<{
  userId: string;
  tokens: SRTokens;
}> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privyToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Login failed' }));
    const msg = body?.error?.message || body?.error || `Login failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  const json = await res.json();
  // Backend wraps in { success, data: { userId, tokens } }
  const data = json.data ?? json;
  const tokens: SRTokens = {
    accessToken: data.tokens?.accessToken || data.accessToken,
    refreshToken: data.tokens?.refreshToken || data.refreshToken,
  };
  if (!tokens.accessToken) {
    throw new Error('No access token in login response');
  }
  await storeTokens(tokens);
  return { userId: data.userId, tokens };
}

export async function refreshAccessToken(): Promise<SRTokens | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const json = await res.json();
    const data = json.data ?? json;
    const tokens: SRTokens = {
      accessToken: data.tokens?.accessToken || data.accessToken,
      refreshToken: data.tokens?.refreshToken || data.refreshToken,
    };
    if (!tokens.accessToken) return null;
    await storeTokens(tokens);
    return tokens;
  } catch {
    await clearTokens();
    return null;
  }
}

// Authenticated fetch wrapper with auto-refresh
let isRefreshing = false;
let refreshPromise: Promise<SRTokens | null> | null = null;

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = await getAccessToken();

  const doFetch = async (accessToken: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return fetch(`${API_URL}${path}`, { ...options, headers });
  };

  let res = await doFetch(token);

  // If 401, try refreshing the token once
  if (res.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken();
    }

    const newTokens = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (newTokens) {
      res = await doFetch(newTokens.accessToken);
    } else {
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    const msg = body?.error?.message || body?.error || `Request failed (${res.status})`;
    throw new ApiError(res.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  const json = await res.json();
  // Backend wraps responses in { success, data }
  return (json.data ?? json) as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
