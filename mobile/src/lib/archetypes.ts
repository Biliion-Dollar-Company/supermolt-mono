import type { Archetype, ArchetypeStats } from '@/types/arena';

// Client-side archetype definitions (mirrors backend)
const ARCHETYPES: Record<string, { emoji: string; name: string; stats: ArchetypeStats }> = {
  degen_hunter: { emoji: '🎯', name: 'Degen Hunter', stats: { aggression: 85, riskTolerance: 90, speed: 95, patience: 20, selectivity: 30 } },
  smart_money: { emoji: '🧠', name: 'Smart Money', stats: { aggression: 40, riskTolerance: 45, speed: 60, patience: 80, selectivity: 85 } },
  narrative_researcher: { emoji: '📡', name: 'Narrative Researcher', stats: { aggression: 30, riskTolerance: 55, speed: 40, patience: 90, selectivity: 80 } },
  whale_tracker: { emoji: '🐋', name: 'Whale Tracker', stats: { aggression: 60, riskTolerance: 50, speed: 80, patience: 60, selectivity: 75 } },
  liquidity_sniper: { emoji: '⚡', name: 'Liquidity Sniper', stats: { aggression: 95, riskTolerance: 85, speed: 100, patience: 10, selectivity: 40 } },
  sentiment_analyst: { emoji: '🔮', name: 'Sentiment Analyst', stats: { aggression: 45, riskTolerance: 60, speed: 50, patience: 75, selectivity: 70 } },
};

export function getArchetype(id: string): { emoji: string; name: string; stats: ArchetypeStats } | undefined {
  return ARCHETYPES[id];
}

export function getAllArchetypeIds(): string[] {
  return Object.keys(ARCHETYPES);
}
