"use client";

import { Loader2, User } from 'lucide-react';
import { usePrivyAgentAuth } from '@/hooks/usePrivyAgentAuth';

export default function PrivySignInButton({
  label = 'Sign In',
  className,
}: {
  label?: string;
  className?: string;
}) {
  const { isSigningIn, signIn } = usePrivyAgentAuth();

  return (
    <button
      onClick={signIn}
      disabled={isSigningIn}
      className={className || 'flex items-center justify-center gap-2 w-full px-4 py-2 bg-white/[0.04] border border-white/[0.08] text-text-primary hover:bg-white/[0.08] transition-all text-sm font-medium disabled:opacity-50 cursor-pointer'}
    >
      {isSigningIn ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          <User className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  );
}
