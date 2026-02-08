'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { getAgentChallenge, verifyAgentSIWS, getMyAgent, setJWT, clearJWT, getJWT } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export function useAgentAuth() {
  const { publicKey, signMessage, connected, disconnecting } = useWallet();
  const { isAuthenticated, agent, setAuth, clearAuth } = useAuthStore();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasVerifiedRef = useRef(false);

  // Sign in via SIWS (guarded against double invocation)
  const signInGuardRef = useRef(false);
  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    if (signInGuardRef.current) return; // Prevent double sign-in from rapid clicks
    signInGuardRef.current = true;

    setIsSigningIn(true);
    setError(null);

    try {
      // 1. Get challenge nonce
      const { nonce, statement } = await getAgentChallenge();

      // 2. Build message and sign
      const message = `${statement}\n\nNonce: ${nonce}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encodedMessage);
      const signature = bs58.encode(signatureBytes);

      // 3. Verify with backend
      const result = await verifyAgentSIWS(publicKey.toBase58(), signature, nonce);

      if (!result.success) {
        throw new Error(result.error || 'Verification failed');
      }

      // 4. Store JWT
      setJWT(result.token);

      // 5. Fetch full profile
      const me = await getMyAgent();
      setAuth(me.agent, me.onboarding.tasks, me.onboarding.progress);
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
      console.error('SIWS sign in error:', err);
    } finally {
      setIsSigningIn(false);
      signInGuardRef.current = false;
    }
  }, [publicKey, signMessage, setAuth]);

  // On disconnect → clear auth
  useEffect(() => {
    if (disconnecting) {
      clearJWT();
      clearAuth();
      hasVerifiedRef.current = false;
    }
  }, [disconnecting, clearAuth]);

  // On mount with existing JWT → verify
  useEffect(() => {
    if (hasVerifiedRef.current) return;
    const token = getJWT();
    if (!token || !connected) return;

    hasVerifiedRef.current = true;

    getMyAgent()
      .then((me) => {
        setAuth(me.agent, me.onboarding.tasks, me.onboarding.progress);
      })
      .catch(() => {
        // Token expired or invalid
        clearJWT();
        clearAuth();
      });
  }, [connected, setAuth, clearAuth]);

  return {
    isAuthenticated,
    agent,
    isSigningIn,
    error,
    signIn,
    isWalletConnected: connected,
    publicKey,
  };
}
