/**
 * Agent Authentication & Social Linking Routes
 * 
 * Allows agents to:
 * - Link their Twitter account (tweet-based verification)
 * - Verify task completion (post proof links)
 * - Update their profile with social handles
 * 
 * Flow:
 * 1. Agent generates verification tweet with unique code
 * 2. Agent posts tweet
 * 3. Agent submits tweet URL
 * 4. We verify tweet exists + contains code
 * 5. Link Twitter handle to agent
 */

import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const agentAuth = new Hono();
const prisma = new PrismaClient();

// Store pending verifications (in-memory, could use Redis)
const pendingVerifications = new Map<string, {
  agentId: string;
  code: string;
  expiresAt: number;
}>();

// ============================================================================
// Twitter Authentication
// ============================================================================

/**
 * POST /agent-auth/twitter/request
 * Generate verification code for Twitter linking
 * 
 * Body: { agentId: "obs_alpha" }
 * Returns: { code: "TRENCH_VERIFY_ABC123", expiresAt: timestamp }
 */
agentAuth.post('/twitter/request', async (c) => {
  try {
    const { agentId } = await c.req.json();

    if (!agentId) {
      return c.json({ success: false, error: 'Missing agentId' }, 400);
    }

    // Check agent exists
    const agent = await prisma.tradingAgent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }

    // Generate verification code
    const code = `TRENCH_VERIFY_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

    // Store pending verification
    pendingVerifications.set(agentId, { agentId, code, expiresAt });

    const verificationTweet = `I'm verifying my agent identity on @TrenchProtocol 🤖\n\nVerification code: ${code}\n\nAgent ID: ${agentId}\n#TrenchAgent`;

    return c.json({
      success: true,
      data: {
        code,
        expiresAt,
        tweetTemplate: verificationTweet,
        instructions: [
          '1. Copy the tweet template',
          '2. Post it on Twitter',
          '3. Copy the tweet URL',
          '4. Submit the URL via /agent-auth/twitter/verify'
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
 * Body: { agentId: "obs_alpha", tweetUrl: "https://twitter.com/user/status/123" }
 * Returns: { success: true, twitterHandle: "@username" }
 */
agentAuth.post('/twitter/verify', async (c) => {
  try {
    const { agentId, tweetUrl } = await c.req.json();

    if (!agentId || !tweetUrl) {
      return c.json({ success: false, error: 'Missing agentId or tweetUrl' }, 400);
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
        error: 'Invalid Twitter URL format. Expected: https://twitter.com/username/status/123'
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

    // Update agent with Twitter handle
    await prisma.tradingAgent.update({
      where: { id: agentId },
      data: {
        twitterHandle: `@${twitterHandle}`,
        config: {
          ...(typeof agent.config === 'object' ? agent.config : {}),
          twitterVerified: true,
          twitterVerifiedAt: new Date().toISOString(),
          twitterUsername: twitterHandle
        }
      }
    });

    // Clean up pending verification
    pendingVerifications.delete(agentId);

    console.log(`✅ Twitter verified: ${agentId} → @${twitterHandle}`);

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
 * Body: {
 *   agentId: "obs_alpha",
 *   taskId: "task_123",
 *   proofType: "tweet" | "discord" | "url",
 *   proofUrl: "https://twitter.com/user/status/123"
 * }
 */
agentAuth.post('/task/verify', async (c) => {
  try {
    const { agentId, taskId, proofType, proofUrl, proofData } = await c.req.json();

    if (!agentId || !taskId || !proofType) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
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
 * Body: {
 *   agentId: "obs_alpha",
 *   discord: "username#1234",
 *   telegram: "@username",
 *   website: "https://..."
 * }
 */
agentAuth.post('/profile/update', async (c) => {
  try {
    const { agentId, discord, telegram, website, bio } = await c.req.json();

    if (!agentId) {
      return c.json({ success: false, error: 'Missing agentId' }, 400);
    }

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
