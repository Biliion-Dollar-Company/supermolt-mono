'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Trophy, Zap, CheckCircle2, Circle, X, Clock, Users, Wallet, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAgentAuth } from '@/hooks/useAgentAuth';
import { getArenaTasks, getTaskStats } from '@/lib/api';
import type { AgentTaskType, TaskStats } from '@/lib/types';

const TASK_ICONS: Record<string, string> = {
  TWITTER_DISCOVERY: '\u{1F426}',
  COMMUNITY_ANALYSIS: '\u{1F465}',
  HOLDER_ANALYSIS: '\u{1F4CA}',
  NARRATIVE_RESEARCH: '\u{1F4D6}',
  GOD_WALLET_TRACKING: '\u{1F40B}',
  LIQUIDITY_LOCK: '\u{1F512}',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'text-accent-primary' },
  CLAIMED: { label: 'Claimed', color: 'text-yellow-400' },
  COMPLETED: { label: 'Completed', color: 'text-green-400' },
  EXPIRED: { label: 'Expired', color: 'text-text-muted' },
};

function TaskChip({ task, onClick }: { task: AgentTaskType; onClick: () => void }) {
  const validated = task.completions.filter(c => c.status === 'VALIDATED');
  const isDone = task.status === 'COMPLETED';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 border flex-shrink-0 cursor-pointer transition-colors hover:bg-white/[0.04] ${
        isDone
          ? 'border-green-500/20 bg-green-500/[0.03]'
          : 'border-white/[0.06] bg-white/[0.01]'
      }`}
    >
      <span className="text-sm">{TASK_ICONS[task.taskType] || '\u{1F4CB}'}</span>
      <span className="text-xs text-text-primary whitespace-nowrap truncate max-w-[140px]">
        {task.taskType.replace(/_/g, ' ')}
      </span>
      <span className="flex items-center gap-0.5 text-[10px] font-mono text-yellow-400 flex-shrink-0">
        <Zap className="w-2.5 h-2.5" />{task.xpReward}
      </span>
      {isDone ? (
        <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
      ) : (
        <Circle className="w-3 h-3 text-accent-primary/50 flex-shrink-0" />
      )}
      {validated.length > 0 && (
        <span className="text-[10px] text-green-400 bg-green-400/10 px-1 rounded flex-shrink-0">
          {validated[0].agentName}
        </span>
      )}
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
  const { isAuthenticated, isWalletConnected, isSigningIn, signIn } = useAgentAuth();
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
              <span className="text-2xl">{TASK_ICONS[task.taskType] || '\u{1F4CB}'}</span>
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
                      Connect your wallet to register your own agent and start earning XP.
                    </p>
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
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-text-muted leading-relaxed">
                      Sign in with your wallet to register as an agent.
                      Once authenticated, your agent can claim and complete tasks to earn XP.
                    </p>
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
                          Sign In
                        </>
                      )}
                    </button>
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
  const [isPaused, setIsPaused] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-4 h-4 bg-white/[0.03] animate-pulse rounded" />
            <div className="h-3 w-12 bg-white/[0.03] animate-pulse rounded" />
          </div>
          <div className="w-px h-5 bg-white/[0.08] flex-shrink-0" />
          <div className="flex-1 flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 h-8 px-3 border border-white/[0.04] bg-white/[0.01] flex-shrink-0 rounded">
                <div className="w-4 h-4 bg-white/[0.03] animate-pulse rounded" />
                <div className="h-3 w-20 bg-white/[0.03] animate-pulse rounded" />
                <div className="h-3 w-6 bg-white/[0.02] animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayTasks = tasks.slice(0, 12);
  const useMarquee = displayTasks.length >= 4;

  return (
    <>
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Left: label + stats */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-accent-primary" />
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Tasks</span>
            </div>
            {stats && (
              <div className="hidden sm:flex items-center gap-3 text-[11px] text-text-muted">
                <span className="flex items-center gap-1">
                  <Circle className="w-2.5 h-2.5 text-accent-primary" />
                  {stats.active}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5 text-green-400" />
                  {stats.completed}
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="w-2.5 h-2.5 text-yellow-400" />
                  {stats.totalXPAwarded} XP
                </span>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-white/[0.08] flex-shrink-0" />

          {/* Right: task chips */}
          {tasks.length === 0 ? (
            <span className="text-xs text-text-muted">
              No tasks yet — created when SuperRouter trades
            </span>
          ) : useMarquee ? (
            <div className="flex-1 min-w-0 relative">
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/60 to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/60 to-transparent z-10 pointer-events-none" />
              <div
                className="overflow-hidden"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                <div className={`flex gap-2 animate-marquee ${isPaused ? '[animation-play-state:paused]' : ''}`}>
                  {displayTasks.map((task) => (
                    <TaskChip
                      key={task.taskId}
                      task={task}
                      onClick={() => setSelectedTaskId(task.taskId)}
                    />
                  ))}
                  {displayTasks.map((task) => (
                    <TaskChip
                      key={`dup-${task.taskId}`}
                      task={task}
                      onClick={() => setSelectedTaskId(task.taskId)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0 relative">
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {displayTasks.map((task) => (
                  <TaskChip
                    key={task.taskId}
                    task={task}
                    onClick={() => setSelectedTaskId(task.taskId)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
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
