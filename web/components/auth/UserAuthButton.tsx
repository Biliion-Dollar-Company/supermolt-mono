"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Loader2, LogOut, User, Copy, Check, Key } from 'lucide-react';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { usePrivyAgentAuth } from '@/hooks/usePrivyAgentAuth';
import { useAuthStore } from '@/store/authStore';

function UserAuthButtonInner() {
  const { ready, authenticated, user, isSigningIn, error, signIn, signOut } = usePrivyAgentAuth();
  const { agent, isAuthenticated } = useAuthStore();
  const { connection } = useConnection();

  const rawAvatarUrl = agent?.avatarUrl || user?.twitter?.profilePictureUrl || null;
  const avatarUrl = rawAvatarUrl?.replace('_normal.', '_400x400.') ?? null;
  const displayName = agent?.twitterHandle
    ? (agent.twitterHandle.startsWith('@') ? agent.twitterHandle : `@${agent.twitterHandle}`)
    : agent?.name || user?.twitter?.username || 'Agent';
  const { wallets: solanaWallets, exportWallet } = useSolanaWallets();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayAddress = agent?.walletAddress || solanaWallets[0]?.address || null;
  const hasEmbeddedWallet = solanaWallets.length > 0;

  const copyAddress = useCallback(() => {
    if (!displayAddress) return;
    navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [displayAddress]);

  useEffect(() => {
    if (!displayAddress) {
      setSolBalance(null);
      return;
    }
    let cancelled = false;
    connection.getBalance(new PublicKey(displayAddress)).then((lamports) => {
      if (!cancelled) setSolBalance(lamports / LAMPORTS_PER_SOL);
    }).catch(() => {
      if (!cancelled) setSolBalance(null);
    });
    return () => { cancelled = true; };
  }, [connection, displayAddress]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!ready) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] text-text-muted text-sm"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading
      </button>
    );
  }

  if (!authenticated || !isAuthenticated || !agent) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={signIn}
          disabled={isSigningIn}
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all text-sm font-medium disabled:opacity-50"
        >
          {isSigningIn ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing...
            </>
          ) : error ? (
            <>
              <User className="w-4 h-4" />
              Retry
            </>
          ) : (
            <>
              <User className="w-4 h-4" />
              Sign In
            </>
          )}
        </button>
        {error && !isSigningIn && (
          <span className="text-[10px] text-red-400 max-w-[120px] truncate" title={error}>
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-all"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <User className="w-5 h-5 text-text-muted" />
        )}
        <span className="text-text-primary font-medium truncate max-w-[140px] text-base">{displayName}</span>
        <span className="text-accent-primary font-mono text-sm">Lv.{agent.level}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-bg-secondary border border-white/[0.08] shadow-xl z-50">
          {displayAddress && (
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Wallet</p>
              <button
                onClick={(e) => { e.stopPropagation(); copyAddress(); }}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors w-full"
                title={displayAddress}
              >
                <span className="font-mono truncate">
                  {displayAddress.slice(0, 4)}...{displayAddress.slice(-4)}
                </span>
                {copied ? (
                  <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 flex-shrink-0" />
                )}
              </button>
              <p className="text-xs font-mono text-accent-primary mt-1">
                {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '—'}
              </p>
            </div>
          )}
          {hasEmbeddedWallet && (
            <button
              onClick={() => {
                setDropdownOpen(false);
                exportWallet();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:bg-white/[0.04] transition-colors"
            >
              <Key className="w-4 h-4" />
              Export Wallet
            </button>
          )}
          <button
            onClick={() => {
              setDropdownOpen(false);
              signOut();
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-white/[0.04] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default function UserAuthButton() {
  // Privy is now the primary auth method
  return <UserAuthButtonInner />;
}
