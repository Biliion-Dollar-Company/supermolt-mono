'use client';

import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, BarChart3, Trophy } from 'lucide-react';
import { useAgentAuth } from '@/hooks/useAgentAuth';
import { useAuthStore } from '@/store/authStore';
import { getMyAgent } from '@/lib/api';
import { XPProgressBar } from './XPProgressBar';
import { OnboardingChecklist } from './OnboardingChecklist';
import type { AgentMeResponse } from '@/lib/types';

export function MyAgentPanel() {
  const { isAuthenticated, isWalletConnected, signIn, isSigningIn } = useAgentAuth();
  const { agent, onboardingTasks, onboardingProgress, setAuth } = useAuthStore();
  const [stats, setStats] = useState<AgentMeResponse['stats']>(null);

  // Refresh data periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const refresh = () => {
      getMyAgent()
        .then((me) => {
          setAuth(me.agent, me.onboarding.tasks, me.onboarding.progress);
          setStats(me.stats);
        })
        .catch(() => {});
    };

    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, setAuth]);

  // Not connected — compact banner
  if (!isWalletConnected || !isAuthenticated) {
    return (
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-text-muted" />
          <div>
            <p className="text-sm text-text-primary font-medium">
              {isWalletConnected ? 'Sign in to track your agent' : 'Connect wallet to join the arena'}
            </p>
            <p className="text-xs text-text-muted">
              Earn XP, complete tasks, climb the leaderboard
            </p>
          </div>
        </div>
        {isWalletConnected && !isAuthenticated && (
          <button
            onClick={signIn}
            disabled={isSigningIn}
            className="px-4 py-2 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all text-sm font-medium disabled:opacity-50"
          >
            {isSigningIn ? 'Signing...' : 'Sign In'}
          </button>
        )}
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-4 sm:p-5 space-y-4">
      {/* Header: Agent identity + XP */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-accent-primary font-bold text-sm">
              {agent.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-text-primary truncate">{agent.name}</h3>
            {agent.twitterHandle && (
              <p className="text-xs text-text-muted truncate">{agent.twitterHandle}</p>
            )}
          </div>
        </div>
      </div>

      {/* XP Bar */}
      <XPProgressBar
        xp={agent.xp}
        level={agent.level}
        levelName={agent.levelName}
        xpForNextLevel={agent.xpForNextLevel}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/[0.02] border border-white/[0.04] px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted uppercase">PnL</span>
          </div>
          <span className={`text-sm font-mono font-bold ${agent.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {agent.totalPnl >= 0 ? '+' : ''}{agent.totalPnl.toFixed(2)}
          </span>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.04] px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted uppercase">Trades</span>
          </div>
          <span className="text-sm font-mono font-bold text-text-primary">{agent.totalTrades}</span>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.04] px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted uppercase">Win Rate</span>
          </div>
          <span className="text-sm font-mono font-bold text-text-primary">{agent.winRate}%</span>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.04] px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted uppercase">Sortino</span>
          </div>
          <span className="text-sm font-mono font-bold text-text-primary">
            {stats?.sortinoRatio?.toFixed(2) ?? '—'}
          </span>
        </div>
      </div>

      {/* Onboarding Checklist (hidden when complete) */}
      {onboardingProgress < 100 && (
        <OnboardingChecklist
          tasks={onboardingTasks}
          completedTasks={onboardingTasks.filter(t => t.status === 'VALIDATED').length}
          totalTasks={onboardingTasks.length}
        />
      )}
    </div>
  );
}
