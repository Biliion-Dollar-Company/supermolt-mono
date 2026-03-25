/**
 * Compliance API Routes
 *
 * KYC, KYT, AML, Travel Rule endpoints for the compliance dashboard.
 */

import { Hono } from 'hono';
import { kycService } from '../services/compliance/kyc.service';
import { kytService } from '../services/compliance/kyt.service';
import { amlService } from '../services/compliance/aml.service';
import { travelRuleService } from '../services/compliance/travel-rule.service';
import { complianceGateway } from '../services/compliance/gateway.service';

const app = new Hono();

// ─── KYC ────────────────────────────────────────────

app.get('/kyc/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const result = await kycService.getKycStatus(agentId);

  if (!result) {
    return c.json({ status: 'NOT_FOUND', agentId }, 404);
  }

  return c.json(result);
});

app.post('/kyc/submit', async (c) => {
  const body = await c.req.json();
  const { entityId, entityType, walletAddress, chain } = body;

  if (!entityId || !walletAddress) {
    return c.json({ error: 'entityId and walletAddress are required' }, 400);
  }

  const result = await kycService.submitKyc({
    entityId,
    entityType: entityType ?? 'agent',
    walletAddress,
    chain: chain?.toUpperCase(),
  });

  return c.json(result);
});

app.post('/kyc/:recordId/verify', async (c) => {
  const recordId = c.req.param('recordId');
  const result = await kycService.verifyKyc(recordId);
  return c.json(result);
});

app.get('/kyc', async (c) => {
  const status = c.req.query('status') as any;
  const limit = parseInt(c.req.query('limit') ?? '50');
  const offset = parseInt(c.req.query('offset') ?? '0');
  const records = await kycService.getAll({ status, limit, offset });
  return c.json({ records, count: records.length });
});

// ─── KYT ────────────────────────────────────────────

app.get('/kyt/alerts', async (c) => {
  const resolved = c.req.query('resolved');
  const riskLevel = c.req.query('riskLevel') as any;
  const limit = parseInt(c.req.query('limit') ?? '50');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const alerts = await kytService.getAlerts({
    resolved: resolved !== undefined ? resolved === 'true' : undefined,
    riskLevel,
    limit,
    offset,
  });

  return c.json({ alerts, count: alerts.length });
});

app.post('/kyt/alerts/:id/resolve', async (c) => {
  const alertId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const resolvedBy = (body as any).resolvedBy ?? 'admin';

  const alert = await kytService.resolveAlert(alertId, resolvedBy);
  return c.json(alert);
});

// ─── AML ────────────────────────────────────────────

app.get('/aml/screen/:wallet', async (c) => {
  const wallet = c.req.param('wallet');
  const chain = c.req.query('chain') ?? 'solana';

  const result = await amlService.screenWallet(wallet, chain);
  return c.json(result);
});

app.get('/aml/screenings', async (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50');
  const offset = parseInt(c.req.query('offset') ?? '0');
  const screenings = await amlService.getScreenings({ limit, offset });
  return c.json({ screenings, count: screenings.length });
});

app.get('/aml/risk/:wallet', async (c) => {
  const wallet = c.req.param('wallet');
  const assessment = await amlService.getRiskAssessment(wallet);
  return c.json(assessment);
});

// ─── Travel Rule ────────────────────────────────────

app.get('/travel-rule/messages', async (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50');
  const offset = parseInt(c.req.query('offset') ?? '0');
  const messages = await travelRuleService.getAllMessages({ limit, offset });
  return c.json({ messages, count: messages.length });
});

app.get('/travel-rule/:transferId', async (c) => {
  const transferId = c.req.param('transferId');
  const messages = await travelRuleService.getMessagesForTransfer(transferId);
  return c.json({ messages, count: messages.length });
});

// ─── Dashboard & Audit ──────────────────────────────

app.get('/dashboard', async (c) => {
  const stats = await complianceGateway.getDashboardStats();
  return c.json(stats);
});

app.get('/audit-log', async (c) => {
  const action = c.req.query('action');
  const limit = parseInt(c.req.query('limit') ?? '50');
  const offset = parseInt(c.req.query('offset') ?? '0');

  const logs = await complianceGateway.getAuditLog({ action, limit, offset });
  return c.json({ logs, count: logs.length });
});

// ─── Manual Gate Check ──────────────────────────────

app.post('/gate-check', async (c) => {
  const body = await c.req.json();
  const { agentId, agentName, walletAddress, chain, amount } = body;

  if (!agentId || !walletAddress || !chain || amount === undefined) {
    return c.json({ error: 'agentId, walletAddress, chain, and amount are required' }, 400);
  }

  const result = await complianceGateway.gateTransfer({
    agentId,
    agentName,
    walletAddress,
    chain,
    amount: parseFloat(amount),
  });

  return c.json(result);
});

export { app as complianceRoutes };
