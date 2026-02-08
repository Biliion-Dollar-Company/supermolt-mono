/**
 * Tasks Service
 *
 * Thin service layer for arena task queries (same pattern as arena.service.ts).
 */

import { db } from '../../lib/db';

export async function listTasks(options?: {
  tokenMint?: string;
  status?: string;
  limit?: number;
}) {
  const where: any = {};
  if (options?.tokenMint) where.tokenMint = options.tokenMint;
  if (options?.status) where.status = options.status;

  const tasks = await db.agentTask.findMany({
    where,
    include: {
      completions: {
        select: {
          agentId: true,
          status: true,
          xpAwarded: true,
          submittedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
  });

  // Resolve agent names for completions
  const agentIds = new Set<string>();
  for (const task of tasks) {
    for (const c of task.completions) {
      agentIds.add(c.agentId);
    }
  }

  const agents = await db.tradingAgent.findMany({
    where: { id: { in: Array.from(agentIds) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(agents.map(a => [a.id, a.name]));

  return tasks.map(task => ({
    taskId: task.id,
    tokenMint: task.tokenMint,
    tokenSymbol: task.tokenSymbol,
    taskType: task.taskType,
    title: task.title,
    xpReward: task.xpReward,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    completions: task.completions.map(c => ({
      agentId: c.agentId,
      agentName: nameMap.get(c.agentId) || c.agentId.substring(0, 12),
      status: c.status,
      xpAwarded: c.xpAwarded,
      submittedAt: c.submittedAt?.toISOString() || null,
    })),
  }));
}

export async function getTasksForToken(tokenMint: string) {
  return listTasks({ tokenMint });
}

export async function getAgentCompletions(agentId: string) {
  const completions = await db.agentTaskCompletion.findMany({
    where: { agentId },
    include: {
      task: {
        select: {
          id: true,
          taskType: true,
          title: true,
          tokenMint: true,
          tokenSymbol: true,
          xpReward: true,
        },
      },
    },
    orderBy: { claimedAt: 'desc' },
  });

  return completions.map(c => ({
    taskId: c.taskId,
    taskType: c.task.taskType,
    title: c.task.title,
    tokenMint: c.task.tokenMint,
    tokenSymbol: c.task.tokenSymbol,
    xpReward: c.task.xpReward,
    status: c.status,
    xpAwarded: c.xpAwarded,
    submittedAt: c.submittedAt?.toISOString() || null,
  }));
}

export async function getTaskDetail(taskId: string) {
  const task = await db.agentTask.findUnique({
    where: { id: taskId },
    include: { completions: true },
  });

  if (!task) return null;

  const agentIds = task.completions.map(c => c.agentId);
  const agents = await db.tradingAgent.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(agents.map(a => [a.id, a.name]));

  return {
    taskId: task.id,
    tokenMint: task.tokenMint,
    tokenSymbol: task.tokenSymbol,
    taskType: task.taskType,
    title: task.title,
    description: task.description,
    xpReward: task.xpReward,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    completions: task.completions.map(c => ({
      agentId: c.agentId,
      agentName: nameMap.get(c.agentId) || c.agentId.substring(0, 12),
      status: c.status,
      xpAwarded: c.xpAwarded,
      submittedAt: c.submittedAt?.toISOString() || null,
    })),
  };
}

export async function getTaskLeaderboard() {
  const completions = await db.agentTaskCompletion.groupBy({
    by: ['agentId'],
    where: { status: 'VALIDATED' },
    _sum: { xpAwarded: true },
    _count: { id: true },
    orderBy: { _sum: { xpAwarded: 'desc' } },
  });

  const agentIds = completions.map(c => c.agentId);
  const agents = await db.tradingAgent.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(agents.map(a => [a.id, a.name]));

  return completions.map(c => ({
    agentId: c.agentId,
    agentName: nameMap.get(c.agentId) || c.agentId.substring(0, 12),
    totalXP: c._sum.xpAwarded || 0,
    tasksCompleted: c._count.id,
  }));
}

export async function getTaskStats() {
  const [total, open, claimed, completed, expired] = await Promise.all([
    db.agentTask.count(),
    db.agentTask.count({ where: { status: 'OPEN' } }),
    db.agentTask.count({ where: { status: 'CLAIMED' } }),
    db.agentTask.count({ where: { status: 'COMPLETED' } }),
    db.agentTask.count({ where: { status: 'EXPIRED' } }),
  ]);

  const xpResult = await db.agentTaskCompletion.aggregate({
    where: { status: 'VALIDATED' },
    _sum: { xpAwarded: true },
  });

  return {
    total,
    active: open + claimed,
    completed,
    expired,
    totalXPAwarded: xpResult._sum.xpAwarded || 0,
  };
}
