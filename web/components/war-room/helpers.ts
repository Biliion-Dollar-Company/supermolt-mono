import type { AgentData, AgentState, TokenStation, Conversation } from './types';

export function minsAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

export function fmtMinsAgo(date: Date): string {
  const m = minsAgo(date);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function getBubbleText(trustScore: number): string {
  if (trustScore > 0.95) {
    return Math.random() < 0.5 ? 'ALPHA SIGNAL' : 'SMART MONEY IN';
  } else if (trustScore >= 0.7) {
    return Math.random() < 0.5 ? 'Analyzing...' : 'Watching closely';
  } else {
    return Math.random() < 0.5 ? 'Risky...' : 'Uncertain';
  }
}

export function getAvatarUrl(agent: AgentData): string {
  if (agent.pfpUrl) return agent.pfpUrl;
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${agent.id}&backgroundColor=0a0a0a&radius=50`;
}

export function generateHeadlines(
  agents: AgentState[],
  stations: TokenStation[],
  conversations: Conversation[],
): string[] {
  const headlines: string[] = [];

  agents.forEach((ag) => {
    if (ag.data.trustScore > 0.95) {
      const target = stations[ag.targetStationIdx];
      if (target) {
        headlines.push(
          `ALPHA SIGNAL — ${ag.data.name} entering ${target.ticker} | ${Math.round(ag.data.winRate * 100)}% win rate`,
        );
      }
    }
  });

  const stationCounts: Record<number, AgentState[]> = {};
  agents.forEach((ag) => {
    if (ag.arrived) {
      if (!stationCounts[ag.currentStationIdx]) stationCounts[ag.currentStationIdx] = [];
      stationCounts[ag.currentStationIdx].push(ag);
    }
  });
  Object.entries(stationCounts).forEach(([idx, ags]) => {
    if (ags.length >= 2) {
      const st = stations[Number(idx)];
      if (st) {
        headlines.push(`COORDINATED SIGNAL — ${ags.length} smart money wallets on ${st.ticker}`);
      }
    }
  });

  conversations.slice(0, 2).forEach((conv) => {
    if (conv.lastMessage) {
      const excerpt = conv.lastMessage.length > 60
        ? conv.lastMessage.slice(0, 60) + '...'
        : conv.lastMessage;
      headlines.push(`INTEL: "${excerpt}"`);
    }
  });

  stations.filter((s) => s.isNew).forEach((s) => {
    headlines.push(`NEW GRADUATION — ${s.ticker} just hit pump.fun | Smart money scanning`);
  });

  return headlines.length > 0
    ? headlines
    : [`MONITORING — ${agents.length} whale wallets active | Season 1 live`];
}

/** Format a number compactly: 1234567 → "$1.23M", 45600 → "$45.6K" */
export function fmtCompact(n: number, prefix = '$'): string {
  if (n >= 1_000_000_000) return `${prefix}${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `${prefix}${n.toFixed(2)}`;
  if (n >= 0.001) return `${prefix}${n.toFixed(4)}`;
  return `${prefix}${n.toFixed(6)}`;
}

/** Format price change: +12.5% or -3.2% */
export function fmtChange(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
