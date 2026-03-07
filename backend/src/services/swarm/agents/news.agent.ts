/**
 * News Agent — Specialization: News/geopolitical signal matching
 * Matches market questions to Glint OSINT signals via keyword extraction
 */

import { AgentVote, MarketSignal, AgentContext, NewsSignal } from '../swarm.types';

const AGENT_ID = 'swarm-news';

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter((word) => !STOP_WORDS.has(word));
}

const STOP_WORDS = new Set([
  'will', 'does', 'this', 'that', 'with', 'from', 'have', 'been',
  'what', 'when', 'where', 'which', 'there', 'their', 'about',
  'would', 'could', 'should', 'before', 'after', 'above', 'below',
  'between', 'through', 'during', 'each', 'than', 'more', 'most',
  'other', 'some', 'such', 'only', 'over', 'also', 'into',
]);

const POSITIVE_INDICATORS = [
  'confirmed', 'approved', 'passed', 'signed', 'announced', 'wins',
  'victory', 'succeeds', 'breaks', 'surges', 'rallies', 'launches',
  'completed', 'achieved', 'record', 'breakthrough',
];

const NEGATIVE_INDICATORS = [
  'denied', 'rejected', 'failed', 'cancelled', 'postponed', 'blocked',
  'crashes', 'plunges', 'collapses', 'loses', 'defeat', 'suspended',
  'withdrawn', 'abandoned', 'scrapped', 'delayed',
];

function scoreRelevance(marketKeywords: string[], signalKeywords: string[]): number {
  const marketSet = new Set(marketKeywords);
  let matches = 0;
  for (const kw of signalKeywords) {
    if (marketSet.has(kw)) matches++;
  }
  if (matches === 0) return 0;
  if (matches >= 3) return 1.0;
  if (matches >= 2) return 0.75;
  return 0.5;
}

function detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const posCount = POSITIVE_INDICATORS.filter((w) => lower.includes(w)).length;
  const negCount = NEGATIVE_INDICATORS.filter((w) => lower.includes(w)).length;
  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

export async function analyze(signal: MarketSignal, context?: AgentContext): Promise<AgentVote> {
  const newsSignals = context?.newsSignals;

  if (!newsSignals || newsSignals.length === 0) {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: 0,
      reasoning: 'No news signals available for analysis',
    };
  }

  const marketKeywords = extractKeywords(signal.question);
  let bestRelevance = 0;
  let bestSignal: NewsSignal | null = null;

  for (const ns of newsSignals) {
    const signalKeywords = extractKeywords(ns.text);
    const relevance = scoreRelevance(marketKeywords, signalKeywords);
    if (relevance > bestRelevance) {
      bestRelevance = relevance;
      bestSignal = ns;
    }
  }

  if (bestRelevance < 0.5 || !bestSignal) {
    return {
      agentId: AGENT_ID,
      vote: 'ABSTAIN',
      confidence: 0.1,
      reasoning: `No relevant news found for "${signal.question.slice(0, 60)}..." (best relevance: ${(bestRelevance * 100).toFixed(0)}%)`,
    };
  }

  const sentiment = detectSentiment(bestSignal.text);
  const confidenceMultiplier = bestSignal.confidenceScore / 10; // 1-10 -> 0.1-1.0
  const confidence = Math.min(1, bestRelevance * confidenceMultiplier);

  if (sentiment === 'positive') {
    return {
      agentId: AGENT_ID,
      vote: 'YES',
      confidence,
      reasoning: `News signal supports YES: "${bestSignal.text.slice(0, 100)}..." (relevance: ${(bestRelevance * 100).toFixed(0)}%, source: ${bestSignal.source})`,
    };
  }

  if (sentiment === 'negative') {
    return {
      agentId: AGENT_ID,
      vote: 'NO',
      confidence,
      reasoning: `News signal supports NO: "${bestSignal.text.slice(0, 100)}..." (relevance: ${(bestRelevance * 100).toFixed(0)}%, source: ${bestSignal.source})`,
    };
  }

  return {
    agentId: AGENT_ID,
    vote: 'ABSTAIN',
    confidence: 0.15,
    reasoning: `Relevant news found but sentiment is neutral: "${bestSignal.text.slice(0, 80)}..."`,
  };
}
