import { Hono } from 'hono';
import {
  generateInvoice,
  validateAndDeliverService,
  getVaultBalances,
  setAgentToken,
} from '../services/pump-agent-payments.service';

export const pumpAgentPaymentsRoutes = new Hono();

// POST /pump-payments/agents/:id/invoice
// Generate a payment invoice for a service
pumpAgentPaymentsRoutes.post('/agents/:id/invoice', async (c) => {
  try {
    const agentId = c.req.param('id');
    const body = await c.req.json();
    const { userPubkey, service, currencyMint } = body;

    if (!userPubkey || !service) {
      return c.json({ error: 'userPubkey and service required' }, 400);
    }

    const result = await generateInvoice({ agentId, userPubkey, service, currencyMint });
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /pump-payments/agents/:id/validate
// Validate payment and deliver service
pumpAgentPaymentsRoutes.post('/agents/:id/validate', async (c) => {
  try {
    const agentId = c.req.param('id');
    const body = await c.req.json();
    const result = await validateAndDeliverService({ agentId, ...body });
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /pump-payments/agents/:id/balance
// Get vault balances for an agent's token
pumpAgentPaymentsRoutes.get('/agents/:id/balance', async (c) => {
  try {
    const agentId = c.req.param('id');
    const result = await getVaultBalances(agentId);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PUT /pump-payments/agents/:id/token
// Set or update the pump.fun token for an agent
pumpAgentPaymentsRoutes.put('/agents/:id/token', async (c) => {
  try {
    const agentId = c.req.param('id');
    const { pumpFunMint, buybackBps } = await c.req.json();
    if (!pumpFunMint) return c.json({ error: 'pumpFunMint required' }, 400);
    const agent = await setAgentToken(agentId, pumpFunMint, buybackBps ?? 5000);
    return c.json({ success: true, agent });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
