/**
 * Onboarding Service
 *
 * Creates default onboarding tasks for new agents, manages XP awards,
 * and provides level calculation.
 *
 * Level Thresholds:
 *   0   → Recruit (1)
 *   100 → Scout (2)
 *   300 → Analyst (3)
 *   600 → Strategist (4)
 *   1000 → Commander (5)
 *   2000 → Legend (6)
 */

import { getSkillsByCategory, type SkillDefinition } from './skill-loader';
import { db } from '../lib/db';

const LEVEL_THRESHOLDS = [
  { level: 1, name: 'Recruit', minXP: 0 },
  { level: 2, name: 'Scout', minXP: 100 },
  { level: 3, name: 'Analyst', minXP: 300 },
  { level: 4, name: 'Strategist', minXP: 600 },
  { level: 5, name: 'Commander', minXP: 1000 },
  { level: 6, name: 'Legend', minXP: 2000 },
];

export function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].minXP) {
      return LEVEL_THRESHOLDS[i].level;
    }
  }
  return 1;
}

export function getLevelName(level: number): string {
  const entry = LEVEL_THRESHOLDS.find(t => t.level === level);
  return entry?.name || 'Recruit';
}

export function getXPForNextLevel(level: number): number {
  const next = LEVEL_THRESHOLDS.find(t => t.level === level + 1);
  return next?.minXP || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1].minXP;
}

/**
 * Create onboarding tasks for a newly registered agent.
 * Each onboarding skill becomes an AgentTask (tokenMint=null, no expiry)
 * with an auto-claimed AgentTaskCompletion(status=PENDING).
 */
export async function createOnboardingTasks(agentId: string): Promise<string[]> {
  const onboardingSkills = getSkillsByCategory('onboarding');
  if (onboardingSkills.length === 0) {
    console.warn('No onboarding skills loaded — skipping task creation');
    return [];
  }

  const taskIds: string[] = [];

  for (const skill of onboardingSkills) {
    try {
      const task = await db.agentTask.create({
        data: {
          tokenMint: null,
          tokenSymbol: null,
          taskType: skill.name,
          title: skill.title,
          description: skill.description,
          xpReward: skill.xpReward || 25,
          requiredFields: skill.requiredFields || [],
          status: 'OPEN',
          expiresAt: null, // Onboarding tasks don't expire
        },
      });

      // Auto-claim for this agent
      await db.agentTaskCompletion.create({
        data: {
          taskId: task.id,
          agentId,
          status: 'PENDING',
          proof: {},
        },
      });

      taskIds.push(task.id);
    } catch (error) {
      console.error(`Failed to create onboarding task ${skill.name}:`, error);
    }
  }

  console.log(`Created ${taskIds.length} onboarding tasks for agent ${agentId}`);
  return taskIds;
}

/**
 * Award XP to an agent and recalculate their level atomically.
 */
export async function awardXP(agentId: string, amount: number): Promise<{ xp: number; level: number }> {
  const agent = await db.tradingAgent.update({
    where: { id: agentId },
    data: {
      xp: { increment: amount },
    },
    select: { xp: true },
  });

  const newLevel = calculateLevel(agent.xp);

  // Update level if changed
  const updated = await db.tradingAgent.update({
    where: { id: agentId },
    data: { level: newLevel },
    select: { xp: true, level: true },
  });

  return { xp: updated.xp, level: updated.level };
}

/**
 * Get onboarding progress for an agent.
 */
export async function getOnboardingProgress(agentId: string) {
  // Find onboarding tasks claimed by this agent
  const completions = await db.agentTaskCompletion.findMany({
    where: { agentId },
    include: {
      task: true,
    },
  });

  // Filter to onboarding tasks only (tokenMint is null)
  const onboarding = completions.filter(c => c.task.tokenMint === null);

  const tasks = onboarding.map(c => ({
    taskId: c.taskId,
    taskType: c.task.taskType,
    title: c.task.title,
    description: c.task.description,
    xpReward: c.task.xpReward,
    status: c.status,
    xpAwarded: c.xpAwarded,
    completedAt: c.validatedAt,
  }));

  const completedCount = tasks.filter(t => t.status === 'VALIDATED').length;

  return {
    tasks,
    totalTasks: tasks.length,
    completedTasks: completedCount,
    progress: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
  };
}

/**
 * Auto-complete an onboarding task for an agent.
 * Finds the matching onboarding task type, validates, awards XP.
 * Fire-and-forget — errors are logged, not thrown.
 */
export async function autoCompleteOnboardingTask(
  agentId: string,
  taskType: string,
  proof: Record<string, any>,
): Promise<void> {
  try {
    // Find the agent's pending onboarding task of this type
    const completion = await db.agentTaskCompletion.findFirst({
      where: {
        agentId,
        status: 'PENDING',
        task: {
          taskType,
          tokenMint: null, // onboarding tasks only
        },
      },
      include: { task: true },
    });

    if (!completion) return; // No pending task of this type — skip

    const now = new Date();

    // Validate + award XP in transaction
    await db.$transaction([
      db.agentTaskCompletion.update({
        where: { id: completion.id },
        data: {
          status: 'VALIDATED',
          proof,
          xpAwarded: completion.task.xpReward,
          submittedAt: now,
          validatedAt: now,
        },
      }),
      db.agentTask.update({
        where: { id: completion.taskId },
        data: { status: 'COMPLETED' },
      }),
      db.tradingAgent.update({
        where: { id: agentId },
        data: {
          xp: { increment: completion.task.xpReward },
        },
      }),
    ]);

    // Recalculate level
    const agent = await db.tradingAgent.findUnique({ where: { id: agentId }, select: { xp: true } });
    if (agent) {
      const newLevel = calculateLevel(agent.xp);
      await db.tradingAgent.update({ where: { id: agentId }, data: { level: newLevel } });
    }

    console.log(`Auto-completed onboarding task ${taskType} for agent ${agentId} (+${completion.task.xpReward} XP)`);
  } catch (error) {
    console.error(`Failed to auto-complete onboarding task ${taskType} for ${agentId}:`, error);
  }
}
