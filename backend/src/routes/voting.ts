/**
 * Voting Routes
 * POST /voting/propose - Create vote proposal
 * POST /voting/:id/cast - Cast vote
 * GET /voting/:id - Get vote results
 * GET /voting/active - List active votes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db';

const voting = new Hono();

// Request schemas
const proposeVoteSchema = z.object({
  proposerId: z.string(),
  action: z.enum(['BUY', 'SELL']),
  token: z.string(),
  tokenMint: z.string().optional(),
  amount: z.number().positive(),
  reason: z.string().min(1).max(1000),
  expiresInHours: z.number().positive().max(168).default(24), // Max 1 week
});

const castVoteSchema = z.object({
  agentId: z.string(),
  vote: z.enum(['YES', 'NO']),
});

/**
 * POST /voting/propose
 * Create a vote proposal
 */
voting.post('/propose', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = proposeVoteSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
        },
        400
      );
    }

    const { proposerId, action, token, tokenMint, amount, reason, expiresInHours } = parsed.data;

    // Verify proposer exists
    const proposer = await db.tradingAgent.findUnique({
      where: { id: proposerId },
    });

    if (!proposer) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Proposer agent not found' },
        },
        404
      );
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Create proposal
    const proposal = await db.voteProposal.create({
      data: {
        proposerId,
        action,
        token,
        tokenMint,
        amount,
        reason,
        expiresAt,
        status: 'ACTIVE',
      },
    });

    return c.json({
      success: true,
      data: {
        proposalId: proposal.id,
        proposerId: proposal.proposerId,
        proposerName: proposer.name,
        action: proposal.action,
        token: proposal.token,
        tokenMint: proposal.tokenMint,
        amount: parseFloat(proposal.amount.toString()),
        reason: proposal.reason,
        createdAt: proposal.createdAt,
        expiresAt: proposal.expiresAt,
        status: proposal.status,
      },
    });
  } catch (error) {
    console.error('Create proposal error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create proposal' },
      },
      500
    );
  }
});

/**
 * POST /voting/:id/cast
 * Cast a vote on a proposal
 */
voting.post('/:id/cast', async (c) => {
  try {
    const proposalId = c.req.param('id');
    const body = await c.req.json();
    const parsed = castVoteSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
        },
        400
      );
    }

    const { agentId, vote } = parsed.data;

    // Verify proposal exists and is active
    const proposal = await db.voteProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Proposal not found' },
        },
        404
      );
    }

    if (proposal.status !== 'ACTIVE') {
      return c.json(
        {
          success: false,
          error: { code: 'INVALID_STATE', message: 'Proposal is not active' },
        },
        400
      );
    }

    if (new Date() > proposal.expiresAt) {
      // Proposal expired - update status
      await db.voteProposal.update({
        where: { id: proposalId },
        data: { status: 'FAILED' },
      });

      return c.json(
        {
          success: false,
          error: { code: 'EXPIRED', message: 'Proposal has expired' },
        },
        400
      );
    }

    // Verify agent exists
    const agent = await db.tradingAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Agent not found' },
        },
        404
      );
    }

    // Check if agent already voted
    const existingVote = await db.vote.findUnique({
      where: {
        proposalId_agentId: {
          proposalId,
          agentId,
        },
      },
    });

    if (existingVote) {
      return c.json(
        {
          success: false,
          error: { code: 'ALREADY_VOTED', message: 'Agent has already voted on this proposal' },
        },
        400
      );
    }

    // Cast vote
    const newVote = await db.vote.create({
      data: {
        proposalId,
        agentId,
        vote,
      },
    });

    return c.json({
      success: true,
      data: {
        voteId: newVote.id,
        proposalId: newVote.proposalId,
        agentId: newVote.agentId,
        agentName: agent.name,
        vote: newVote.vote,
        timestamp: newVote.timestamp,
      },
    });
  } catch (error) {
    console.error('Cast vote error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to cast vote' },
      },
      500
    );
  }
});

/**
 * GET /voting/:id
 * Get vote results
 */
voting.get('/:id', async (c) => {
  try {
    const proposalId = c.req.param('id');

    const proposal = await db.voteProposal.findUnique({
      where: { id: proposalId },
      include: {
        votes: true,
      },
    });

    if (!proposal) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Proposal not found' },
        },
        404
      );
    }

    // Get proposer details
    const proposer = await db.tradingAgent.findUnique({
      where: { id: proposal.proposerId },
    });

    // Calculate vote counts
    const yesVotes = proposal.votes.filter((v) => v.vote === 'YES').length;
    const noVotes = proposal.votes.filter((v) => v.vote === 'NO').length;
    const totalVotes = proposal.votes.length;

    // Get voter details
    const voterIds = proposal.votes.map((v) => v.agentId);
    const voters = await db.tradingAgent.findMany({
      where: { id: { in: voterIds } },
    });

    const voterMap = new Map(voters.map((v) => [v.id, v]));

    // Check if expired and update status
    let currentStatus = proposal.status;
    if (currentStatus === 'ACTIVE' && new Date() > proposal.expiresAt) {
      currentStatus = yesVotes > noVotes ? 'PASSED' : 'FAILED';
      await db.voteProposal.update({
        where: { id: proposalId },
        data: { status: currentStatus },
      });
    }

    return c.json({
      success: true,
      data: {
        proposalId: proposal.id,
        proposerId: proposal.proposerId,
        proposerName: proposer?.name || 'Unknown',
        action: proposal.action,
        token: proposal.token,
        tokenMint: proposal.tokenMint,
        amount: parseFloat(proposal.amount.toString()),
        reason: proposal.reason,
        createdAt: proposal.createdAt,
        expiresAt: proposal.expiresAt,
        status: currentStatus,
        votes: {
          yes: yesVotes,
          no: noVotes,
          total: totalVotes,
        },
        voters: proposal.votes.map((v) => {
          const voter = voterMap.get(v.agentId);
          return {
            agentId: v.agentId,
            agentName: voter?.name || 'Unknown',
            vote: v.vote,
            timestamp: v.timestamp,
          };
        }),
      },
    });
  } catch (error) {
    console.error('Get vote results error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch vote results' },
      },
      500
    );
  }
});

/**
 * GET /voting/active
 * List active votes
 */
voting.get('/active', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const proposals = await db.voteProposal.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        votes: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.voteProposal.count({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    // Get proposer details
    const proposerIds = [...new Set(proposals.map((p) => p.proposerId))];
    const proposers = await db.tradingAgent.findMany({
      where: { id: { in: proposerIds } },
    });

    const proposerMap = new Map(proposers.map((p) => [p.id, p]));

    return c.json({
      success: true,
      data: {
        proposals: proposals.map((p) => {
          const proposer = proposerMap.get(p.proposerId);
          const yesVotes = p.votes.filter((v) => v.vote === 'YES').length;
          const noVotes = p.votes.filter((v) => v.vote === 'NO').length;

          return {
            proposalId: p.id,
            proposerId: p.proposerId,
            proposerName: proposer?.name || 'Unknown',
            action: p.action,
            token: p.token,
            tokenMint: p.tokenMint,
            amount: parseFloat(p.amount.toString()),
            reason: p.reason,
            createdAt: p.createdAt,
            expiresAt: p.expiresAt,
            votes: {
              yes: yesVotes,
              no: noVotes,
              total: p.votes.length,
            },
          };
        }),
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Get active votes error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch active votes' },
      },
      500
    );
  }
});

export { voting };
