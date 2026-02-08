/**
 * Agent Task Manager Service
 *
 * Creates competitive tasks for agents when tokens are detected.
 * Stores tasks locally in Prisma (replaces external Ponzinomics API).
 *
 * Flow:
 * 1. Token detected -> createTasksForToken()
 * 2. Tasks created in local DB -> agents compete
 * 3. Agent claims task -> claimTask()
 * 4. Agent submits proof -> submitProof() validates + awards XP
 */

import { loadSkills, getSkillsByCategory, type SkillDefinition } from './skill-loader';
import { calculateLevel, autoCompleteOnboardingTask } from './onboarding.service';
import { db } from '../lib/db';

export class AgentTaskManager {
  /**
   * Create 6 task records for a new token from loaded skills.
   * Called when SuperRouter trades a token.
   */
  async createTasksForToken(
    tokenMint: string,
    tokenSymbol?: string,
    conversationId?: string,
  ): Promise<{ taskIds: string[]; totalXP: number }> {
    const taskSkills = getSkillsByCategory('tasks');
    const taskIds: string[] = [];
    let totalXP = 0;

    console.log(`\n🎯 Creating tasks for token: ${tokenSymbol || tokenMint.substring(0, 8)}`);

    for (const skill of taskSkills) {
      try {
        const task = await db.agentTask.create({
          data: {
            tokenMint,
            tokenSymbol: tokenSymbol || null,
            taskType: skill.name,
            title: `${skill.title}: ${tokenSymbol || tokenMint.substring(0, 8)}`,
            description: skill.description,
            xpReward: skill.xpReward || 50,
            requiredFields: skill.requiredFields || [],
            conversationId: conversationId || null,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
          },
        });

        taskIds.push(task.id);
        totalXP += skill.xpReward || 50;
        console.log(`   ✅ ${skill.name} (${skill.xpReward} XP) → ID: ${task.id}`);
      } catch (error) {
        console.error(`❌ Error creating task ${skill.name}:`, error);
      }
    }

    console.log(`\n📊 Total: ${taskIds.length} tasks created (${totalXP} XP available)\n`);
    return { taskIds, totalXP };
  }

  /**
   * Claim a task for an agent. Creates an AgentTaskCompletion with PENDING status.
   */
  async claimTask(taskId: string, agentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const task = await db.agentTask.findUnique({ where: { id: taskId } });
      if (!task) return { success: false, error: 'Task not found' };
      if (task.status === 'COMPLETED') return { success: false, error: 'Task already completed' };
      if (task.status === 'EXPIRED') return { success: false, error: 'Task expired' };

      // Check if already claimed by this agent
      const existing = await db.agentTaskCompletion.findUnique({
        where: { taskId_agentId: { taskId, agentId } },
      });
      if (existing) return { success: false, error: 'Already claimed by this agent' };

      await db.agentTaskCompletion.create({
        data: {
          taskId,
          agentId,
          status: 'PENDING',
          proof: {},
        },
      });

      // Update task status to CLAIMED if first claim
      if (task.status === 'OPEN') {
        await db.agentTask.update({
          where: { id: taskId },
          data: { status: 'CLAIMED' },
        });
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Submit proof for a task. Validates against requiredFields, then awards XP.
   */
  async submitProof(
    taskId: string,
    agentId: string,
    proof: Record<string, any>,
  ): Promise<{ valid: boolean; xpAwarded?: number; error?: string }> {
    try {
      const task = await db.agentTask.findUnique({
        where: { id: taskId },
        include: { completions: true },
      });
      if (!task) return { valid: false, error: 'Task not found' };

      // Ensure completion record exists (auto-claim if needed)
      let completion = await db.agentTaskCompletion.findUnique({
        where: { taskId_agentId: { taskId, agentId } },
      });
      if (!completion) {
        completion = await db.agentTaskCompletion.create({
          data: { taskId, agentId, status: 'PENDING', proof: {} },
        });
      }

      if (completion.status === 'VALIDATED') {
        return { valid: false, error: 'Already validated' };
      }

      // Validate required fields
      for (const field of task.requiredFields) {
        if (!(field in proof)) {
          await db.agentTaskCompletion.update({
            where: { id: completion.id },
            data: { status: 'REJECTED', validationError: `Missing required field: ${field}`, proof },
          });
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }

      // Type-specific validation
      const validation = this.validateByType(task.taskType, proof);
      if (!validation.valid) {
        await db.agentTaskCompletion.update({
          where: { id: completion.id },
          data: { status: 'REJECTED', validationError: validation.error, proof },
        });
        return { valid: false, error: validation.error };
      }

      // Validation passed — award XP atomically
      const now = new Date();
      await db.$transaction([
        db.agentTaskCompletion.update({
          where: { id: completion.id },
          data: {
            status: 'VALIDATED',
            proof,
            xpAwarded: task.xpReward,
            submittedAt: now,
            validatedAt: now,
          },
        }),
        db.agentTask.update({
          where: { id: taskId },
          data: { status: 'COMPLETED' },
        }),
        db.tradingAgent.update({
          where: { id: agentId },
          data: {
            xp: { increment: task.xpReward },
          },
        }),
      ]);

      // Recalculate level outside transaction
      const agent = await db.tradingAgent.findUnique({ where: { id: agentId }, select: { xp: true } });
      if (agent) {
        const newLevel = calculateLevel(agent.xp);
        await db.tradingAgent.update({ where: { id: agentId }, data: { level: newLevel } });
      }

      // Auto-complete COMPLETE_RESEARCH onboarding task when a real (non-onboarding) task is validated
      if (task.tokenMint !== null) {
        autoCompleteOnboardingTask(agentId, 'COMPLETE_RESEARCH', {
          taskId,
          taskType: task.taskType,
          tokenMint: task.tokenMint,
        }).catch(() => {});
      }

      return { valid: true, xpAwarded: task.xpReward };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get all tasks for a token.
   */
  async getTasksForToken(tokenMint: string) {
    return db.agentTask.findMany({
      where: { tokenMint },
      include: { completions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all completions for an agent.
   */
  async getAgentTasks(agentId: string) {
    return db.agentTaskCompletion.findMany({
      where: { agentId },
      include: { task: true },
      orderBy: { claimedAt: 'desc' },
    });
  }

  /**
   * Get task leaderboard: XP rankings by agent.
   */
  async getTaskLeaderboard() {
    const completions = await db.agentTaskCompletion.groupBy({
      by: ['agentId'],
      where: { status: 'VALIDATED' },
      _sum: { xpAwarded: true },
      _count: { id: true },
      orderBy: { _sum: { xpAwarded: 'desc' } },
    });

    // Resolve agent names
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

  /**
   * Get a single task with completions.
   */
  async getTask(taskId: string) {
    return db.agentTask.findUnique({
      where: { id: taskId },
      include: { completions: true },
    });
  }

  /**
   * List tasks with optional filters.
   */
  async listTasks(options?: {
    tokenMint?: string;
    status?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (options?.tokenMint) where.tokenMint = options.tokenMint;
    if (options?.status) where.status = options.status;

    return db.agentTask.findMany({
      where,
      include: { completions: true },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
    });
  }

  /**
   * Type-specific validation logic (preserved from original).
   */
  private validateByType(taskType: string, proof: any): { valid: boolean; error?: string } {
    switch (taskType) {
      case 'TWITTER_DISCOVERY':
        return this.validateTwitterDiscovery(proof);
      case 'COMMUNITY_ANALYSIS':
        return this.validateCommunityAnalysis(proof);
      case 'HOLDER_ANALYSIS':
        return this.validateHolderAnalysis(proof);
      case 'NARRATIVE_RESEARCH':
        return this.validateNarrativeResearch(proof);
      case 'GOD_WALLET_TRACKING':
        return this.validateGodWalletTracking(proof);
      case 'LIQUIDITY_LOCK':
        return this.validateLiquidityLock(proof);
      default:
        return { valid: true };
    }
  }

  private validateTwitterDiscovery(proof: any): { valid: boolean; error?: string } {
    if (!proof.handle || typeof proof.handle !== 'string' || !proof.handle.startsWith('@')) {
      return { valid: false, error: 'Handle must be a string starting with @' };
    }
    if (!proof.url || typeof proof.url !== 'string') {
      return { valid: false, error: 'URL must be a string' };
    }
    if (!proof.url.includes('x.com') && !proof.url.includes('twitter.com')) {
      return { valid: false, error: 'URL must be a Twitter/X link' };
    }
    if (typeof proof.followers !== 'number' || proof.followers < 0) {
      return { valid: false, error: 'Followers must be a non-negative number' };
    }
    if (typeof proof.verified !== 'boolean') {
      return { valid: false, error: 'Verified must be a boolean' };
    }
    return { valid: true };
  }

  private validateCommunityAnalysis(proof: any): { valid: boolean; error?: string } {
    if (typeof proof.mentions24h !== 'number' || proof.mentions24h < 0) {
      return { valid: false, error: 'mentions24h must be a non-negative number' };
    }
    const sentiment = proof.sentiment;
    if (!sentiment || typeof sentiment !== 'object') {
      return { valid: false, error: 'sentiment must be an object' };
    }
    const total = (sentiment.bullish || 0) + (sentiment.neutral || 0) + (sentiment.bearish || 0);
    if (Math.abs(total - 100) > 1) {
      return { valid: false, error: 'Sentiment percentages must add up to 100' };
    }
    if (!Array.isArray(proof.topTweets)) {
      return { valid: false, error: 'topTweets must be an array' };
    }
    return { valid: true };
  }

  private validateHolderAnalysis(proof: any): { valid: boolean; error?: string } {
    if (!Array.isArray(proof.topHolders)) {
      return { valid: false, error: 'topHolders must be an array' };
    }
    if (proof.topHolders.length < 5) {
      return { valid: false, error: 'Must provide at least 5 top holders' };
    }
    for (const holder of proof.topHolders) {
      if (!holder.address || typeof holder.address !== 'string') {
        return { valid: false, error: 'Each holder must have an address (string)' };
      }
      if (holder.address.length < 32 || holder.address.length > 44) {
        return { valid: false, error: 'Invalid Solana address format (length)' };
      }
      if (typeof holder.percentage !== 'number' || holder.percentage < 0 || holder.percentage > 100) {
        return { valid: false, error: 'Each holder percentage must be 0-100' };
      }
    }
    if (!proof.concentration) {
      return { valid: false, error: 'concentration field required' };
    }
    return { valid: true };
  }

  private validateNarrativeResearch(proof: any): { valid: boolean; error?: string } {
    if (!proof.purpose || typeof proof.purpose !== 'string' || proof.purpose.length < 10) {
      return { valid: false, error: 'purpose must be at least 10 characters' };
    }
    if (!proof.narrative || typeof proof.narrative !== 'string' || proof.narrative.length < 10) {
      return { valid: false, error: 'narrative must be at least 10 characters' };
    }
    if (!proof.launchDate) {
      return { valid: false, error: 'launchDate required' };
    }
    if (!Array.isArray(proof.sources)) {
      return { valid: false, error: 'sources must be an array' };
    }
    return { valid: true };
  }

  private validateGodWalletTracking(proof: any): { valid: boolean; error?: string } {
    if (!Array.isArray(proof.godWalletsHolding)) {
      return { valid: false, error: 'godWalletsHolding must be an array' };
    }
    if (!proof.aggregateSignal) {
      return { valid: false, error: 'aggregateSignal required' };
    }
    if (proof.godWalletsHolding.length > 0) {
      for (const wallet of proof.godWalletsHolding) {
        if (!wallet.address || typeof wallet.address !== 'string') {
          return { valid: false, error: 'Each god wallet must have address' };
        }
      }
    }
    return { valid: true };
  }

  private validateLiquidityLock(proof: any): { valid: boolean; error?: string } {
    if (typeof proof.isLocked !== 'boolean') {
      return { valid: false, error: 'isLocked must be a boolean' };
    }
    if (!proof.riskAssessment) {
      return { valid: false, error: 'riskAssessment required' };
    }
    return { valid: true };
  }
}
