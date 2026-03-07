/**
 * Swarm Service — High-level interface for the prediction swarm
 * Connects orchestrator to Polymarket client and database
 */

import { db } from '../../lib/db';
import { polymarketClient } from '../polymarket/polymarket.client';
import { analyzeMarket, scanAndDecide, getAgents } from './swarm.orchestrator';
import { MarketSignal, SwarmResult, AgentContext, NewsSignal } from './swarm.types';

function polymarketToSignal(market: {
  id: string;
  externalId: string;
  title: string;
  category: string;
  yesPrice: number | { toNumber?: () => number };
  noPrice: number | { toNumber?: () => number };
  volume?: number | { toNumber?: () => number };
  expiresAt: Date;
  metadata?: unknown;
}): MarketSignal {
  const yesPrice = typeof market.yesPrice === 'number' ? market.yesPrice : Number(market.yesPrice);
  const noPrice = typeof market.noPrice === 'number' ? market.noPrice : Number(market.noPrice);
  const volume = market.volume ? (typeof market.volume === 'number' ? market.volume : Number(market.volume)) : undefined;

  return {
    marketId: market.id,
    question: market.title,
    yesPrice,
    noPrice,
    combinedPrice: yesPrice + noPrice,
    category: market.category,
    endDate: market.expiresAt,
    volume,
  };
}

async function fetchNewsSignals(): Promise<NewsSignal[]> {
  try {
    const signals = await db.glintSignal.findMany({
      where: { processed: false },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });

    return signals.map((s) => ({
      text: s.text,
      source: s.source,
      confidence: s.confidence,
      confidenceScore: s.confidenceScore,
      category: s.category,
    }));
  } catch {
    return [];
  }
}

export async function getSwarmStatus() {
  const agents = getAgents();

  const [lastDecision, totalDecisions, trades] = await Promise.all([
    db.swarmDecision.findFirst({ orderBy: { createdAt: 'desc' } }),
    db.swarmDecision.count(),
    db.swarmDecision.count({ where: { consensus: { not: 'NO_TRADE' } } }),
  ]);

  return {
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      specialization: a.specialization,
      weight: a.weight,
    })),
    lastDecision: lastDecision
      ? {
          marketId: lastDecision.marketId,
          consensus: lastDecision.consensus,
          confidence: lastDecision.confidence,
          timestamp: lastDecision.createdAt,
        }
      : null,
    totalDecisions,
    totalTrades: trades,
    status: 'operational',
  };
}

export async function runSwarmScan(options: {
  dryRun?: boolean;
  marketIds?: string[];
}): Promise<SwarmResult[]> {
  const dryRun = options.dryRun ?? true;

  let markets: MarketSignal[];

  if (options.marketIds && options.marketIds.length > 0) {
    // Fetch specific markets from DB
    const dbMarkets = await db.predictionMarket.findMany({
      where: {
        id: { in: options.marketIds },
        platform: 'POLYMARKET',
      },
    });
    markets = dbMarkets.map((m) =>
      polymarketToSignal({
        id: m.id,
        externalId: m.externalId,
        title: m.title,
        category: m.category,
        yesPrice: Number(m.yesPrice),
        noPrice: Number(m.noPrice),
        volume: Number(m.volume),
        expiresAt: m.expiresAt,
      }),
    );
  } else {
    // Fetch open Polymarket markets ending in 1-7 days
    const now = new Date();
    const oneDay = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const dbMarkets = await db.predictionMarket.findMany({
      where: {
        platform: 'POLYMARKET',
        status: 'open',
        expiresAt: { gte: oneDay, lte: sevenDays },
      },
      orderBy: { volume: 'desc' },
      take: 50,
    });

    markets = dbMarkets.map((m) =>
      polymarketToSignal({
        id: m.id,
        externalId: m.externalId,
        title: m.title,
        category: m.category,
        yesPrice: Number(m.yesPrice),
        noPrice: Number(m.noPrice),
        volume: Number(m.volume),
        expiresAt: m.expiresAt,
      }),
    );
  }

  if (markets.length === 0) {
    console.log('[Swarm] No eligible markets found for scan');
    return [];
  }

  console.log(`[Swarm] Scanning ${markets.length} markets (dryRun: ${dryRun})`);

  const newsSignals = await fetchNewsSignals();

  return scanAndDecide(markets, { dryRun, newsSignals });
}

export async function analyzeSignal(signal: MarketSignal): Promise<SwarmResult> {
  const newsSignals = await fetchNewsSignals();
  const context: AgentContext = { newsSignals };

  const decision = await analyzeMarket(signal, context);

  // Log to DB
  await db.swarmDecision.create({
    data: {
      marketId: decision.marketId,
      question: decision.question,
      consensus: decision.consensus,
      confidence: decision.confidence,
      votes: decision.votes as object[],
      executed: false,
      dryRun: true,
      erc8004Logged: false,
    },
  });

  return { decision, executed: false, erc8004Logged: false };
}

export async function getSwarmHistory(limit: number = 50) {
  return db.swarmDecision.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getAgentPerformance() {
  const decisions = await db.swarmDecision.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const agentStats = new Map<string, { total: number; yes: number; no: number; abstain: number }>();

  for (const d of decisions) {
    const votes = d.votes as Array<{ agentId: string; vote: string; confidence: number }>;
    for (const v of votes) {
      const stats = agentStats.get(v.agentId) || { total: 0, yes: 0, no: 0, abstain: 0 };
      stats.total++;
      if (v.vote === 'YES') stats.yes++;
      else if (v.vote === 'NO') stats.no++;
      else stats.abstain++;
      agentStats.set(v.agentId, stats);
    }
  }

  const agents = getAgents();
  return agents.map((agent) => {
    const stats = agentStats.get(agent.id) || { total: 0, yes: 0, no: 0, abstain: 0 };
    return {
      ...agent,
      stats: {
        totalVotes: stats.total,
        yesVotes: stats.yes,
        noVotes: stats.no,
        abstainVotes: stats.abstain,
        participationRate: stats.total > 0 ? ((stats.yes + stats.no) / stats.total * 100).toFixed(1) + '%' : '0%',
      },
    };
  });
}
