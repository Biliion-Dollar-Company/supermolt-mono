/**
 * Trading Routes - API Endpoints for Agent Trading
 * 
 * Exposes trading execution + position management via HTTP API.
 * 
 * Endpoints:
 * - POST /api/trading/buy - Execute BUY trade
 * - POST /api/trading/sell - Execute SELL trade
 * - GET /api/trading/portfolio/:agentId - Get agent portfolio
 * - GET /api/trading/trades/:agentId - Get trade history
 * - GET /api/trading/metrics/:agentId - Get trade metrics
 * - GET /api/trading/positions - Get all positions (cross-agent visibility)
 */

import { Hono } from 'hono';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createTradingExecutor } from '../services/trading-executor';
import { createPositionManager } from '../services/position-manager';
import { getPriceFetcher } from '../services/price-fetcher';
import { PrismaClient } from '@prisma/client';

const trading = new Hono();
const prisma = new PrismaClient();

// Initialize services
const executor = createTradingExecutor(process.env.HELIUS_RPC_URL!);
const positionManager = createPositionManager();
const priceFetcher = getPriceFetcher();

// ============================================================================
// Helper: Get Agent Keypair
// ============================================================================

/**
 * Get agent's Solana keypair from database or env
 * 
 * TODO: Implement secure key storage (KMS, encrypted DB, etc.)
 * For now, expects private keys in environment variables
 */
async function getAgentKeypair(agentId: string): Promise<Keypair> {
  // Strategy 1: Check env var for specific agent
  const envKey = process.env[`AGENT_PRIVATE_KEY_${agentId.toUpperCase()}`];
  if (envKey) {
    return Keypair.fromSecretKey(bs58.decode(envKey));
  }

  // Strategy 2: Query database (if private keys stored there)
  const agent = await prisma.tradingAgent.findUnique({
    where: { id: agentId }
  });

  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  // TODO: Decrypt private key from database
  // For now, throw error if not in env
  throw new Error(
    `Private key for agent ${agentId} not found. ` +
    `Set AGENT_PRIVATE_KEY_${agentId.toUpperCase()}=<base58_key> in environment.`
  );
}

// ============================================================================
// Helper: Get Token Price (via PriceFetcher service)
// ============================================================================

/**
 * Get token price in SOL (for PnL calculation)
 */
async function getTokenPriceSOL(tokenMint: string): Promise<number | null> {
  return priceFetcher.getPriceSOL(tokenMint);
}

/**
 * Get token price in USD (for USDC volume calculation)
 */
async function getTokenPriceUSD(tokenMint: string): Promise<number | null> {
  return priceFetcher.getPriceUSD(tokenMint);
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/trading/buy
 * Execute a BUY trade
 * 
 * Body:
 * {
 *   "agentId": "obs_...",
 *   "tokenMint": "...",
 *   "tokenSymbol": "BONK",
 *   "tokenName": "Bonk",
 *   "solAmount": 0.01
 * }
 */
trading.post('/buy', async (c) => {
  try {
    const body = await c.req.json();
    const { agentId, tokenMint, tokenSymbol, tokenName, solAmount } = body;

    // Validate inputs
    if (!agentId || !tokenMint || !solAmount) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    if (solAmount <= 0 || solAmount > 10) {
      return c.json({ success: false, error: 'Invalid solAmount (must be 0-10 SOL)' }, 400);
    }

    // Get agent keypair
    const agentKeypair = await getAgentKeypair(agentId);

    // Check balance
    const balance = await executor.getBalance(agentKeypair.publicKey);
    if (balance < solAmount + 0.01) {
      return c.json({
        success: false,
        error: `Insufficient balance. Have ${balance.toFixed(4)} SOL, need ${(solAmount + 0.01).toFixed(4)} SOL`
      }, 400);
    }

    // Execute BUY
    console.log(`🔄 API: Executing BUY for ${agentId}: ${solAmount} SOL → ${tokenSymbol}`);
    
    const buyResult = await executor.executeBuy(
      agentKeypair,
      tokenMint,
      solAmount
    );

    // Record trade + update position
    await positionManager.recordBuy(
      agentId,
      tokenMint,
      tokenSymbol || 'UNKNOWN',
      tokenName || 'Unknown Token',
      buyResult
    );

    console.log(`✅ API: BUY completed: ${buyResult.signature}`);

    // TODO: Broadcast via WebSocket
    // await feedBroadcaster.broadcast('trade_executed', { agentId, ...buyResult });

    return c.json({
      success: true,
      data: {
        signature: buyResult.signature,
        amountSol: buyResult.amountSol,
        tokensReceived: buyResult.tokensReceived,
        totalFees: buyResult.totalFeesSol,
        feePercent: (buyResult.totalFeesSol / buyResult.amountSol) * 100,
        executionMs: buyResult.executionMs,
        solscan: `https://solscan.io/tx/${buyResult.signature}`
      }
    });

  } catch (error: any) {
    console.error('BUY trade error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

/**
 * POST /api/trading/sell
 * Execute a SELL trade
 * 
 * Body:
 * {
 *   "agentId": "obs_...",
 *   "tokenMint": "...",
 *   "tokenSymbol": "BONK",
 *   "tokenName": "Bonk",
 *   "tokenAmount": 1000000  // Amount to sell
 * }
 */
trading.post('/sell', async (c) => {
  try {
    const body = await c.req.json();
    const { agentId, tokenMint, tokenSymbol, tokenName, tokenAmount } = body;

    if (!agentId || !tokenMint || !tokenAmount) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    if (tokenAmount <= 0) {
      return c.json({ success: false, error: 'Invalid tokenAmount' }, 400);
    }

    // Get agent keypair
    const agentKeypair = await getAgentKeypair(agentId);

    // Verify agent has this position
    const position = await prisma.agentPosition.findUnique({
      where: {
        agentId_tokenMint: { agentId, tokenMint }
      }
    });

    if (!position) {
      return c.json({
        success: false,
        error: 'Position not found. Agent does not hold this token.'
      }, 400);
    }

    const currentQuantity = parseFloat(position.quantity.toString());
    if (tokenAmount > currentQuantity) {
      return c.json({
        success: false,
        error: `Insufficient tokens. Have ${currentQuantity}, trying to sell ${tokenAmount}`
      }, 400);
    }

    // Execute SELL
    console.log(`🔄 API: Executing SELL for ${agentId}: ${tokenAmount} ${tokenSymbol} → SOL`);

    const sellResult = await executor.executeSell(
      agentKeypair,
      tokenMint,
      tokenAmount
    );

    // Record trade + update position
    await positionManager.recordSell(
      agentId,
      tokenMint,
      tokenSymbol || 'UNKNOWN',
      tokenName || 'Unknown Token',
      sellResult
    );

    console.log(`✅ API: SELL completed: ${sellResult.signature}`);

    return c.json({
      success: true,
      data: {
        signature: sellResult.signature,
        tokensSold: sellResult.tokensSold,
        solReceived: sellResult.solReceived,
        totalFees: sellResult.totalFeesSol,
        feePercent: (sellResult.totalFeesSol / sellResult.solReceived) * 100,
        executionMs: sellResult.executionMs,
        solscan: `https://solscan.io/tx/${sellResult.signature}`
      }
    });

  } catch (error: any) {
    console.error('SELL trade error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

/**
 * GET /api/trading/portfolio/:agentId
 * Get agent's portfolio with PnL
 */
trading.get('/portfolio/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');

    const portfolio = await positionManager.getPortfolio(
      agentId,
      getTokenPriceSOL
    );

    return c.json({
      success: true,
      data: portfolio
    });

  } catch (error: any) {
    console.error('Portfolio error:', error);
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

/**
 * GET /api/trading/trades/:agentId
 * Get agent's trade history
 */
trading.get('/trades/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const limit = parseInt(c.req.query('limit') || '50');

    const trades = await positionManager.getTradeHistory(agentId, limit);

    return c.json({
      success: true,
      data: trades
    });

  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

/**
 * GET /api/trading/metrics/:agentId
 * Get agent's trade metrics
 */
trading.get('/metrics/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');

    const metrics = await positionManager.getTradeMetrics(agentId);

    return c.json({
      success: true,
      data: metrics
    });

  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

/**
 * GET /api/trading/positions
 * Get all agent positions (for cross-agent visibility)
 */
trading.get('/positions', async (c) => {
  try {
    const positions = await positionManager.getAllPositions();

    return c.json({
      success: true,
      data: positions
    });

  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

/**
 * GET /api/trading/balance/:agentId
 * Get agent's SOL balance
 */
trading.get('/balance/:agentId', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const agentKeypair = await getAgentKeypair(agentId);
    const balance = await executor.getBalance(agentKeypair.publicKey);

    return c.json({
      success: true,
      data: {
        agentId,
        publicKey: agentKeypair.publicKey.toString(),
        balance,
        balanceFormatted: `${balance.toFixed(4)} SOL`
      }
    });

  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message
    }, 500);
  }
});

export { trading };
