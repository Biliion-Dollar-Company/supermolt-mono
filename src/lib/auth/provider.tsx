import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';

// Types
interface User {
  id: string;
  email?: string;
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
  login: () => Promise<void>;
  logout: () => Promise<void>;
  connectWallet: () => Promise<void>;
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
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Check auth state on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading]);

  async function checkAuthState() {
    try {
      // TODO: Check Privy session
      // For now, simulate a brief loading state
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock: Check if we have a stored session
      // In production, this would check Privy auth state
      setIsLoading(false);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsLoading(false);
    }
  }

  async function login() {
    try {
      setIsLoading(true);
      // TODO: Trigger Privy login
      // For now, mock a successful login
      setUser({
        id: 'mock-user-id',
        email: 'user@example.com',
      });
      setWallet({
        address: 'So11111111111111111111111111111111111111112',
        type: 'embedded',
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    try {
      setIsLoading(true);
      // TODO: Trigger Privy logout
      setUser(null);
      setWallet(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function connectWallet() {
    try {
      // TODO: Trigger MWA wallet connection
      console.log('Connecting wallet via MWA...');
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw error;
    }
  }

  const value: AuthContextType = {
    user,
    wallet,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    connectWallet,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
