import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { usePrivy, useLoginWithOAuth } from '@privy-io/expo';
import * as Linking from 'expo-linking';
import { colors } from '@/theme/colors';
import {
  loginWithPrivyToken,
  clearTokens,
  getAccessToken,
  getMyAgent,
  getMyAgents,
  SRTokens,
} from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { useOnboardingStore } from '@/store/onboarding';

// Types
interface User {
  id: string;
  twitterUsername?: string;
  twitterId?: string;
  walletAddress?: string;
}

interface Wallet {
  address: string;
  type: 'embedded' | 'external';
}

interface AuthContextType {
  user: User | null;
  wallet: Wallet | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  srToken: string | null;
  loginWithTwitter: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [initTimeout, setInitTimeout] = useState(false);
  const [srToken, setSrToken] = useState<string | null>(null);
  const [srAuthLoading, setSrAuthLoading] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const setAgentMe = useAuthStore((s) => s.setAgentMe);
  const setAgents = useAuthStore((s) => s.setAgents);
  const clearAuthStore = useAuthStore((s) => s.clear);

  // Privy hooks
  const { user: privyUser, isReady, logout: privyLogout, getAccessToken: getPrivyToken } = usePrivy();
  const { login: oauthLogin, state: oauthState } = useLoginWithOAuth();

  // Debug logging for Privy state + redirect URL
  useEffect(() => {
    const redirectUrl = Linking.createURL('/');
    console.log('[Auth] Redirect URL that Privy will use:', redirectUrl);
    console.log('[Auth] Privy state:', {
      isReady,
      hasUser: !!privyUser,
      oauthStatus: oauthState.status,
      oauthError: 'error' in oauthState ? (oauthState as any).error?.message : undefined
    });
  }, [isReady, privyUser, oauthState]);

  // Timeout fallback - if Privy doesn't init in 5 seconds, show the app anyway
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isReady) {
        console.log('[Auth] Privy init timeout - showing app without auth');
        setInitTimeout(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isReady]);

  // After Privy auth succeeds, exchange for backend JWT
  useEffect(() => {
    if (!privyUser) {
      setSrToken(null);
      return;
    }

    let cancelled = false;

    async function exchangeToken() {
      // Check if we already have a stored token
      const existing = await getAccessToken();
      if (existing && !cancelled) {
        setSrToken(existing);
        // Populate auth store if not already populated
        try {
          const [meData, agentsList] = await Promise.all([
            getMyAgent().catch(() => null),
            getMyAgents().catch(() => []),
          ]);
          if (meData?.agent && !cancelled) {
            setAgentMe({
              agent: meData.agent,
              stats: meData.stats ?? null,
              onboarding: meData.onboarding,
            });
          }
          if (!cancelled && agentsList.length > 0) {
            setAgents(agentsList);
          }
        } catch {
          // Token may be expired — will get refreshed on next API call
        }
        return;
      }

      try {
        setSrAuthLoading(true);
        const privyToken = await getPrivyToken();
        if (!privyToken || cancelled) return;

        const result = await loginWithPrivyToken(privyToken);
        if (!cancelled) {
          setSrToken(result.tokens.accessToken);
          console.log('[Auth] SR-Mobile JWT obtained for user:', result.userId);

          // Populate auth store with agent profile + stats + onboarding + agents list
          try {
            const [meData, agentsList] = await Promise.all([
              getMyAgent().catch(() => null),
              getMyAgents().catch(() => []),
            ]);
            if (meData?.agent && !cancelled) {
              setAgentMe({
                agent: meData.agent,
                stats: meData.stats ?? null,
                onboarding: meData.onboarding,
              });
            }
            if (!cancelled && agentsList.length > 0) {
              setAgents(agentsList);
            }
          } catch (meErr) {
            console.warn('[Auth] Could not fetch agent profile:', meErr);
          }
        }
      } catch (err) {
        console.error('[Auth] SR-Mobile login failed:', err);
        // Don't block the app — user can still see UI, API calls will fail gracefully
      } finally {
        if (!cancelled) setSrAuthLoading(false);
      }
    }

    exchangeToken();
    return () => { cancelled = true; };
  }, [privyUser?.id]);

  // Redirect based on auth state (trench redirect logic)
  const agents = useAuthStore((s) => s.agents);
  const agentProfile = useAuthStore((s) => s.agentProfile);
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);

  useEffect(() => {
    if (!isReady && !initTimeout) return;
    // Don't redirect while still exchanging tokens
    if (srAuthLoading) return;

    const firstSegment = segments[0];
    const onRootIndex = firstSegment === undefined;
    const onOnboarding = segments.join('/') === 'onboarding';

    if (!privyUser && !onRootIndex) {
      router.replace('/');
    } else if (privyUser && onRootIndex) {
      // First-time users go through the interactive onboarding flow
      if (srToken && agents.length === 0 && !agentProfile && !hasCompletedOnboarding && !onOnboarding) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [privyUser, segments, isReady, initTimeout, router, srAuthLoading, srToken, agents.length, agentProfile, hasCompletedOnboarding]);

  // Only show loading if we're actively doing OAuth, not for Privy init (handled by timeout)
  const isLoading = oauthState.status === 'loading' || srAuthLoading;

  // Map Privy user to our User type
  const privyUserAny = privyUser as Record<string, unknown> | null;
  const twitterData = privyUserAny?.twitter as { username?: string; subject?: string } | undefined;
  const walletData = privyUserAny?.wallet as { address?: string } | undefined;

  const user: User | null = privyUser
    ? {
        id: privyUser.id,
        twitterUsername: twitterData?.username,
        twitterId: twitterData?.subject,
        walletAddress: walletData?.address,
      }
    : null;

  // Set up embedded wallet when user authenticates
  useEffect(() => {
    if (walletData?.address) {
      setWallet({
        address: walletData.address,
        type: 'embedded',
      });
    } else {
      setWallet(null);
    }
  }, [walletData?.address]);

  // Login with Twitter OAuth
  const loginWithTwitter = useCallback(async () => {
    try {
      await oauthLogin({ provider: 'twitter' });
    } catch (error) {
      console.error('Twitter login failed:', error);
      throw error;
    }
  }, [oauthLogin]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await clearTokens();
      setSrToken(null);
      clearAuthStore();
      await privyLogout();
      setWallet(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, [privyLogout, clearAuthStore]);

  const value: AuthContextType = {
    user,
    wallet,
    isLoading,
    isAuthenticated: !!privyUser,
    srToken,
    loginWithTwitter,
    logout,
  };

  // Show loading screen while Privy initializes (with timeout fallback)
  if (!isReady && !initTimeout) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
