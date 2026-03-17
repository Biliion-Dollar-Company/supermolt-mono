/**
 * Agent Balance Routes
 * GET /agent/balance — fetch SOL balance for the authenticated agent's Privy wallet
 */

import { Hono } from 'hono';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { db } from '../lib/db';
import { verifyToken } from '../lib/jwt';
import { getTokenPrice } from '../lib/birdeye';

const agentBalanceRoutes = new Hono();
const SOL_MINT = 'So11111111111111111111111111111111111111112';

async function requireAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  try {
    const payload = await verifyToken(authHeader.substring(7));
    if (!payload.agentId) {
      return c.json({ success: false, error: 'Agent JWT required' }, 403);
    }
    c.set('agentId', payload.agentId);
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
}

agentBalanceRoutes.get('/balance', requireAuth, async (c) => {
  try {
    const agentId = c.get('agentId') as string;

    const agent = await db.tradingAgent.findUnique({
      where: { id: agentId },
      select: { config: true, privyWalletId: true },
    });

    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }

    const config = (agent.config as Record<string, any>) || {};
    const address = config.privyWalletAddress as string | undefined;

    if (!address) {
      return c.json({
        success: true,
        data: { address: null, solBalance: 0, usdValue: 0, hasWallet: false },
      });
    }

    const rpcUrl = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const balance = await connection.getBalance(new PublicKey(address));
    const solBalance = balance / LAMPORTS_PER_SOL;

    let usdValue = 0;
    try {
      const solPrice = await getTokenPrice(SOL_MINT);
      usdValue = solBalance * (solPrice?.priceUsd ?? 0);
    } catch {
      // Non-critical
    }

    return c.json({
      success: true,
      data: {
        address,
        solBalance: parseFloat(solBalance.toFixed(6)),
        usdValue: parseFloat(usdValue.toFixed(2)),
        hasWallet: true,
      },
    });
  } catch (error) {
    console.error('[AgentBalance] Error:', error);
    return c.json({ success: false, error: 'Failed to fetch balance' }, 500);
  }
});

export { agentBalanceRoutes };
