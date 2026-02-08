'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Trophy, Zap, CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { getArenaTasks, getTaskStats } from '@/lib/api';
import type { AgentTaskType, TaskStats } from '@/lib/types';

const TASK_ICONS: Record<string, string> = {
  TWITTER_DISCOVERY: '🐦',
  COMMUNITY_ANALYSIS: '👥',
  HOLDER_ANALYSIS: '📊',
  NARRATIVE_RESEARCH: '📖',
  GOD_WALLET_TRACKING: '🐋',
  LIQUIDITY_LOCK: '🔒',
};

function TaskChip({ task }: { task: AgentTaskType }) {
  const validated = task.completions.filter(c => c.status === 'VALIDATED');
  const isDone = task.status === 'COMPLETED';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border flex-shrink-0 ${
      isDone
        ? 'border-green-500/20 bg-green-500/[0.03]'
        : 'border-white/[0.06] bg-white/[0.01]'
    }`}>
      <span className="text-sm">{TASK_ICONS[task.taskType] || '📋'}</span>
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
    </div>
  );
}

export function TasksPanel() {
  const [tasks, setTasks] = useState<AgentTaskType[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-24 bg-white/[0.04] animate-pulse rounded" />
          <div className="flex-1 flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-40 bg-white/[0.02] animate-pulse rounded flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] px-4 py-3">
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

        {/* Right: scrollable task chips */}
        {tasks.length === 0 ? (
          <span className="text-xs text-text-muted">
            No tasks yet — created when SuperRouter trades
          </span>
        ) : (
          <div className="flex-1 min-w-0 relative">
            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-black/60 to-transparent z-10 pointer-events-none" />
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {tasks.slice(0, 12).map((task) => (
                <TaskChip key={task.taskId} task={task} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
