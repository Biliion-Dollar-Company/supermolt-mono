import { db } from '../lib/db';

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  recommendedContracts: number;
}

export interface AgentExposureSnapshot {
  agentId: string;
  openPredictions: number;
  totalExposureUsd: number;
  marketExposureUsd: number;
}

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class PredictionRiskPolicy {
  private maxOpenPredictionsPerAgent = envNum('PRED_MAX_OPEN_POSITIONS', 25);
  private maxAgentExposureUsd = envNum('PRED_MAX_AGENT_EXPOSURE_USD', 500);
  private maxMarketExposureUsd = envNum('PRED_MAX_MARKET_EXPOSURE_USD', 150);
  private maxContractsPerPrediction = envNum('PRED_MAX_CONTRACTS_PER_BET', 25);
  private minContractsPerPrediction = envNum('PRED_MIN_CONTRACTS_PER_BET', 1);

  async getAgentExposure(agentId: string, marketId?: string): Promise<AgentExposureSnapshot> {
    const [openPredictions, openExposureAgg, marketExposureAgg] = await Promise.all([
      db.agentPrediction.count({
        where: { agentId, outcome: 'PENDING' },
      }),
      db.agentPrediction.aggregate({
        where: { agentId, outcome: 'PENDING' },
        _sum: { totalCost: true },
      }),
      db.agentPrediction.aggregate({
        where: { agentId, outcome: 'PENDING', ...(marketId ? { marketId } : {}) },
        _sum: { totalCost: true },
      }),
    ]);

    return {
      agentId,
      openPredictions,
      totalExposureUsd: Number(openExposureAgg._sum.totalCost || 0),
      marketExposureUsd: Number(marketExposureAgg._sum.totalCost || 0),
    };
  }

  async canPlacePrediction(args: {
    agentId: string;
    marketId: string;
    avgPrice: number;
    contracts: number;
  }): Promise<RiskCheckResult> {
    const contracts = Math.max(
      this.minContractsPerPrediction,
      Math.min(this.maxContractsPerPrediction, Math.floor(args.contracts)),
    );

    const recommendedContracts = contracts;
    const exposure = await this.getAgentExposure(args.agentId, args.marketId);
    const cost = args.avgPrice * contracts;

    if (exposure.openPredictions >= this.maxOpenPredictionsPerAgent) {
      return {
        allowed: false,
        reason: `open position cap reached (${this.maxOpenPredictionsPerAgent})`,
        recommendedContracts,
      };
    }

    if (exposure.totalExposureUsd + cost > this.maxAgentExposureUsd) {
      return {
        allowed: false,
        reason: `agent exposure cap exceeded (${this.maxAgentExposureUsd} USD)`,
        recommendedContracts,
      };
    }

    if (exposure.marketExposureUsd + cost > this.maxMarketExposureUsd) {
      return {
        allowed: false,
        reason: `market exposure cap exceeded (${this.maxMarketExposureUsd} USD)`,
        recommendedContracts,
      };
    }

    return { allowed: true, recommendedContracts };
  }

  getLimits() {
    return {
      maxOpenPredictionsPerAgent: this.maxOpenPredictionsPerAgent,
      maxAgentExposureUsd: this.maxAgentExposureUsd,
      maxMarketExposureUsd: this.maxMarketExposureUsd,
      maxContractsPerPrediction: this.maxContractsPerPrediction,
      minContractsPerPrediction: this.minContractsPerPrediction,
    };
  }
}

export const predictionRiskPolicy = new PredictionRiskPolicy();
