import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { usePrivy, useLoginWithOAuth } from '@privy-io/expo';

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
  const router = useRouter();
  const segments = useSegments();

  // Privy hooks
  const { user: privyUser, isReady, logout: privyLogout } = usePrivy();
  const { login: oauthLogin, state: oauthState } = useLoginWithOAuth();

  const isLoading = !isReady || oauthState.status === 'loading';

  // Map Privy user to our User type
  // Use type assertion since Privy's types may vary across versions
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

  // Redirect based on auth state
  useEffect(() => {
    if (!isReady) return;

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(auth)';
    // Check if we're on the root index (undefined segment means root)
    const onRootIndex = firstSegment === undefined;

    if (!privyUser && !inAuthGroup && !onRootIndex) {
      // Redirect to root (login screen) if not authenticated
      router.replace('/');
    } else if (privyUser && (inAuthGroup || onRootIndex)) {
      // Redirect to home if authenticated
      router.replace('/(tabs)');
    }
  }, [privyUser, segments, isReady, router]);

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
      await privyLogout();
      setWallet(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, [privyLogout]);

  const value: AuthContextType = {
    user,
    wallet,
    isLoading,
    isAuthenticated: !!privyUser,
    loginWithTwitter,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
