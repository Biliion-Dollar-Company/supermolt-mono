"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader2, LogOut, User } from 'lucide-react';
import { usePrivyAgentAuth } from '@/hooks/usePrivyAgentAuth';
import { useAuthStore } from '@/store/authStore';

function UserAuthButtonInner() {
  const { ready, authenticated, isSigningIn, signIn, signOut } = usePrivyAgentAuth();
  const { agent, isAuthenticated } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-all text-sm"
      >
        <span className="text-accent-primary font-mono text-xs">Lv.{agent.level}</span>
        <span className="text-text-primary font-medium truncate max-w-[100px]">{agent.name}</span>
        <span className="text-text-muted font-mono text-xs">{agent.xp} XP</span>
        <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-bg-secondary border border-white/[0.08] shadow-xl z-50">
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
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!privyAppId) return null;
  return <UserAuthButtonInner />;
}
