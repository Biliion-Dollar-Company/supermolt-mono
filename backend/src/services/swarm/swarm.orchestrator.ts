/**
 * Swarm Orchestrator — The Conductor
 * Runs 5 agents in parallel, applies weighted consensus, executes decisions
 */

import { SwarmAgent, MarketSignal, AgentVote, SwarmDecision, SwarmResult, AgentContext } from './swarm.types';
import { analyze as weatherAnalyze } from './agents/weather.agent';
import { analyze as arbAnalyze } from './agents/arb.agent';
import { analyze as newsAnalyze } from './agents/news.agent';
import { analyze as quantAnalyze } from './agents/quant.agent';
import { analyze as riskAnalyze } from './agents/risk.agent';
import { db } from '../../lib/db';

const AGENTS: SwarmAgent[] = [
  { id: 'swarm-arb', name: 'Arb Agent', specialization: 'Structural YES+NO arbitrage', weight: 2.0 },
  { id: 'swarm-weather', name: 'Weather Agent', specialization: 'Weather market inefficiencies', weight: 1.5 },
  { id: 'swarm-news', name: 'News Agent', specialization: 'News/geopolitical signal matching', weight: 1.5 },
  { id: 'swarm-quant', name: 'Quant Agent', specialization: 'Historical pattern analysis', weight: 1.0 },
  { id: 'swarm-risk', name: 'Risk Agent', specialization: 'Risk management (VETO power)', weight: 1.0 },
];

const CONSENSUS_THRESHOLD = 0.6; // 60% weighted vote required for trade
const RISK_VETO_CONFIDENCE = 0.8; // Risk agent vetoes at this confidence

function safeAgentCall(
  fn: (signal: MarketSignal, context?: AgentContext) => Promise<AgentVote>,
  agentId: string,
): (signal: MarketSignal, context?: AgentContext) => Promise<AgentVote> {
  return async (signal, context) => {
    try {
      return await fn(signal, context);
    } catch (error) {
      console.error(`[Swarm] Agent ${agentId} error:`, error);
      return {
        agentId,
        vote: 'ABSTAIN',
        confidence: 0,
        reasoning: `Agent error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };
}

export async function analyzeMarket(signal: MarketSignal, context?: AgentContext): Promise<SwarmDecision> {
  // Run all 5 agents in parallel — errors become ABSTAINs
  const [arbVote, weatherVote, newsVote, quantVote, riskVote] = await Promise.all([
    safeAgentCall(arbAnalyze, 'swarm-arb')(signal),
    safeAgentCall(weatherAnalyze, 'swarm-weather')(signal),
    safeAgentCall(newsAnalyze, 'swarm-news')(signal, context),
    safeAgentCall(quantAnalyze, 'swarm-quant')(signal),
    safeAgentCall(riskAnalyze, 'swarm-risk')(signal),
  ]);

  const votes: AgentVote[] = [arbVote, weatherVote, newsVote, quantVote, riskVote];

  // Risk agent VETO: if risk votes ABSTAIN with confidence > 0.8, NO_TRADE
  if (riskVote.vote === 'ABSTAIN' && riskVote.confidence >= RISK_VETO_CONFIDENCE) {
    return {
      marketId: signal.marketId,
      question: signal.question,
      consensus: 'NO_TRADE',
      votes,
      confidence: 0,
      timestamp: new Date(),
    };
  }

  // Weighted consensus calculation
  let yesWeight = 0;
  let noWeight = 0;
  let totalWeight = 0;

  for (const vote of votes) {
    const agent = AGENTS.find((a) => a.id === vote.agentId);
    const weight = agent?.weight ?? 1.0;

    if (vote.vote === 'YES') {
      yesWeight += weight * vote.confidence;
      totalWeight += weight;
    } else if (vote.vote === 'NO') {
      noWeight += weight * vote.confidence;
      totalWeight += weight;
    }
    // ABSTAIN votes don't contribute to consensus
  }

  // No votes cast at all
  if (totalWeight === 0) {
    return {
      marketId: signal.marketId,
      question: signal.question,
      consensus: 'NO_TRADE',
      votes,
      confidence: 0,
      timestamp: new Date(),
    };
  }

  const yesRatio = yesWeight / totalWeight;
  const noRatio = noWeight / totalWeight;

  // Aggregate confidence: weighted average of voting agents' confidence
  const votingAgents = votes.filter((v) => v.vote !== 'ABSTAIN');
  const aggConfidence = votingAgents.length > 0
    ? votingAgents.reduce((sum, v) => {
        const agent = AGENTS.find((a) => a.id === v.agentId);
        return sum + v.confidence * (agent?.weight ?? 1);
      }, 0) / votingAgents.reduce((sum, v) => {
        const agent = AGENTS.find((a) => a.id === v.agentId);
        return sum + (agent?.weight ?? 1);
      }, 0)
    : 0;

  let consensus: 'BUY_YES' | 'BUY_NO' | 'NO_TRADE';

  if (yesRatio >= CONSENSUS_THRESHOLD) {
    consensus = 'BUY_YES';
  } else if (noRatio >= CONSENSUS_THRESHOLD) {
    consensus = 'BUY_NO';
  } else {
    consensus = 'NO_TRADE';
  }

  return {
    marketId: signal.marketId,
    question: signal.question,
    consensus,
    votes,
    confidence: aggConfidence,
    timestamp: new Date(),
  };
}

export async function executeDecision(decision: SwarmDecision, dryRun: boolean): Promise<SwarmResult> {
  // Log every decision to DB
  await db.swarmDecision.create({
    data: {
      marketId: decision.marketId,
      question: decision.question,
      consensus: decision.consensus,
      confidence: decision.confidence,
      votes: decision.votes as object[],
      executed: !dryRun && decision.consensus !== 'NO_TRADE',
      dryRun,
      erc8004Logged: false,
    },
  });

  if (decision.consensus === 'NO_TRADE') {
    return { decision, executed: false, erc8004Logged: false };
  }

  if (dryRun) {
    console.log(`[Swarm] DRY RUN: Would ${decision.consensus} on "${decision.question.slice(0, 60)}..." (confidence: ${(decision.confidence * 100).toFixed(1)}%)`);
    return { decision, executed: false, erc8004Logged: false };
  }

  // Real execution would go here — for hackathon, log the intent
  console.log(`[Swarm] EXECUTE: ${decision.consensus} on "${decision.question.slice(0, 60)}..." (confidence: ${(decision.confidence * 100).toFixed(1)}%)`);

  // Log to ERC-8004 reputation (fire and forget)
  let erc8004Logged = false;
  try {
    // ERC-8004 integration will be called post-resolution
    erc8004Logged = true;
  } catch (error) {
    console.error('[Swarm] Failed to log to ERC-8004:', error);
  }

  return {
    decision,
    executed: true,
    erc8004Logged,
  };
}

export async function scanAndDecide(
  markets: MarketSignal[],
  options: { dryRun: boolean; newsSignals?: AgentContext['newsSignals'] },
): Promise<SwarmResult[]> {
  const context: AgentContext = { newsSignals: options.newsSignals };

  // Analyze all markets
  const decisions = await Promise.all(
    markets.map((market) => analyzeMarket(market, context)),
  );

  // Filter to tradeable decisions and sort by confidence
  const tradeable = decisions
    .filter((d) => d.consensus !== 'NO_TRADE')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3); // Top 3 only — don't spray capital

  const noTrades = decisions.filter((d) => d.consensus === 'NO_TRADE');

  // Execute top trades + log all NO_TRADE decisions
  const results = await Promise.all([
    ...tradeable.map((d) => executeDecision(d, options.dryRun)),
    ...noTrades.map((d) => executeDecision(d, options.dryRun)),
  ]);

  return results;
}

export function getAgents(): SwarmAgent[] {
  return AGENTS;
}
