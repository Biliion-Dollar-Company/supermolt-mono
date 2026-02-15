"use client";

import { usePrivy } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearJWT, setJWT, tokenManager } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getMyAgent, loginWithPrivyToken, quickstartAgent } from '@/lib/api';

export function usePrivyAgentAuth() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { createWallet: createSolanaWallet } = useSolanaWallets();
  const { isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exchangeAttemptedRef = useRef(false);
  const exchangeRunningRef = useRef(false);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Exchange Privy auth token for our backend JWT + agent
  const runExchange = useCallback(async () => {
    if (exchangeRunningRef.current) return;
    exchangeRunningRef.current = true;
    setIsSigningIn(true);
    setError(null);

    try {
      const privyToken = await getAccessToken();
      if (!privyToken) {
        throw new Error('Could not get Privy access token');
      }

      console.log('[auth] Exchanging Privy token for backend JWT...');
      const loginResponse = await loginWithPrivyToken(privyToken);

      const currentUser = userRef.current;
      const twitterProfile = currentUser?.twitter;
      const quickstartPayload = twitterProfile?.username
        ? {
            twitterUsername: twitterProfile.username,
            displayName: twitterProfile.name || undefined,
            avatarUrl: twitterProfile.profilePictureUrl || undefined,
          }
        : undefined;

      console.log('[auth] Running quickstart...');
      const quickstart = await quickstartAgent(loginResponse.tokens.accessToken, quickstartPayload);

      setJWT(quickstart.token);
      tokenManager.setRefreshToken(quickstart.refreshToken);

      if (quickstart.agent && quickstart.onboarding) {
        setAuth(quickstart.agent, quickstart.onboarding.tasks, quickstart.onboarding.progress);
      } else {
        const me = await getMyAgent();
        setAuth(me.agent, me.onboarding.tasks, me.onboarding.progress);
      }
      console.log('[auth] Sign-in complete');

      // Ensure user has a Solana embedded wallet (for social login users)
      try {
        await createSolanaWallet();
        console.log('[auth] Solana embedded wallet created');
      } catch {
        // Expected if wallet already exists — ignore
      }
    } catch (err: any) {
      console.error('[auth] Exchange failed:', err?.message || err);
      setError(err?.message || 'Authentication failed');
    } finally {
      setIsSigningIn(false);
      exchangeRunningRef.current = false;
    }
  }, [getAccessToken, setAuth, createSolanaWallet]);

  const signIn = useCallback(async () => {
    setError(null);

    if (authenticated) {
      // Privy session exists but backend auth is missing — re-run exchange
      if (!isAuthenticated) {
        console.log('[auth] Privy authenticated but backend auth missing — re-exchanging');
        await runExchange();
      }
      return;
    }

    try {
      await login();
      // After login() resolves, Privy sets authenticated=true
      // The useEffect below will trigger the exchange
    } catch (err: any) {
      setError(err?.message || 'Sign in failed');
    }
  }, [login, authenticated, isAuthenticated, runExchange]);

  const signOut = useCallback(async () => {
    try {
      clearJWT();
      clearAuth();
      exchangeAttemptedRef.current = false;
      await logout();
    } catch (err: any) {
      setError(err?.message || 'Sign out failed');
    }
  }, [logout, clearAuth]);

  // Auto-exchange when Privy becomes authenticated
  useEffect(() => {
    if (!ready || !authenticated) {
      exchangeAttemptedRef.current = false;
      return;
    }

    if (isAuthenticated || exchangeAttemptedRef.current) {
      return;
    }

    exchangeAttemptedRef.current = true;
    runExchange().then(() => {
      // If exchange failed, allow retry on next click
      if (!useAuthStore.getState().isAuthenticated) {
        exchangeAttemptedRef.current = false;
      }
    });
  }, [ready, authenticated, isAuthenticated, runExchange]);

  return {
    ready,
    authenticated,
    user,
    isSigningIn,
    error,
    signIn,
    signOut,
  };
}
