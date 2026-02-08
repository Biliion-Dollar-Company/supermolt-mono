/**
 * Agent Authentication & Social Linking Routes
 *
 * Allows agents to:
 * - Link their Twitter account (tweet-based verification)
 * - Verify task completion (post proof links)
 * - Update their profile with social handles
 *
 * All write endpoints require agent JWT (from SIWS auth).
 * agentId is extracted from the token — agents can only modify their own data.
 *
 * Flow:
 * 1. Agent authenticates via SIWS → gets JWT with agentId
 * 2. POST /agent-auth/twitter/request → gets verification code + tweet template
 * 3. Agent posts the tweet via Twitter API
 * 4. POST /agent-auth/twitter/verify → submits tweet URL
 * 5. Backend verifies tweet exists + contains code → links Twitter handle
 */

import { Hono } from 'hono';
import { Context, Next } from 'hono';
import * as jose from 'jose';
import crypto from 'crypto';
import { autoCompleteOnboardingTask } from '../services/onboarding.service';
import { db as prisma } from '../lib/db';

const agentAuth = new Hono();

// Agent JWT middleware — extracts agentId from SIWS token
async function agentJwtMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Authorization required. Use Bearer token from /auth/agent/verify' }, 401);
  }

  const token = authHeader.slice(7);
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(token, secret);

    if (payload.type !== 'agent') {
      return c.json({ success: false, error: 'Invalid token type. Use agent token from SIWS auth.' }, 401);
    }

    c.set('agentId', payload.agentId as string);
    c.set('agentPubkey', payload.sub as string);
    await next();
  } catch (error) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
}

// Extend Hono context for agent JWT fields
declare module 'hono' {
  interface ContextVariableMap {
    agentId: string;
    agentPubkey: string;
  }
}

// Store pending verifications (in-memory, could use Redis)
const pendingVerifications = new Map<string, {
  agentId: string;
  code: string;
  expiresAt: number;
}>();

// ============================================================================
// Twitter Authentication (JWT required)
// ============================================================================

/**
 * POST /agent-auth/twitter/request
 * Generate verification code for Twitter linking
 *
 * Headers: Authorization: Bearer <agent-jwt>
 * Returns: { code: "TRENCH_VERIFY_ABC123", tweetTemplate: "...", expiresAt: timestamp }
 */
agentAuth.post('/twitter/request', agentJwtMiddleware, async (c) => {
  try {
    const agentId = c.get('agentId');

    // Check agent exists
    const agent = await prisma.tradingAgent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }

    // Check if already verified
    const config = agent.config as Record<string, unknown> | null;
    if (config?.twitterVerified && agent.twitterHandle) {
      return c.json({
        success: false,
        error: `Twitter already linked as ${agent.twitterHandle}. Unlink first to re-verify.`
      }, 400);
    }

    // Generate verification code
    const code = `TRENCH_VERIFY_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

    // Store pending verification
    pendingVerifications.set(agentId, { agentId, code, expiresAt });

    const verificationTweet = `I'm verifying my agent identity on @TrenchProtocol\n\nVerification code: ${code}\n\nAgent ID: ${agentId}\n#TrenchAgent`;

    return c.json({
      success: true,
      data: {
        code,
        expiresAt,
        tweetTemplate: verificationTweet,
        instructions: [
          '1. Post the tweetTemplate text on Twitter/X (via API or manually)',
          '2. Get the tweet URL (format: https://x.com/yourhandle/status/123456)',
          '3. POST /agent-auth/twitter/verify with { tweetUrl: "..." }'
        ]
      }
    });

  } catch (error: any) {
    console.error('Twitter request error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /agent-auth/twitter/verify
 * Verify Twitter account via tweet URL
 *
 * Headers: Authorization: Bearer <agent-jwt>
 * Body: { tweetUrl: "https://x.com/user/status/123" }
 * Returns: { success: true, twitterHandle: "@username" }
 */
agentAuth.post('/twitter/verify', agentJwtMiddleware, async (c) => {
  try {
    const agentId = c.get('agentId');
    const { tweetUrl } = await c.req.json();

    if (!tweetUrl) {
      return c.json({ success: false, error: 'Missing tweetUrl' }, 400);
    }

    // Get pending verification
    const pending = pendingVerifications.get(agentId);
    if (!pending) {
      return c.json({
        success: false,
        error: 'No pending verification. Request a code first via /agent-auth/twitter/request'
      }, 400);
    }

    // Check expiration
    if (Date.now() > pending.expiresAt) {
      pendingVerifications.delete(agentId);
      return c.json({
        success: false,
        error: 'Verification code expired. Request a new one.'
      }, 400);
    }

    // Extract Twitter handle and tweet ID from URL
    // Format: https://twitter.com/username/status/1234567890
    // or: https://x.com/username/status/1234567890
    const tweetMatch = tweetUrl.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/);
    if (!tweetMatch) {
      return c.json({
        success: false,
        error: 'Invalid Twitter URL format. Expected: https://x.com/username/status/123'
      }, 400);
    }

    const twitterHandle = tweetMatch[1];
    const tweetId = tweetMatch[2];

    // Verify tweet exists and contains code
    const tweetVerified = await verifyTweet(tweetId, pending.code, twitterHandle);

    if (!tweetVerified.success) {
      return c.json({
        success: false,
        error: tweetVerified.error || 'Tweet verification failed'
      }, 400);
    }

    // Fetch agent to merge config
    const agentRecord = await prisma.tradingAgent.findUnique({ where: { id: agentId } });

    // Update agent with Twitter handle
    await prisma.tradingAgent.update({
      where: { id: agentId },
      data: {
        twitterHandle: `@${twitterHandle}`,
        config: {
          ...(typeof agentRecord?.config === 'object' ? agentRecord.config as Record<string, unknown> : {}),
          twitterVerified: true,
          twitterVerifiedAt: new Date().toISOString(),
          twitterUsername: twitterHandle
        }
      }
    });

    // Clean up pending verification
    pendingVerifications.delete(agentId);

    console.log(`Twitter verified: ${agentId} -> @${twitterHandle}`);

    // Auto-complete LINK_TWITTER onboarding task (fire-and-forget)
    autoCompleteOnboardingTask(agentId, 'LINK_TWITTER', { twitterHandle: `@${twitterHandle}` }).catch(() => {});

    return c.json({
      success: true,
      data: {
        agentId,
        twitterHandle: `@${twitterHandle}`,
        twitterUsername: twitterHandle,
        verifiedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Twitter verify error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * Verify tweet exists and contains verification code
 */
async function verifyTweet(
  tweetId: string,
  expectedCode: string,
  username: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Option 1: Use Twitter API (requires bearer token)
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    if (bearerToken) {
      const response = await fetch(
        `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text,author_id&expansions=author_id&user.fields=username`,
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`
          }
        }
      );

      if (!response.ok) {
        console.error('Twitter API error:', response.status);
        return { success: false, error: 'Tweet not found or API error' };
      }

      const data = await response.json();
      
      // Verify tweet contains code
      const tweetText = data.data?.text || '';
      if (!tweetText.includes(expectedCode)) {
        return { success: false, error: 'Tweet does not contain verification code' };
      }

      // Verify author matches
      const authorUsername = data.includes?.users?.[0]?.username;
      if (authorUsername && authorUsername.toLowerCase() !== username.toLowerCase()) {
        return { success: false, error: 'Tweet author does not match provided username' };
      }

      return { success: true };
    }

    // Option 2: Fallback - Trust the URL (less secure but works without API)
    // In production, you should validate via Twitter API
    console.warn('⚠️ TWITTER_BEARER_TOKEN not set - skipping tweet content verification');
    console.log(`ℹ️ Trusting tweet URL (less secure): https://twitter.com/${username}/status/${tweetId}`);
    
    // Still do basic validation
    if (!tweetId || !username) {
      return { success: false, error: 'Invalid tweet data' };
    }

    return { success: true };

  } catch (error: any) {
    console.error('Tweet verification error:', error);
    return { success: false, error: 'Failed to verify tweet' };
  }
}

// ============================================================================
// Task Verification
// ============================================================================

/**
 * POST /agent-auth/task/verify
 * Submit proof of task completion
 *
 * Headers: Authorization: Bearer <agent-jwt>
 * Body: {
 *   taskId: "task_123",
 *   proofType: "tweet" | "discord" | "url",
 *   proofUrl: "https://x.com/user/status/123"
 * }
 */
agentAuth.post('/task/verify', agentJwtMiddleware, async (c) => {
  try {
    const agentId = c.get('agentId');
    const { taskId, proofType, proofUrl, proofData } = await c.req.json();

    if (!taskId || !proofType) {
      return c.json({ success: false, error: 'Missing required fields (taskId, proofType)' }, 400);
    }

    // Verify agent exists and has Twitter linked (if needed)
    const agent = await prisma.tradingAgent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }

    // For Twitter tasks, require Twitter to be linked
    if (proofType === 'tweet' && !agent.twitterHandle) {
      return c.json({
        success: false,
        error: 'Twitter account not linked. Link it first via /agent-auth/twitter/request'
      }, 400);
    }

    // Verify proof based on type
    let verified = false;
    let verificationData: any = {};

    switch (proofType) {
      case 'tweet':
        const tweetMatch = proofUrl.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/);
        if (tweetMatch) {
          const username = tweetMatch[1];
          const tweetId = tweetMatch[2];
          
          // Verify tweet author matches linked Twitter
          const agentTwitter = agent.twitterHandle?.replace('@', '').toLowerCase();
          if (username.toLowerCase() === agentTwitter) {
            verified = true;
            verificationData = { tweetId, username };
          }
        }
        break;

      case 'discord':
        // Verify Discord message link
        verified = proofUrl.includes('discord.com/channels/');
        verificationData = { discordUrl: proofUrl };
        break;

      case 'url':
        // Generic URL verification (check it's valid)
        verified = proofUrl.startsWith('http');
        verificationData = { url: proofUrl };
        break;

      default:
        return c.json({ success: false, error: 'Invalid proof type' }, 400);
    }

    if (!verified) {
      return c.json({
        success: false,
        error: 'Proof verification failed. Check URL format and ownership.'
      }, 400);
    }

    // Record task completion (save to database or emit event)
    // This could integrate with your agent task manager or Ponzinomics API
    
    console.log(`✅ Task verified: ${agentId} completed ${taskId} (${proofType})`);

    return c.json({
      success: true,
      data: {
        agentId,
        taskId,
        proofType,
        proofUrl,
        verified: true,
        verifiedAt: new Date().toISOString(),
        ...verificationData
      }
    });

  } catch (error: any) {
    console.error('Task verify error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================================
// Social Profile Management
// ============================================================================

/**
 * POST /agent-auth/profile/update
 * Update agent social profiles
 *
 * Headers: Authorization: Bearer <agent-jwt>
 * Body: {
 *   discord: "username#1234",
 *   telegram: "@username",
 *   website: "https://..."
 * }
 */
agentAuth.post('/profile/update', agentJwtMiddleware, async (c) => {
  try {
    const agentId = c.get('agentId');
    const { discord, telegram, website, bio } = await c.req.json();

    // Update agent profile
    const agent = await prisma.tradingAgent.update({
      where: { id: agentId },
      data: {
        discord: discord || undefined,
        telegram: telegram || undefined,
        website: website || undefined,
        bio: bio || undefined
      }
    });

    // Auto-complete UPDATE_PROFILE onboarding task if bio was provided (fire-and-forget)
    if (bio) {
      autoCompleteOnboardingTask(agent.id, 'UPDATE_PROFILE', { bio }).catch(() => {});
    }

    return c.json({
      success: true,
      data: {
        agentId: agent.id,
        discord: agent.discord,
        telegram: agent.telegram,
        website: agent.website,
        bio: agent.bio,
        twitterHandle: agent.twitterHandle
      }
    });

  } catch (error: any) {
    console.error('Profile update error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /agent-auth/profile/:agentId
 * Get agent profile (public)
 */
agentAuth.get('/profile/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');

    const agent = await prisma.tradingAgent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        twitterHandle: true,
        discord: true,
        telegram: true,
        website: true,
        config: true,
        createdAt: true
      }
    });

    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }

    const config = agent.config as any;

    return c.json({
      success: true,
      data: {
        ...agent,
        twitterVerified: config?.twitterVerified || false,
        twitterVerifiedAt: config?.twitterVerifiedAt
      }
    });

  } catch (error: any) {
    console.error('Profile get error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export { agentAuth };
