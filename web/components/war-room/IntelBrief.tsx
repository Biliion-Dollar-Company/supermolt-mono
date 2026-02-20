'use client';

import { useEffect, useState, useRef } from 'react';
import type { AgentData, FeedEvent } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StationInfo {
  ticker: string;
  name: string;
  detectedAt?: Date;
  isNew?: boolean;
  agentCount?: number;
}

interface IntelBriefProps {
  agents: AgentData[];
  events: FeedEvent[];
  /** Optional station data passed from parent if available */
  stations?: StationInfo[];
}

// ─── Narrative generators ─────────────────────────────────────────────────────

function formatWinRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function timeSinceMs(date: Date): number {
  return Date.now() - date.getTime();
}

function minsAgo(date: Date): number {
  return Math.floor(timeSinceMs(date) / 60_000);
}

function buildNarrative(
  agents: AgentData[],
  events: FeedEvent[],
  stations: StationInfo[],
): string {
  const now = Date.now();

  // ── Scenario 1: Multiple high-trust agents at same token ──────────────────
  // Look at recent events (last 30s) to find convergence
  const recentEvents = events.slice(-20);
  const tokenCounts: Record<string, { agents: AgentData[]; action: string }> = {};

  recentEvents.forEach((evt) => {
    const agent = agents.find((a) => a.name === evt.agentName);
    if (!agent) return;
    if (!tokenCounts[evt.token]) {
      tokenCounts[evt.token] = { agents: [], action: evt.action };
    }
    // avoid duplicates
    if (!tokenCounts[evt.token].agents.find((a) => a.id === agent.id)) {
      tokenCounts[evt.token].agents.push(agent);
      tokenCounts[evt.token].action = evt.action;
    }
  });

  // Find the token with most agents converging
  const convergenceEntries = Object.entries(tokenCounts)
    .filter(([, { agents: ags }]) => ags.length >= 2)
    .sort((a, b) => b[1].agents.length - a[1].agents.length);

  if (convergenceEntries.length > 0) {
    const [token, { agents: convAgents }] = convergenceEntries[0];
    const topAgent = [...convAgents].sort((a, b) => b.trustScore - a.trustScore)[0];
    const isTop5 = agents.indexOf(topAgent) < 5;
    const highTrust = convAgents.filter((a) => a.trustScore > 0.9);

    if (highTrust.length >= 2) {
      return (
        `Smart money consensus is forming around ${token}. ` +
        `${convAgents.length} of our tracked wallets are converging simultaneously — ` +
        `${topAgent.name} (${formatWinRate(topAgent.winRate)} win rate) is leading the move. ` +
        `This convergence pattern has historically preceded significant price action.`
      );
    } else if (convAgents.length >= 2 && isTop5) {
      return (
        `${convAgents.length} wallets are simultaneously scanning ${token}. ` +
        `${topAgent.name} is the highest-conviction entry here with a ` +
        `${formatWinRate(topAgent.winRate)} win rate. Watch for a coordinated entry signal.`
      );
    }
  }

  // ── Scenario 2: Whale first-mover on a new token ─────────────────────────
  const newStations = stations.filter((s) => s.isNew && s.detectedAt);
  if (newStations.length > 0 && events.length > 0) {
    const latestNewStation = newStations.sort((a, b) => {
      const aMs = a.detectedAt ? timeSinceMs(a.detectedAt) : Infinity;
      const bMs = b.detectedAt ? timeSinceMs(b.detectedAt) : Infinity;
      return aMs - bMs;
    })[0];

    // Find agents that have visited this token
    const visitingAgents = recentEvents
      .filter((e) => e.token === latestNewStation.ticker)
      .map((e) => agents.find((a) => a.name === e.agentName))
      .filter((a): a is AgentData => Boolean(a));

    const whaleVisitors = visitingAgents.filter((a) => a.trustScore > 0.9);

    if (whaleVisitors.length > 0) {
      const topWhale = [...whaleVisitors].sort((a, b) => b.trustScore - a.trustScore)[0];
      const ageMin = latestNewStation.detectedAt
        ? minsAgo(latestNewStation.detectedAt)
        : 0;
      const ageStr = ageMin < 1 ? 'just now' : `${ageMin} minute${ageMin !== 1 ? 's' : ''} ago`;

      return (
        `${whaleVisitors.length} whale wallet${whaleVisitors.length > 1 ? 's' : ''} ` +
        `${whaleVisitors.length > 1 ? 'are' : 'is'} currently analyzing ${latestNewStation.ticker}, ` +
        `which graduated pump.fun ${ageStr}. ` +
        `${topWhale.name} (${formatWinRate(topWhale.winRate)} win rate) is the first mover — ` +
        `historically this wallet enters before major moves.`
      );
    } else if (latestNewStation.detectedAt) {
      const ageMin = minsAgo(latestNewStation.detectedAt);
      const ageStr = ageMin < 1 ? 'just now' : `${ageMin}m ago`;
      return (
        `Fresh graduation detected: ${latestNewStation.ticker} just hit pump.fun ${ageStr}. ` +
        `Smart money wallets are beginning their scan. ` +
        `No whale conviction signal yet — watching for first-mover entry.`
      );
    }
  }

  // ── Scenario 3: Active high-trust agent movement ──────────────────────────
  const whaleAgents = agents.filter((a) => a.trustScore > 0.92);
  if (whaleAgents.length > 0 && events.length > 0) {
    const lastEvent = events[events.length - 1];
    const lastAgent = agents.find((a) => a.name === lastEvent?.agentName);

    if (lastAgent && lastAgent.trustScore > 0.92) {
      const actionVerb =
        lastEvent.action === 'BUY'
          ? 'taking a position in'
          : lastEvent.action === 'SELL'
          ? 'exiting'
          : 'running deep analysis on';

      return (
        `HIGH CONVICTION SIGNAL — ${lastAgent.name} (${formatWinRate(lastAgent.winRate)} win rate, ` +
        `trust score ${Math.round(lastAgent.trustScore * 100)}/100) is ${actionVerb} ` +
        `${lastEvent.token}. This wallet ranks #${lastAgent.rank} globally and has a ` +
        `track record of entering before major moves. All eyes on ${lastEvent.token}.`
      );
    }

    // General whale activity
    const topWhale = whaleAgents.sort((a, b) => b.trustScore - a.trustScore)[0];
    const topWhaleEvent = [...events]
      .reverse()
      .find((e) => e.agentName === topWhale.name);

    if (topWhaleEvent) {
      return (
        `${topWhale.name} — our highest-trust wallet (${formatWinRate(topWhale.winRate)} win rate) — ` +
        `is currently scanning ${topWhaleEvent.token}. ` +
        `${whaleAgents.length} whale wallet${whaleAgents.length > 1 ? 's' : ''} active across the map. ` +
        `Monitoring for coordinated entry signals.`
      );
    }
  }

  // ── Scenario 4: Multiple BUY signals on same token ───────────────────────
  const recentBuys = recentEvents.filter((e) => e.action === 'BUY');
  const buyTokenCounts: Record<string, number> = {};
  recentBuys.forEach((e) => {
    buyTokenCounts[e.token] = (buyTokenCounts[e.token] ?? 0) + 1;
  });
  const hotBuyToken = Object.entries(buyTokenCounts).sort((a, b) => b[1] - a[1])[0];

  if (hotBuyToken && hotBuyToken[1] >= 2) {
    const [buyToken, count] = hotBuyToken;
    return (
      `ACCUMULATION DETECTED — ${count} independent BUY signals on ${buyToken} in the last cycle. ` +
      `When multiple wallets in our tracked set align on the same side, it often signals ` +
      `a coordinated entry. Position sizing and timing remain key — conviction is building.`
    );
  }

  // ── Scenario 5: Quiet map ─────────────────────────────────────────────────
  if (events.length === 0) {
    return (
      `War Room is initializing. ${agents.length} whale wallet${agents.length !== 1 ? 's' : ''} ` +
      `are being tracked in real-time. Waiting for the first signals to come in — ` +
      `agents are deploying across the map and scanning for alpha.`
    );
  }

  const recentAnalyzing = recentEvents.filter((e) => e.action === 'ANALYZING').length;
  if (recentAnalyzing >= 3) {
    const topToken = events[events.length - 1]?.token ?? 'multiple tokens';
    return (
      `The map is scanning. ${recentAnalyzing} ANALYZING signals in the last cycle with no ` +
      `firm conviction yet — wallets are circling ${topToken} and others without committing. ` +
      `No new pump.fun graduations detected in the last 10 minutes. Quiet before the storm?`
    );
  }

  // Default fallback: general activity summary
  const uniqueTokens = [...new Set(recentEvents.map((e) => e.token))];
  const uniqueAgents = [...new Set(recentEvents.map((e) => e.agentName))];

  return (
    `${uniqueAgents.length} wallet${uniqueAgents.length !== 1 ? 's' : ''} active — ` +
    `scanning ${uniqueTokens.length} token${uniqueTokens.length !== 1 ? 's' : ''} ` +
    `(${uniqueTokens.slice(0, 3).join(', ')}${uniqueTokens.length > 3 ? '…' : ''}). ` +
    `No dominant signal yet. Tracking consensus formation across tracked wallets. ` +
    `Next update in ${15 - (Math.floor(Date.now() / 1000) % 15)}s.`
  );
}

// ─── Blinking cursor component ────────────────────────────────────────────────

function BlinkingCursor() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '7px',
        height: '12px',
        background: '#E8B45E',
        marginLeft: '2px',
        verticalAlign: 'middle',
        animation: 'blink-cursor 1s step-end infinite',
      }}
    />
  );
}

// ─── Typewriter effect hook ───────────────────────────────────────────────────

function useTypewriter(text: string, speed = 18): { displayed: string; done: boolean } {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const prevText = useRef('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    if (text === prevText.current) return;
    prevText.current = text;
    indexRef.current = 0;
    setDisplayed('');
    setDone(false);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setDone(true);
      }
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed]);

  return { displayed, done };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntelBrief({ agents, events, stations = [] }: IntelBriefProps) {
  const [narrative, setNarrative] = useState('');
  const [updateCount, setUpdateCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { displayed, done } = useTypewriter(narrative, 16);

  // Generate initial narrative and refresh every 15s
  useEffect(() => {
    const generate = () => {
      const text = buildNarrative(agents, events, stations);
      setNarrative(text);
      setLastUpdated(new Date());
      setUpdateCount((n) => n + 1);
    };

    generate();
    const interval = setInterval(generate, 15_000);
    return () => clearInterval(interval);
  }, [agents, events, stations]);

  // Determine signal level for color coding
  const signalLevel = (() => {
    if (
      narrative.includes('ALPHA SIGNAL') ||
      narrative.includes('HIGH CONVICTION') ||
      narrative.includes('consensus is forming') ||
      narrative.includes('ACCUMULATION DETECTED')
    ) {
      return 'high';
    }
    if (
      narrative.includes('scanning') ||
      narrative.includes('analyzing') ||
      narrative.includes('Monitoring')
    ) {
      return 'medium';
    }
    return 'low';
  })();

  const signalColor =
    signalLevel === 'high'
      ? '#E8B45E'
      : signalLevel === 'medium'
      ? '#ffaa00'
      : 'rgba(255,255,255,0.45)';

  const signalLabel =
    signalLevel === 'high'
      ? '◆ HIGH SIGNAL'
      : signalLevel === 'medium'
      ? '◇ SCANNING'
      : '○ QUIET';

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  return (
    <>
      {/* Inject blink animation once */}
      <style>{`
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      <div
        className="flex flex-col"
        style={{
          height: '40%',
          minHeight: '160px',
          borderBottom: '1px solid rgba(232,180,94,0.25)',
          background: '#080808',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
          style={{
            borderBottom: '1px solid rgba(232,180,94,0.15)',
            background: '#050505',
          }}
        >
          {/* Signal indicator dot */}
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: signalColor,
              boxShadow: `0 0 6px ${signalColor}`,
              flexShrink: 0,
              animation:
                signalLevel === 'high'
                  ? 'pulse 1s ease-in-out infinite'
                  : 'none',
            }}
          />
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              fontWeight: '800',
              letterSpacing: '2px',
              color: '#E8B45E',
              flex: 1,
            }}
          >
            INTEL BRIEF
          </span>
          {/* Signal level badge */}
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '8px',
              fontWeight: '700',
              color: signalColor,
              letterSpacing: '1px',
            }}
          >
            {signalLabel}
          </span>
        </div>

        {/* Narrative text area */}
        <div
          className="flex-1 overflow-hidden px-4 py-3"
          style={{ position: 'relative' }}
        >
          {/* Ambient glow behind text */}
          {signalLevel === 'high' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse at 50% 50%, rgba(232,180,94,0.04) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
          )}

          <p
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10.5px',
              lineHeight: '1.65',
              color: 'rgba(255,255,255,0.82)',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {displayed}
            {!done && <BlinkingCursor />}
          </p>
        </div>

        {/* Footer: timestamp + refresh counter */}
        <div
          className="flex items-center justify-between px-4 py-1.5 flex-shrink-0"
          style={{
            borderTop: '1px solid rgba(232,180,94,0.08)',
            background: '#040404',
          }}
        >
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '8px',
              color: 'rgba(255,255,255,0.2)',
              letterSpacing: '0.5px',
            }}
          >
            LAST UPDATE {timeStr}
          </span>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '8px',
              color: 'rgba(232,180,94,0.3)',
              letterSpacing: '0.5px',
            }}
          >
            AUTO-REFRESH 15s #{updateCount}
          </span>
        </div>
      </div>
    </>
  );
}
