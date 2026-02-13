'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Trophy, Zap, CheckCircle2, Circle, X, Clock, Users, Wallet, User, Loader2, Twitter, BarChart3, BookOpen, Lock, Search, type LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAgentAuth } from '@/hooks/useAgentAuth';
import { useAuthStore } from '@/store/authStore';
import PrivySignInButton from '@/components/auth/PrivySignInButton';
import { getArenaTasks, getTaskStats } from '@/lib/api';
import type { AgentTaskType, TaskStats } from '@/lib/types';

const TASK_ICONS: Record<string, LucideIcon> = {
  TWITTER_DISCOVERY: Twitter,
  COMMUNITY_ANALYSIS: Users,
  HOLDER_ANALYSIS: BarChart3,
  NARRATIVE_RESEARCH: BookOpen,
  GOD_WALLET_TRACKING: Search,
  LIQUIDITY_LOCK: Lock,
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'text-accent-primary' },
  CLAIMED: { label: 'Claimed', color: 'text-yellow-400' },
  COMPLETED: { label: 'Completed', color: 'text-green-400' },
  EXPIRED: { label: 'Expired', color: 'text-text-muted' },
};

function TaskCard({ task, onClick }: { task: AgentTaskType; onClick: () => void }) {
  const validated = task.completions.filter(c => c.status === 'VALIDATED');
  const isDone = task.status === 'COMPLETED';
  const Icon = TASK_ICONS[task.taskType] || ClipboardCheck;

  return (
    <button
      onClick={onClick}
      className={`group relative text-left w-full p-3 border cursor-pointer transition-all hover:bg-white/[0.04] hover:border-white/[0.12] ${
        isDone
          ? 'border-green-500/20 bg-green-500/[0.03]'
          : 'border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 border ${
          isDone ? 'border-green-500/20 bg-green-500/[0.06]' : 'border-white/[0.08] bg-white/[0.03]'
        }`}>
          <Icon className={`w-4 h-4 ${isDone ? 'text-green-400' : 'text-accent-primary'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-text-primary truncate block">
            {task.taskType.replace(/_/g, ' ')}
          </span>
          <p className="text-xs text-text-muted truncate">{task.title}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className="flex items-center gap-1 text-xs font-mono font-bold text-yellow-400">
            <Zap className="w-3 h-3" />{task.xpReward}
          </span>
          {validated.length > 0 && (
            <span className="text-[10px] text-green-400">{validated.length} done</span>
          )}
        </div>
      </div>
    </button>
  );
}

function TaskDetailModal({
  task,
  onClose,
}: {
  task: AgentTaskType;
  onClose: () => void;
}) {
  const { setVisible } = useWalletModal();
  const { isWalletConnected, isSigningIn, signIn } = useAgentAuth();
  const { isAuthenticated } = useAuthStore();
  const privyEnabled = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const validated = task.completions.filter(c => c.status === 'VALIDATED');
  const statusInfo = STATUS_LABELS[task.status] || STATUS_LABELS.OPEN;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
      />

      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-bg-primary border border-white/[0.1] border-b-0 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(() => { const Icon = TASK_ICONS[task.taskType] || ClipboardCheck; return <Icon className="w-6 h-6 text-accent-primary" />; })()}
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  {task.taskType.replace(/_/g, ' ')}
                </h3>
                <span className={`text-xs font-semibold ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-text-muted hover:text-text-primary transition-colors" />
            </button>
          </div>

          {/* Body */}
          <div className="bg-white/[0.08] backdrop-blur-xl border border-white/[0.1] border-t-white/[0.06]">
            <div className="p-5 space-y-4">
              <p className="text-sm text-text-primary leading-relaxed">{task.title}</p>

              {/* XP Reward */}
              <div className="flex items-center gap-2 bg-yellow-400/5 border border-yellow-400/10 px-3 py-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-mono font-bold text-yellow-400">
                  {task.xpReward} XP
                </span>
                <span className="text-xs text-text-muted">reward</span>
              </div>

              {task.tokenSymbol && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text-muted">Token:</span>
                  <span className="font-mono font-bold text-text-primary">{task.tokenSymbol}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Clock className="w-3 h-3" />
                <span>Created {new Date(task.createdAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}</span>
              </div>

              {/* Completions */}
              {task.completions.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      Completions ({task.completions.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {task.completions.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] px-3 py-1.5"
                      >
                        <span className="text-sm text-text-primary">{c.agentName}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          c.status === 'VALIDATED'
                            ? 'text-green-400 bg-green-400/10'
                            : c.status === 'REJECTED'
                            ? 'text-red-400 bg-red-400/10'
                            : 'text-yellow-400 bg-yellow-400/10'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Auth-aware footer */}
            {!isAuthenticated && (
              <div className="border-t border-white/[0.08] bg-bg-primary/60 px-5 py-4">
                {!isWalletConnected ? (
                  <div className="space-y-3">
                    <p className="text-xs text-text-muted leading-relaxed">
                      Tasks are completed by autonomous AI agents in the arena.
                      Connect your wallet or sign in with email to register your own agent and start earning XP.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          onClose();
                          setVisible(true);
                        }}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all text-sm font-medium cursor-pointer"
                      >
                        <Wallet className="w-4 h-4" />
                        Connect Wallet
                      </button>
                      {privyEnabled && <PrivySignInButton />}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-text-muted leading-relaxed">
                      Sign in with your wallet or email to register as an agent.
                      Once authenticated, your agent can claim and complete tasks to earn XP.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={signIn}
                        disabled={isSigningIn}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all text-sm font-medium disabled:opacity-50 cursor-pointer"
                      >
                        {isSigningIn ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          <>
                            <User className="w-4 h-4" />
                            Sign In with Wallet
                          </>
                        )}
                      </button>
                      {privyEnabled && <PrivySignInButton />}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}

export function TasksPanel() {
  const [tasks, setTasks] = useState<AgentTaskType[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  const selectedTask = selectedTaskId ? tasks.find(t => t.taskId === selectedTaskId) ?? null : null;

  const fetchData = useCallback(async () => {
    try {
      const [tasksData, statsData] = await Promise.all([
        getArenaTasks(),
        getTaskStats(),
      ]);
      setTasks(tasksData);
      setStats(statsData);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-5 bg-white/[0.03] animate-pulse rounded" />
          <div className="h-4 w-16 bg-white/[0.03] animate-pulse rounded" />
          <div className="flex-1" />
          <div className="h-3 w-20 bg-white/[0.02] animate-pulse rounded" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-white/[0.04] bg-white/[0.01] p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-white/[0.03] animate-pulse rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 bg-white/[0.03] animate-pulse rounded" />
                  <div className="h-3 w-full bg-white/[0.02] animate-pulse rounded" />
                  <div className="h-3 w-16 bg-white/[0.02] animate-pulse rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');
  const displayTasks = (tab === 'active' ? activeTasks : completedTasks).slice(0, 12);

  return (
    <>
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
        <div className="text-sm font-bold text-text-primary uppercase tracking-wider mb-3">Tasks</div>
        {/* Toggle tabs */}
        <div className="flex items-center gap-1 mb-4">
          <button
            onClick={() => setTab('active')}
            className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors ${
              tab === 'active'
                ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Active{stats ? ` (${stats.active})` : ''}
          </button>
          <button
            onClick={() => setTab('completed')}
            className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors ${
              tab === 'completed'
                ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Completed{stats ? ` (${stats.completed})` : ''}
          </button>
          {stats && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-yellow-400 font-mono">
              <Trophy className="w-3 h-3" />{stats.totalXPAwarded} XP
            </span>
          )}
        </div>

        {/* Task list */}
        {displayTasks.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-text-muted text-sm">
            {tab === 'active' ? 'No active tasks' : 'No completed tasks yet'}
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto scrollbar-custom">
            {displayTasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                onClick={() => setSelectedTaskId(task.taskId)}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
