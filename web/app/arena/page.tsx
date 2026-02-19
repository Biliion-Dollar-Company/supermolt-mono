'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Swords } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { EventFeed, AgentHoverCard, IntelBrief } from '@/components/war-room';
import type { AgentData, FeedEvent, HoveredAgentInfo } from '@/components/war-room';

const RisingLines = dynamic(() => import('@/components/react-bits/rising-lines'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

// Dynamic import for PixiJS component (no SSR)
const WarRoomCanvas = dynamic(() => import('@/components/war-room/WarRoomCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-black">
      <div
        className="text-xs uppercase tracking-widest"
        style={{ color: 'rgba(232,180,94,0.5)', fontFamily: 'JetBrains Mono, monospace' }}
      >
        Initializing War Room...
      </div>
    </div>
  ),
});

// ─── DevPrint Wallet shape ────────────────────────────────────────────────────

interface DevPrintWallet {
  id: string;
  address: string;
  label: string | null;
  trust_score: number;
  winning_trades: number;
  total_trades: number;
  avg_return_pct: number;
  best_trade_pct?: number | null;
  pfp_url?: string | null;
  twitter_handle?: string | null;
  notes?: string | null;
}

// ─── Fallback agents (used only if DevPrint API is unreachable) ───────────────

const FALLBACK_AGENTS: AgentData[] = [
  {
    id: 'alpha',
    name: 'Dune-Whale-1',
    rank: 1,
    winRate: 0.986,
    pnl: 33854,
    totalTrades: 71,
    trustScore: 0.994,
    bestTradePct: 38153,
    color: 0xe8b45e,
    notes: '$210k profit, 1619 SOL balance ($261k portfolio). Selective whale.',
  },
  {
    id: 'beta',
    name: 'GH7x...3kR2',
    rank: 2,
    winRate: 0.981,
    pnl: 568,
    totalTrades: 54,
    trustScore: 0.992,
    bestTradePct: 987,
    color: 0xffffff,
  },
  {
    id: 'gamma',
    name: 'SmartMoney-3',
    rank: 3,
    winRate: 0.72,
    pnl: 320,
    totalTrades: 25,
    trustScore: 0.80,
    color: 0xffffff,
  },
  {
    id: 'delta',
    name: 'SolTracker-X',
    rank: 4,
    winRate: 0.60,
    pnl: 180,
    totalTrades: 20,
    trustScore: 0.65,
    color: 0xffffff,
  },
  {
    id: 'epsilon',
    name: 'DegenAlpha',
    rank: 5,
    winRate: 0.50,
    pnl: 90,
    totalTrades: 14,
    trustScore: 0.50,
    color: 0xffffff,
  },
];

function walletsToAgents(wallets: DevPrintWallet[]): AgentData[] {
  const top5 = [...wallets]
    .sort((a, b) => b.trust_score - a.trust_score)
    .slice(0, 5);

  return top5.map((w, i) => {
    const shortAddr = w.address.slice(0, 6) + '…' + w.address.slice(-4);
    const name = w.label ?? shortAddr;
    const winRate = w.total_trades > 0 ? w.winning_trades / w.total_trades : 0;
    const isGold  = w.trust_score > 0.95;

    return {
      id:             w.id || w.address,
      name,
      rank:           i + 1,
      winRate,
      pnl:            w.avg_return_pct,
      totalTrades:    w.total_trades,
      trustScore:     w.trust_score,
      color:          isGold ? 0xe8b45e : 0xffffff,
      pfpUrl:         w.pfp_url ?? undefined,
      twitterHandle:  w.twitter_handle ?? undefined,
      notes:          w.notes ?? undefined,
      bestTradePct:   w.best_trade_pct ?? undefined,
    };
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArenaPage() {
  const isMobile = useIsMobile();
  const [agents,  setAgents]  = useState<AgentData[]>(FALLBACK_AGENTS);
  const [events,  setEvents]  = useState<FeedEvent[]>([]);
  const [hovered, setHovered] = useState<HoveredAgentInfo | null>(null);

  // ── Fetch whale wallets from DevPrint every 60s ───────────────────────────
  useEffect(() => {
    const fetchWallets = async () => {
      try {
        const res = await fetch('https://devprint-v2-production.up.railway.app/api/wallets');
        if (!res.ok) return;
        const json = await res.json() as { success: boolean; data: { wallets: DevPrintWallet[] } };
        const wallets: DevPrintWallet[] = json?.data?.wallets ?? [];
        if (wallets.length > 0) {
          setAgents(walletsToAgents(wallets));
        }
      } catch {
        // silently keep fallback data on failure
      }
    };

    fetchWallets();
    const interval = setInterval(fetchWallets, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleEvent = useCallback((evt: FeedEvent) => {
    setEvents((prev) => {
      const next = [...prev, evt];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
  }, []);

  const handleAgentHover = useCallback((info: HoveredAgentInfo | null) => {
    setHovered(info);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#000000' }}>
      {/* Animated background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.60) 15%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.95) 100%)',
          }}
        />
        {!isMobile && (
          <div className="absolute inset-0 opacity-20">
            <RisingLines
              color="#E8B45E"
              horizonColor="#E8B45E"
              haloColor="#F5D78E"
              riseSpeed={0.05}
              riseScale={8.0}
              riseIntensity={1.0}
              flowSpeed={0.1}
              flowDensity={3.5}
              flowIntensity={0.5}
              horizonIntensity={0.7}
              haloIntensity={5.0}
              horizonHeight={-0.85}
              circleScale={-0.5}
              scale={6.5}
              brightness={0.9}
            />
          </div>
        )}
      </div>

      {/* Header bar */}
      <div
        className="relative z-10 flex items-center gap-3 px-4 sm:px-6 py-3 flex-shrink-0"
        style={{
          borderBottom: '1px solid rgba(232,180,94,0.2)',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Swords className="w-5 h-5 text-accent-primary" />
        <div>
          <h1 className="text-lg font-bold text-text-primary leading-tight">Arena</h1>
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: 'rgba(232,180,94,0.6)', fontFamily: 'JetBrains Mono, monospace' }}
          >
            WAR ROOM — Observer Mode
          </p>
        </div>

        {/* Live indicator */}
        <div className="ml-auto flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: '#00ff41',
              boxShadow: '0 0 8px #00ff41',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: '#00ff41', fontFamily: 'JetBrains Mono, monospace' }}
          >
            LIVE
          </span>
          <span
            className="text-xs ml-2"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {agents.length} agents
          </span>
        </div>
      </div>

      {/* Main content: canvas + sidebar */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* PixiJS War Room Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <WarRoomCanvas
            agents={agents}
            onEvent={handleEvent}
            onAgentHover={handleAgentHover}
          />

          {/* Agent hover card HTML overlay */}
          {hovered && (
            <AgentHoverCard
              agent={hovered.agent}
              x={hovered.x}
              y={hovered.y}
              currentStation={hovered.currentStation}
            />
          )}
        </div>

        {/* Right panel (300px): Intel Brief + Live Feed — hidden on mobile */}
        <div
          className="hidden sm:flex flex-col flex-shrink-0 h-full"
          style={{
            width: '300px',
            minWidth: '300px',
            background: '#0A0A0A',
            borderLeft: '1px solid rgba(232, 180, 94, 0.3)',
          }}
        >
          {/* Top 40%: INTEL BRIEF narrative */}
          <IntelBrief agents={agents} events={events} />

          {/* Bottom 60%: LIVE FEED */}
          <div
            className="flex flex-col"
            style={{ height: '60%', minHeight: 0 }}
          >
            {/* Live Feed header */}
            <div
              className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(232, 180, 94, 0.2)' }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  background: '#00ff41',
                  boxShadow: '0 0 6px #00ff41',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <h2
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: '#E8B45E', fontFamily: 'JetBrains Mono, monospace' }}
              >
                Live Feed
              </h2>
              <span
                className="ml-auto text-xs"
                style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}
              >
                {events.length} events
              </span>
            </div>
            {/* Scrollable feed — EventFeed without its own header */}
            <div
              className="flex-1"
              style={{
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <EventFeed events={events} hideHeader />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile event feed — bottom strip */}
      {isMobile && (
        <div
          className="relative z-10 flex-shrink-0"
          style={{
            height: '120px',
            borderTop: '1px solid rgba(232,180,94,0.2)',
            background: '#0A0A0A',
            overflowY: 'auto',
          }}
        >
          <div
            className="px-3 py-1 text-xs font-bold uppercase tracking-widest"
            style={{ color: '#E8B45E', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Live Feed
          </div>
          {events.slice(-8).reverse().map((evt, i) => (
            <div
              key={i}
              className="px-3 py-1 text-xs flex items-center gap-2"
              style={{ fontFamily: 'JetBrains Mono, monospace', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
            >
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px' }}>{evt.timestamp}</span>
              <span
                style={{
                  color: evt.action === 'BUY' ? '#00ff41' : evt.action === 'SELL' ? '#ff0033' : '#ffaa00',
                  fontWeight: '700',
                  fontSize: '9px',
                }}
              >
                {evt.action}
              </span>
              <span style={{ color: '#E8B45E' }}>{evt.agentName}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{evt.token}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

