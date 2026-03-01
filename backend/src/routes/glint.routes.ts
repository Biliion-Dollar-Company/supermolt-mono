/**
 * Glint Routes - Webhook endpoint for Glint.trade signal delivery
 * 
 * Receives real-time market-moving signals from Glint.trade
 */

import { Hono } from 'hono';
import { db } from '../lib/db';

const glintRoutes = new Hono();

// POST /glint/webhook — Receive Glint signal
glintRoutes.post('/webhook', async (c) => {
  try {
    const alert = await c.req.json();
    
    console.log('[Glint] 🟧 New signal received:', {
      confidence: alert.confidence,
      source: alert.source,
      timestamp: alert.timestamp,
    });

    // Parse Glint alert structure
    const {
      confidence,     // e.g., "HIGH", "CRIT" or numeric 7-10
      confidenceScore, // numeric 1-10 if provided
      source,         // e.g., "@NickTimiraos"
      text,           // Signal content/reasoning
      markets = [],   // Related Polymarket markets (array)
      timestamp,
      category,       // e.g., "Politics", "Crypto"
    } = alert;

    // Convert confidence to numeric if it's a string
    let numericConfidence = confidenceScore;
    if (!numericConfidence && typeof confidence === 'string') {
      if (confidence === 'CRIT') numericConfidence = 10;
      else if (confidence === 'HIGH') numericConfidence = 8;
      else if (confidence === 'MEDIUM') numericConfidence = 6;
      else numericConfidence = 5;
    }

    // Store signal in database for Agent Gamma to process
    try {
      await db.glintSignal.create({
        data: {
          confidence: confidence?.toString() || 'UNKNOWN',
          confidenceScore: numericConfidence || 0,
          source: source || 'unknown',
          text: text || '',
          markets: markets, // Prisma Json type
          category: category || 'general',
          receivedAt: timestamp ? new Date(timestamp) : new Date(),
          processed: false,
        },
      });

      console.log('[Glint] ✅ Signal stored in database');
    } catch (dbError: any) {
      console.error('[Glint] ❌ Database error:', dbError.message);
      // Don't fail the webhook on DB errors
    }

    // Log markets if present
    if (markets.length > 0) {
      console.log(`[Glint]    📊 Related markets: ${markets.length}`);
      markets.forEach((market: any, idx: number) => {
        console.log(`[Glint]       ${idx + 1}. ${market.title || market.id} (${market.currentPrice || 'N/A'})`);
      });
    }

    console.log(`[Glint]    💬 ${text.substring(0, 100)}...`);

    // Return success response
    return c.json({
      success: true,
      received: true,
      signalsStored: 1,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Glint] ❌ Webhook error:', error);
    return c.json({
      success: false,
      error: 'Failed to process signal',
      message: error.message,
    }, 500);
  }
});

// GET /glint/signals — List recent signals (for debugging)
glintRoutes.get('/signals', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const unprocessedOnly = c.req.query('unprocessed') === 'true';

    const signals = await db.glintSignal.findMany({
      where: unprocessedOnly ? { processed: false } : undefined,
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });

    return c.json({
      success: true,
      data: signals,
      count: signals.length,
    });
  } catch (error: any) {
    console.error('[Glint] GET /signals error:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch signals',
    }, 500);
  }
});

// POST /glint/test — Test endpoint (for manual testing)
glintRoutes.post('/test', async (c) => {
  const testSignal = {
    confidence: 'HIGH',
    confidenceScore: 8,
    source: '@TestSource',
    text: 'Test signal from manual trigger',
    markets: [
      {
        id: 'test-market-123',
        title: 'Test Market',
        currentPrice: 0.45,
        glintScore: 8,
      },
    ],
    timestamp: new Date().toISOString(),
    category: 'test',
  };

  // Forward to the webhook handler
  return c.json(testSignal);
});

export default glintRoutes;
