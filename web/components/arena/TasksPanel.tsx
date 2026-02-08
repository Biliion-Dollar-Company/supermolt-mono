'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Trophy, Zap, Clock, CheckCircle2, Circle } from 'lucide-react';
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

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
          <CheckCircle2 className="w-3 h-3" />
          Done
        </span>
      );
    case 'CLAIMED':
      return (
        <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
          <Clock className="w-3 h-3" />
          Claimed
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="flex items-center gap-1 text-xs text-text-muted bg-white/[0.04] px-1.5 py-0.5 rounded">
          Expired
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 rounded">
          <Circle className="w-3 h-3" />
          Open
        </span>
      );
  }
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
      <div className="border border-white/[0.06] bg-bg-secondary p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck className="w-4 h-4 text-accent-primary" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Agent Tasks
          </h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.02] animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/[0.06] bg-bg-secondary p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-accent-primary" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Agent Tasks
          </h2>
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="flex items-center gap-4 mb-4 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Circle className="w-3 h-3 text-accent-primary" />
            {stats.active} active
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            {stats.completed} done
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-yellow-400" />
            {stats.totalXPAwarded} XP
          </span>
        </div>
      )}

      {/* Task List */}
      {tasks.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-6">
          No tasks yet — tasks are created when SuperRouter trades
        </p>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {tasks.slice(0, 20).map((task) => (
            <div
              key={task.taskId}
              className="flex items-center gap-3 px-3 py-2.5 border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
            >
              {/* Icon */}
              <span className="text-base flex-shrink-0">
                {TASK_ICONS[task.taskType] || '📋'}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-primary truncate">
                    {task.title}
                  </span>
                </div>
                {task.completions.length > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {task.completions
                      .filter(c => c.status === 'VALIDATED')
                      .slice(0, 3)
                      .map((c) => (
                        <span
                          key={c.agentId}
                          className="text-[10px] text-green-400 bg-green-400/10 px-1 rounded"
                        >
                          {c.agentName}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* XP + Status */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="flex items-center gap-0.5 text-xs font-mono text-yellow-400">
                  <Zap className="w-3 h-3" />
                  {task.xpReward}
                </span>
                <StatusBadge status={task.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
