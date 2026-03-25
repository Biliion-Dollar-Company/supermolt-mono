/**
 * Circle Gateway Routes
 *
 * GET  /gateway/balance            — unified USDC balance across all chains
 * POST /gateway/estimate           — fee estimate for a cross-chain transfer
 * POST /gateway/distribute/:epochId — trigger epoch reward distribution (admin)
 * GET  /gateway/status             — health check + config summary
 */

import { Hono } from 'hono';
import { circleGateway } from '../services/circle-gateway.service';
import { unifiedTreasuryService } from '../services/treasury-manager.unified.service';
import { adminAuth } from '../middleware/admin-auth';

const gatewayRoutes = new Hono();

/**
 * GET /gateway/balance
 *
 * Returns the unified USDC balance across all chains managed by Circle Gateway.
 */
gatewayRoutes.get('/balance', async (c) => {
  try {
    const balance = await circleGateway.getUnifiedBalance();
    return c.json({ success: true, data: balance });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * POST /gateway/estimate
 *
 * Body: { to: string, amount: number, destinationChain: string }
 * Returns fee estimate + expiry for the requested transfer.
 */
gatewayRoutes.post('/estimate', async (c) => {
  try {
    const body = await c.req.json() as { to?: unknown; amount?: unknown; destinationChain?: unknown };

    const { to, amount, destinationChain } = body;

    if (typeof to !== 'string' || !to) {
      return c.json({ success: false, error: 'Missing or invalid "to" address' }, 400);
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return c.json({ success: false, error: 'Missing or invalid "amount" (must be a positive number)' }, 400);
    }
    if (typeof destinationChain !== 'string' || !destinationChain) {
      return c.json({ success: false, error: 'Missing or invalid "destinationChain"' }, 400);
    }

    const estimate = await circleGateway.estimateTransfer(to, amount, destinationChain);
    return c.json({ success: true, data: estimate });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('Unsupported destination chain') ? 400 : 500;
    return c.json({ success: false, error: message }, status);
  }
});

/**
 * POST /gateway/distribute/:epochId
 *
 * Triggers full USDC reward distribution for the given epoch via Circle Gateway.
 * Requires X-Admin-Key header.
 */
gatewayRoutes.post('/distribute/:epochId', adminAuth, async (c) => {
  try {
    const epochId = c.req.param('epochId');
    if (!epochId) {
      return c.json({ success: false, error: 'Missing epochId' }, 400);
    }

    const summary = await unifiedTreasuryService.distributeViaGateway(epochId);
    return c.json({ success: true, data: summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes('not found') ||
      message.includes('already distributed') ||
      message.includes('No active')
    ) {
      return c.json({ success: false, error: message }, 400);
    }

    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * POST /gateway/distribute/:epochId/compliant
 *
 * Compliance-gated distribution: runs KYC/AML/KYT/Travel Rule checks
 * on every recipient before transferring USDC via Circle Gateway.
 * Blocked recipients are skipped; flagged recipients proceed with logging.
 */
gatewayRoutes.post('/distribute/:epochId/compliant', adminAuth, async (c) => {
  try {
    const epochId = c.req.param('epochId');
    if (!epochId) {
      return c.json({ success: false, error: 'Missing epochId' }, 400);
    }

    const summary = await unifiedTreasuryService.distributeViaGatewayCompliant(epochId);
    return c.json({ success: true, data: summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes('not found') ||
      message.includes('already distributed') ||
      message.includes('No active') ||
      message.includes('blocked by compliance')
    ) {
      return c.json({ success: false, error: message }, 400);
    }

    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * GET /gateway/status
 *
 * Returns health check information and current configuration summary.
 * Safe to expose publicly — no secrets are included in the response.
 */
gatewayRoutes.get('/status', async (c) => {
  const mockMode = (process.env.CIRCLE_GATEWAY_MOCK ?? '').toLowerCase() === 'true';
  const configured = circleGateway.isConfigured();
  const baseUrl =
    process.env.CIRCLE_GATEWAY_BASE_URL ?? 'https://gateway-api-testnet.circle.com';
  const sourceChain = process.env.CIRCLE_GATEWAY_SOURCE_CHAIN ?? 'ethereum';
  const apiKeySet = !!process.env.CIRCLE_GATEWAY_API_KEY;

  return c.json({
    success: true,
    data: {
      status: configured ? 'ok' : 'unconfigured',
      mockMode,
      apiKeyConfigured: apiKeySet,
      baseUrl,
      sourceChain,
      supportedDestinationChains: [
        'solana',
        'ethereum',
        'base',
        'polygon',
        'avalanche',
        'optimism',
        'arbitrum',
      ],
    },
  });
});

export { gatewayRoutes };
