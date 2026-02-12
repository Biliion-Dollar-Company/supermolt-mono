"use client";

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearJWT, setJWT, tokenManager } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getMyAgent, loginWithPrivyToken, quickstartAgent } from '@/lib/api';

export function usePrivyAgentAuth() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exchangeAttemptedRef = useRef(false);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await login();
    } catch (err: any) {
      setError(err?.message || 'Sign in failed');
    }
  }, [login]);

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

  useEffect(() => {
    if (!ready || !authenticated || !user) {
      exchangeAttemptedRef.current = false;
      return;
    }

    if (isAuthenticated || exchangeAttemptedRef.current) {
      return;
    }

    let cancelled = false;
    exchangeAttemptedRef.current = true;
    setIsSigningIn(true);

    async function exchange() {
      try {
        const privyToken = await getAccessToken();
        if (!privyToken || cancelled) return;

        const loginResponse = await loginWithPrivyToken(privyToken);
        if (cancelled) return;

        const quickstart = await quickstartAgent(loginResponse.tokens.accessToken);
        if (cancelled) return;

        setJWT(quickstart.token);
        tokenManager.setRefreshToken(quickstart.refreshToken);

        if (quickstart.agent && quickstart.onboarding) {
          setAuth(quickstart.agent, quickstart.onboarding.tasks, quickstart.onboarding.progress);
        } else {
          const me = await getMyAgent();
          if (cancelled) return;
          setAuth(me.agent, me.onboarding.tasks, me.onboarding.progress);
        }
      } catch (err: any) {
        exchangeAttemptedRef.current = false;
        setError(err?.message || 'Authentication failed');
      } finally {
        if (!cancelled) {
          setIsSigningIn(false);
        }
      }
    }

    exchange();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user, isAuthenticated, getAccessToken, setAuth]);

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
