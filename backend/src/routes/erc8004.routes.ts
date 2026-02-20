/**
 * ERC-8004 Routes — Agent Identity, Reputation, and Validation
 *
 * POST /erc8004/register/:agentId          — Register agent on-chain
 * POST /erc8004/register/all               — Bulk register all agents
 * GET  /erc8004/agent/:agentId             — Get agent registration details
 * 
 * POST /erc8004/feedback/:tradeId          — Submit trade feedback
 * POST /erc8004/feedback/bulk              — Bulk submit all pending feedback
 * GET  /erc8004/reputation/:agentId        — Get agent reputation summary
 * 
 * POST /erc8004/validate/:tradeId          — Create validation request for trade
 * POST /erc8004/validate/bulk              — Bulk validate all pending trades
 * GET  /erc8004/validation/:tradeId        — Get trade validation status
 * GET  /erc8004/validation/stats/:agentId  — Get agent validation statistics
 * 
 * GET  /erc8004/test/ipfs                  — Test IPFS connectivity
 */

import { Hono } from 'hono';
import * as jwt from 'jose';
import * as identity from '../services/erc8004-identity.service';
import * as reputation from '../services/erc8004-reputation.service';
import * as validation from '../services/erc8004-validation.service';
import { testIPFS } from '../lib/ipfs';

export const erc8004Routes = new Hono();

const JWT_SECRET = process.env.JWT_SECRET;

// Simple JWT auth middleware
async function requireAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization required' }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwt.jwtVerify(token, secret);

    if (payload.type !== 'agent') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    c.set('agentId', payload.agentId as string);
    c.set('agentSub', payload.sub as string);
    c.set('agentChain', payload.chain || 'SOLANA');
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

// ── Identity Registry ────────────────────────────────────

// POST /erc8004/register/:agentId
erc8004Routes.post('/register/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const result = await identity.registerAgentOnChain(agentId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[ERC-8004] Registration failed:', error);
    return c.json({ error: error.message || 'Registration failed' }, 500);
  }
});

// POST /erc8004/register/all
erc8004Routes.post('/register/all', async (c) => {
  try {
    const result = await identity.registerAllAgents();
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[ERC-8004] Bulk registration failed:', error);
    return c.json({ error: error.message || 'Bulk registration failed' }, 500);
  }
});

// GET /erc8004/agent/:agentId
erc8004Routes.get('/agent/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const result = await identity.getAgentRegistration(agentId);
    
    if (!result) {
      return c.json({ error: 'Agent not registered on-chain' }, 404);
    }
    
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[ERC-8004] Failed to get agent:', error);
    return c.json({ error: error.message || 'Failed to get agent' }, 500);
  }
});

// ── Reputation Registry ──────────────────────────────────

// POST /erc8004/feedback/:tradeId
erc8004Routes.post('/feedback/:tradeId', async (c) => {
  try {
    const tradeId = c.req.param('tradeId');
    const result = await reputation.submitTradeFeedback(tradeId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[ERC-8004] Feedback submission failed:', error);
    return c.json({ error: error.message || 'Feedback submission failed' }, 500);
  }
});

// POST /erc8004/feedback/bulk
erc8004Routes.post('/feedback/bulk', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const agentId = body.agentId;
    
    const result = await reputation.submitAllTradeFeedback(agentId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[ERC-8004] Bulk feedback failed:', error);
    return c.json({ error: error.message || 'Bulk feedback failed' }, 500);
  }
});

// GET /erc8004/reputation/:agentId
erc8004Routes.get('/reputation/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const result = await reputation.getAgentReputation(agentId);
    
    if (!result) {
      return c.json({ error: 'Agent not registered or no reputation data' }, 404);
    }
    
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[ERC-8004] Failed to get reputation:', error);
    return c.json({ error: error.message || 'Failed to get reputation' }, 500);
  }
});

// ── Validation Registry ──────────────────────────────────

// POST /erc8004/validate/:tradeId
erc8004Routes.post('/validate/:tradeId', async (c) => {
  try {
    const tradeId = c.req.param('tradeId');
    const result = await validation.proveTradeIntent(tradeId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[ERC-8004] Validation failed:', error);
    return c.json({ error: error.message || 'Validation failed' }, 500);
  }
});

// POST /erc8004/validate/bulk
erc8004Routes.post('/validate/bulk', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const agentId = body.agentId;
    
    const result = await validation.proveAllTradeIntents(agentId);
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[ERC-8004] Bulk validation failed:', error);
    return c.json({ error: error.message || 'Bulk validation failed' }, 500);
  }
});

// GET /erc8004/validation/:tradeId
erc8004Routes.get('/validation/:tradeId', async (c) => {
  try {
    const tradeId = c.req.param('tradeId');
    const result = await validation.getTradeValidation(tradeId);
    
    if (!result) {
      return c.json({ error: 'Validation not found for this trade' }, 404);
    }
    
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[ERC-8004] Failed to get validation:', error);
    return c.json({ error: error.message || 'Failed to get validation' }, 500);
  }
});

// GET /erc8004/validation/stats/:agentId
erc8004Routes.get('/validation/stats/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const result = await validation.getAgentValidationStats(agentId);
    
    if (!result) {
      return c.json({ error: 'Agent not registered or no validation data' }, 404);
    }
    
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[ERC-8004] Failed to get validation stats:', error);
    return c.json({ error: error.message || 'Failed to get validation stats' }, 500);
  }
});

// ── Testing ──────────────────────────────────────────────

// GET /erc8004/test/ipfs
erc8004Routes.get('/test/ipfs', async (c) => {
  try {
    const success = await testIPFS();
    return c.json({ 
      success, 
      message: success ? 'IPFS working correctly' : 'IPFS test failed' 
    });
  } catch (error: any) {
    console.error('[ERC-8004] IPFS test failed:', error);
    return c.json({ error: error.message || 'IPFS test failed' }, 500);
  }
});
