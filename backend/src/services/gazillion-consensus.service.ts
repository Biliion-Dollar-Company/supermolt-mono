/**
 * Gazillion Intelligence (GI) - Consensus Engine
 * 
 * Coordinates the "War Room Debate" between specialized agents:
 * 1. The Scout (Narrative/Trend)
 * 2. The Analyst (Risk/On-chain)
 * 3. The General (Decision/Synthesis)
 */

import { db } from '../lib/db';
import { llmService } from './llm.service';
import { websocketEvents } from './websocket-events';
import { type TokenContext } from '../lib/conversation-generator';

export enum ConsensusAgent {
  SCOUT = 'scout',
  ANALYST = 'analyst',
  GENERAL = 'general'
}

export interface DebateMessage {
  role: ConsensusAgent;
  name: string;
  message: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface ConsensusResult {
  decision: 'BUY' | 'WAIT' | 'REJECT';
  confidence: number;
  reasoning: string;
  debate: DebateMessage[];
}

export class GazillionConsensusService {
  private static instance: GazillionConsensusService;

  private constructor() {}

  public static getInstance(): GazillionConsensusService {
    if (!GazillionConsensusService.instance) {
      GazillionConsensusService.instance = new GazillionConsensusService();
    }
    return GazillionConsensusService.instance;
  }

  /**
   * Run a full consensus debate for a token
   */
  public async runDebate(token: TokenContext): Promise<ConsensusResult | null> {
    console.log(`🚀 [GI-Consensus] Starting War Room debate for $${token.tokenSymbol}...`);
    
    // 1. Parallel Batch Phase (Scout & Analyst can work in parallel on the raw data)
    const prompts = [
      this.buildAgentPrompt(ConsensusAgent.SCOUT, token, []),
      this.buildAgentPrompt(ConsensusAgent.ANALYST, token, [])
    ];
    
    const [scoutMsg, analystMsg] = await llmService.generateBatch(prompts);
    
    if (!scoutMsg || !analystMsg) return null;

    const scoutResponse: DebateMessage = {
      role: ConsensusAgent.SCOUT,
      name: '🛰️ The Scout',
      message: scoutMsg,
      sentiment: scoutMsg.includes('BULLISH') ? 'BULLISH' : 'NEUTRAL'
    };

    const analystResponse: DebateMessage = {
      role: ConsensusAgent.ANALYST,
      name: '🛡️ The Analyst',
      message: analystMsg,
      sentiment: analystMsg.includes('BEARISH') ? 'BEARISH' : 'NEUTRAL'
    };

    // 2. Sequential Synthesis (The General needs both takes)
    const generalResponse = await this.getAgentAnalysis(ConsensusAgent.GENERAL, token, [scoutResponse, analystResponse]);
    if (!generalResponse) return null;

    const debate = [scoutResponse, analystResponse, generalResponse];
    
    // Parse General's decision
    const decisionMatch = generalResponse.message.match(/DECISION:\s*(BUY|WAIT|REJECT)/i);
    const confidenceMatch = generalResponse.message.match(/CONFIDENCE:\s*(\d+)/i);
    
    const result: ConsensusResult = {
      decision: (decisionMatch ? decisionMatch[1].toUpperCase() : 'WAIT') as any,
      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 50,
      reasoning: generalResponse.message,
      debate
    };

    // Broadcast the debate to the War Room UI
    websocketEvents.broadcastFeedEvent('war-room', {
      type: 'consensus:update',
      tokenMint: token.tokenMint,
      result
    });

    return result;
  }

  private async getAgentAnalysis(
    role: ConsensusAgent, 
    token: TokenContext, 
    history: DebateMessage[] = []
  ): Promise<DebateMessage | null> {
    const agentPrompt = this.buildAgentPrompt(role, token, history);
    const response = await llmService.generate(agentPrompt.system, agentPrompt.user, { temperature: 0.7 });
    
    if (!response) return null;

    // Simplified parser for now
    const sentiment = response.includes('BULLISH') ? 'BULLISH' : response.includes('BEARISH') ? 'BEARISH' : 'NEUTRAL';
    const name = role === ConsensusAgent.SCOUT ? '🛰️ The Scout' : role === ConsensusAgent.ANALYST ? '🛡️ The Analyst' : '⚔️ The General';

    return {
      role,
      name,
      message: response,
      sentiment
    };
  }

  private buildAgentPrompt(role: ConsensusAgent, token: TokenContext, history: DebateMessage[]) {
    const symbol = token.tokenSymbol || 'UNKNOWN';
    const historyBlock = history.map(m => `${m.name}: ${m.message}`).join('\n\n');

    let system = '';
    let user = `Analysis for $${symbol}.\nStats: MCAP $${token.marketCap}, LIQ $${token.liquidity}, 24h Vol $${token.volume24h}.`;

    switch (role) {
      case ConsensusAgent.SCOUT:
        system = `You are "The Scout", a narrative specialist. Your job is to analyze the social heat and trend alignment of a token. Be quick, sharp, and look for "viral" signals.`;
        break;
      case ConsensusAgent.ANALYST:
        system = `You are "The Analyst", a risk specialist. Your job is to find reasons NOT to buy. Look for thin liquidity, "rug" patterns, or suspicious volume. React to The Scout's analysis.`;
        break;
      case ConsensusAgent.GENERAL:
        system = `You are "The General", the decision maker. Synthesize the reports from The Scout and The Analyst. Make a final call.
        MUST INCLUDE:
        DECISION: [BUY/WAIT/REJECT]
        CONFIDENCE: [0-100]`;
        break;
    }

    return {
      system,
      user: history.length > 0 ? `${user}\n\nPREVIOUS DEBATE:\n${historyBlock}\n\nYour turn.` : user
    };
  }
}

export const giConsensus = GazillionConsensusService.getInstance();
