'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import type { OnboardingTask } from '@/lib/types';

interface OnboardingChecklistProps {
  tasks: OnboardingTask[];
  completedTasks: number;
  totalTasks: number;
}

export function OnboardingChecklist({ tasks, completedTasks, totalTasks }: OnboardingChecklistProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Onboarding
        </h3>
        <span className="text-xs text-text-muted">
          {completedTasks}/{totalTasks} complete
        </span>
      </div>
      <div className="space-y-1.5">
        {tasks.map((task) => {
          const done = task.status === 'VALIDATED';
          return (
            <div
              key={task.taskId}
              className={`flex items-center justify-between px-3 py-2 border transition-colors ${
                done
                  ? 'border-green-500/10 bg-green-500/[0.03]'
                  : 'border-white/[0.04] bg-white/[0.01]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-text-muted flex-shrink-0" />
                )}
                <span className={`text-sm ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                  {task.title}
                </span>
              </div>
              <span className={`text-xs font-mono ${done ? 'text-green-400' : 'text-accent-primary'}`}>
                +{task.xpReward} XP
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
