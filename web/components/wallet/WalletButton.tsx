'use client';

import { useState, useRef, useEffect } from 'react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet, LogOut, User, ChevronDown, Loader2 } from 'lucide-react';
import { useAgentAuth } from '@/hooks/useAgentAuth';

export default function WalletButton() {
  const { setVisible } = useWalletModal();
  const { disconnect } = useWallet();
  const { isAuthenticated, agent, isSigningIn, signIn, isWalletConnected, publicKey } = useAgentAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // State 1: Not connected
  if (!isWalletConnected) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="flex items-center gap-2 px-4 py-2 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all text-sm font-medium"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </button>
    );
  }

  // State 2: Connected but not authenticated
  if (!isAuthenticated) {
    return (
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
        ) : (
          <>
            <User className="w-4 h-4" />
            Sign In
          </>
        )}
      </button>
    );
  }

  // State 3: Authenticated
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-all text-sm"
      >
        <span className="text-accent-primary font-mono text-xs">Lv.{agent?.level}</span>
        <span className="text-text-primary font-medium truncate max-w-[100px]">{agent?.name}</span>
        <span className="text-text-muted font-mono text-xs">{agent?.xp} XP</span>
        <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-bg-secondary border border-white/[0.08] shadow-xl z-50">
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <p className="text-xs text-text-muted truncate">
              {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
            </p>
          </div>
          <button
            onClick={() => {
              setDropdownOpen(false);
              disconnect();
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-white/[0.04] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
