import { db } from '../lib/db';
import { calculateLevel } from './onboarding.service';
import { predictionRiskPolicy } from './prediction-risk-policy';
import { websocketEvents } from './websocket-events';

type Side = 'YES' | 'NO';

interface Proposal {
  agentId: string;
  marketId: string;
  marketTicker: string;
  marketTitle: string;
  side: Side;
  confidence: number;
  contracts: number;
  avgPrice: number;
  consensusWeight: number;
}

export interface PredictionCycleResult {
  cycleId: string;
  startedAt: string;
  marketsEvaluated: number;
  proposalsGenerated: number;
  predictionsCreated: number;
  skipped: Array<{ agentId: string; marketTicker: string; reason: string }>;
}

interface CoordinatorStatus {
  active: boolean;
  intervalMs: number;
  lastCycleAt: string | null;
  lastResult: PredictionCycleResult | null;
}

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class PredictionCoordinator {
  private intervalMs = envNum('PRED_COORDINATOR_INTERVAL_MS', 5 * 60 * 1000);
  private marketsPerCycle = envNum('PRED_COORDINATOR_MARKETS_PER_CYCLE', 8);
  private agentsPerMarket = envNum('PRED_COORDINATOR_AGENTS_PER_MARKET', 3);
  private baseContracts = envNum('PRED_COORDINATOR_BASE_CONTRACTS', 5);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private cycleInProgress = false;
  private lastCycleAt: string | null = null;
  private lastResult: PredictionCycleResult | null = null;

  start() {
    if (this.running) return;
    this.running = true;
    this.runCycle().catch((err) => console.error('[PredictionCoordinator] initial cycle failed:', err));
    this.timer = setInterval(() => {
      this.runCycle().catch((err) => {
        console.error('[PredictionCoordinator] scheduled cycle failed:', err);
      });
    }, this.intervalMs);
    console.log(`[PredictionCoordinator] started (${this.intervalMs}ms interval)`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    console.log('[PredictionCoordinator] stopped');
  }

  getStatus(): CoordinatorStatus {
    return {
      active: this.running,
      intervalMs: this.intervalMs,
      lastCycleAt: this.lastCycleAt,
      lastResult: this.lastResult,
    };
  }

  async getExposure(agentId?: string) {
    const where = {
      outcome: 'PENDING' as const,
      ...(agentId ? { agentId } : {}),
    };
    const [openPredictions, totalExposure, byAgent, byMarket] = await Promise.all([
      db.agentPrediction.count({ where }),
      db.agentPrediction.aggregate({ where, _sum: { totalCost: true } }),
      db.agentPrediction.groupBy({
        by: ['agentId'],
        where,
        _count: { id: true },
        _sum: { totalCost: true },
      }),
      db.agentPrediction.groupBy({
        by: ['marketId'],
        where,
        _count: { id: true },
        _sum: { totalCost: true },
      }),
    ]);

    return {
      openPredictions,
      totalExposureUsd: Number(totalExposure._sum.totalCost || 0),
      byAgent: byAgent.map((x) => ({
        agentId: x.agentId,
        openPredictions: x._count.id,
        exposureUsd: Number(x._sum.totalCost || 0),
      })),
      byMarket: byMarket.map((x) => ({
        marketId: x.marketId,
        openPredictions: x._count.id,
        exposureUsd: Number(x._sum.totalCost || 0),
      })),
      limits: predictionRiskPolicy.getLimits(),
    };
  }

  async runCycle(): Promise<PredictionCycleResult> {
    if (this.cycleInProgress) {
      throw new Error('cycle already in progress');
    }
    this.cycleInProgress = true;

    const cycleId = `pred_${Date.now()}`;
    const startedAt = new Date().toISOString();
    const skipped: Array<{ agentId: string; marketTicker: string; reason: string }> = [];
    let proposalsGenerated = 0;
    let predictionsCreated = 0;

    try {
      const [markets, agents] = await Promise.all([
        db.predictionMarket.findMany({
          where: { status: 'open', outcome: 'PENDING', platform: 'POLYMARKET' },
          orderBy: [{ volume: 'desc' }, { expiresAt: 'asc' }],
          take: this.marketsPerCycle,
        }),
        db.tradingAgent.findMany({
          where: {
            status: 'ACTIVE',
            // Exclude observer-only system agents from automatic execution loop.
            config: { path: ['role'], not: 'observer' },
          },
          select: {
            id: true,
            name: true,
            displayName: true,
            archetypeId: true,
            level: true,
          },
        }),
      ]);

      if (markets.length === 0 || agents.length === 0) {
        const empty: PredictionCycleResult = {
          cycleId,
          startedAt,
          marketsEvaluated: markets.length,
          proposalsGenerated: 0,
          predictionsCreated: 0,
          skipped,
        };
        this.lastCycleAt = startedAt;
        this.lastResult = empty;
        return empty;
      }

      for (const market of markets) {
        const selectedAgents = this.pickAgentsForMarket(agents, market.id);
        const proposals: Proposal[] = selectedAgents.map((agent) => {
          const proposal = this.buildProposal(agent, market);
          proposalsGenerated++;
          return proposal;
        });

        const consensus = this.computeConsensus(proposals);

        for (const p of proposals) {
          const adjustedConfidence = Math.max(
            55,
            Math.min(95, p.confidence + (p.side === consensus.side ? 6 : -4)),
          );
          const reasoning = this.buildReasoning({
            proposal: p,
            consensusSide: consensus.side,
            consensusStrength: consensus.strength,
            cycleId,
          });

          const risk = await predictionRiskPolicy.canPlacePrediction({
            agentId: p.agentId,
            marketId: p.marketId,
            avgPrice: p.avgPrice,
            contracts: p.contracts,
          });

          if (!risk.allowed) {
            skipped.push({
              agentId: p.agentId,
              marketTicker: p.marketTicker,
              reason: risk.reason || 'risk policy',
            });
            continue;
          }

          await db.$transaction(async (tx) => {
            await tx.agentPrediction.create({
              data: {
                agentId: p.agentId,
                marketId: p.marketId,
                side: p.side,
                contracts: risk.recommendedContracts,
                avgPrice: p.avgPrice,
                totalCost: p.avgPrice * risk.recommendedContracts,
                confidence: adjustedConfidence,
                reasoning,
                realOrder: false,
              },
            });

            await tx.predictionStats.upsert({
              where: { agentId: p.agentId },
              create: {
                agentId: p.agentId,
                totalPredictions: 1,
                totalCost: p.avgPrice * risk.recommendedContracts,
              },
              update: {
                totalPredictions: { increment: 1 },
                totalCost: { increment: p.avgPrice * risk.recommendedContracts },
              },
            });

            const updated = await tx.tradingAgent.update({
              where: { id: p.agentId },
              data: { xp: { increment: 10 } },
            });
            const newLevel = calculateLevel(updated.xp);
            if (newLevel !== updated.level) {
              await tx.tradingAgent.update({
                where: { id: p.agentId },
                data: { level: newLevel },
              });
            }
          });

          predictionsCreated++;

          websocketEvents.broadcastPredictionSignal({
            cycleId,
            agentId: p.agentId,
            marketId: p.marketId,
            ticker: p.marketTicker,
            side: p.side,
            confidence: adjustedConfidence,
            contracts: risk.recommendedContracts,
            avgPrice: p.avgPrice,
          });
        }

        websocketEvents.broadcastPredictionConsensus({
          cycleId,
          marketId: market.id,
          ticker: market.externalId,
          side: consensus.side,
          confidence: consensus.strength,
          participants: proposals.length,
        });
      }

      const result: PredictionCycleResult = {
        cycleId,
        startedAt,
        marketsEvaluated: markets.length,
        proposalsGenerated,
        predictionsCreated,
        skipped,
      };

      this.lastCycleAt = startedAt;
      this.lastResult = result;
      return result;
    } finally {
      this.cycleInProgress = false;
    }
  }

  private pickAgentsForMarket<T extends { id: string }>(agents: T[], marketId: string): T[] {
    const sorted = [...agents].sort((a, b) => `${a.id}:${marketId}`.localeCompare(`${b.id}:${marketId}`));
    return sorted.slice(0, Math.max(1, this.agentsPerMarket));
  }

  private buildProposal(
    agent: { id: string; name: string; displayName: string | null; archetypeId: string; level: number },
    market: { id: string; externalId: string; title: string; yesPrice: any; noPrice: any; volume: any },
  ): Proposal {
    const yesPrice = Number(market.yesPrice);
    const noPrice = Number(market.noPrice);
    const normalizedPrice = yesPrice >= noPrice ? yesPrice : 1 - noPrice;
    const bias = this.resolveAgentBias(agent.archetypeId, agent.name);
    const side = this.resolveSide(bias, yesPrice);
    const confidenceBase = side === 'YES' ? yesPrice : noPrice;
    const confidence = Math.round(58 + confidenceBase * 30 + (agent.level >= 5 ? 4 : 0));
    const contracts = Math.max(1, Math.floor(this.baseContracts + agent.level / 2));
    const avgPrice = side === 'YES' ? yesPrice : noPrice;

    return {
      agentId: agent.id,
      marketId: market.id,
      marketTicker: market.externalId,
      marketTitle: market.title,
      side,
      confidence,
      contracts,
      avgPrice,
      consensusWeight: normalizedPrice,
    };
  }

  private resolveAgentBias(archetype: string, name: string): 'momentum' | 'contrarian' {
    const x = `${archetype} ${name}`.toLowerCase();
    if (
      x.includes('contrarian') ||
      x.includes('delta') ||
      x.includes('skeptic') ||
      x.includes('narrative')
    ) {
      return 'contrarian';
    }
    return 'momentum';
  }

  private resolveSide(bias: 'momentum' | 'contrarian', yesPrice: number): Side {
    if (bias === 'contrarian') {
      if (yesPrice >= 0.5) return 'NO';
      return 'YES';
    }
    if (yesPrice >= 0.5) return 'YES';
    return 'NO';
  }

  private computeConsensus(proposals: Proposal[]): { side: Side; strength: number } {
    const yes = proposals.filter((p) => p.side === 'YES').length;
    const no = proposals.length - yes;
    const side: Side = yes >= no ? 'YES' : 'NO';
    const majority = Math.max(yes, no);
    const strength = Math.round((majority / Math.max(1, proposals.length)) * 100);
    return { side, strength };
  }

  private buildReasoning(args: {
    proposal: Proposal;
    consensusSide: Side;
    consensusStrength: number;
    cycleId: string;
  }): string {
    return [
      `[${args.cycleId}] cooperative prediction cycle`,
      `market=${args.proposal.marketTicker}`,
      `agent-side=${args.proposal.side}`,
      `consensus=${args.consensusSide} (${args.consensusStrength}%)`,
      `entry=${args.proposal.avgPrice.toFixed(4)}`,
    ].join(' | ');
  }
}

let predictionCoordinatorSingleton: PredictionCoordinator | null = null;

export function getPredictionCoordinator(): PredictionCoordinator {
  if (!predictionCoordinatorSingleton) {
    predictionCoordinatorSingleton = new PredictionCoordinator();
  }
  return predictionCoordinatorSingleton;
}
