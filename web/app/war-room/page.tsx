'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Swords } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { EventFeed, AgentHoverCard, IntelBrief } from '@/components/war-room';
import type { AgentData, FeedEvent, HoveredAgentInfo, StationInfo, ScannerCallData, ScannerCallsMap } from '@/components/war-room';
import { SCANNER_IDS } from '@/components/war-room/constants';

const WarpTwister = dynamic(() => import('@/components/react-bits/warp-twister'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

// Dynamic import for PixiJS component (no SSR)
const WarRoomCanvas = dynamic(() => import('@/components/war-room/WarRoomCanvas'), {
  ssr: false,
  loading: () => null,
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
    pfpUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=alpha-whale&backgroundColor=0a0a0a&radius=50',
    notes: '$210k profit, 1619 SOL balance ($261k portfolio). Selective whale.',
  },
  {
    id: 'beta',
    name: 'Silent Orca',
    rank: 2,
    winRate: 0.981,
    pnl: 568,
    totalTrades: 54,
    trustScore: 0.992,
    bestTradePct: 987,
    color: 0xffffff,
    pfpUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=silent-orca&backgroundColor=0a0a0a&radius=50',
  },
  {
    id: 'gamma',
    name: 'Deep Lurker',
    rank: 3,
    winRate: 0.72,
    pnl: 320,
    totalTrades: 25,
    trustScore: 0.80,
    color: 0xffffff,
    pfpUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=deep-lurker&backgroundColor=0a0a0a&radius=50',
  },
  {
    id: 'delta',
    name: 'Shadow Fund',
    rank: 4,
    winRate: 0.60,
    pnl: 180,
    totalTrades: 20,
    trustScore: 0.65,
    color: 0xffffff,
    pfpUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=shadow-fund&backgroundColor=0a0a0a&radius=50',
  },
  {
    id: 'epsilon',
    name: 'Apex Hunter',
    rank: 5,
    winRate: 0.50,
    pnl: 90,
    totalTrades: 14,
    trustScore: 0.50,
    color: 0xffffff,
    pfpUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=apex-hunter&backgroundColor=0a0a0a&radius=50',
  },
];

const WHALE_NAMES = [
  'Ghost Whale', 'Silent Orca', 'Deep Lurker', 'Shadow Fund',
  'Apex Hunter', 'Iron Hands', 'Night Shark', 'Void Walker',
  'Storm Rider', 'Neon Whale', 'Titan Alpha', 'Frost Giant',
];

function walletsToAgents(wallets: DevPrintWallet[]): AgentData[] {
  const top8 = [...wallets]
    .sort((a, b) => b.trust_score - a.trust_score)
    .slice(0, 8); // Match STATION_POSITIONS count for fuller canvas

  return top8.map((w, i) => {
    // Use label if available, otherwise assign a memorable codename
    const name = w.label ?? WHALE_NAMES[i % WHALE_NAMES.length];
    const winRate = w.total_trades > 0 ? w.winning_trades / w.total_trades : 0;
    const isGold = w.trust_score > 0.95;

    // Always generate a pfp — use dicebear with the wallet address as seed
    const pfp = w.pfp_url
      ?? `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${w.address}&backgroundColor=0a0a0a&radius=50`;

    return {
      id: w.id || w.address,
      name,
      rank: i + 1,
      winRate,
      pnl: w.avg_return_pct,
      totalTrades: w.total_trades,
      trustScore: w.trust_score,
      color: isGold ? 0xe8b45e : 0xffffff,
      pfpUrl: pfp,
      twitterHandle: w.twitter_handle ?? undefined,
      notes: w.notes ?? undefined,
      bestTradePct: w.best_trade_pct ?? undefined,
    };
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Loading stages ─────────────────────────────────────────────────────────

const LOADING_STAGES = [
  { key: 'wallets', label: 'Fetching intel on tracked wallets' },
  { key: 'pixi', label: 'Initializing render engine' },
  { key: 'tokens', label: 'Loading token stations' },
  { key: 'agents', label: 'Deploying agents' },
  { key: 'feeds', label: 'Connecting live feeds' },
] as const;

type StageKey = typeof LOADING_STAGES[number]['key'];

type ViewMode = 'war-room' | 'scanner-grid' | 'heat-map';

export default function ArenaPage() {
  const isMobile = useIsMobile();
  const [agents, setAgents] = useState<AgentData[]>(FALLBACK_AGENTS);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [hovered, setHovered] = useState<HoveredAgentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completedStages, setCompletedStages] = useState<Set<StageKey>>(new Set());
  const [activeStage, setActiveStage] = useState<StageKey>('wallets');
  const [stations, setStations] = useState<StationInfo[]>([]);
  const [scannerCalls, setScannerCalls] = useState<ScannerCallsMap>({});
  const [viewMode, setViewMode] = useState<ViewMode>('war-room');
  const prevScannerCallIdsRef = useRef<Set<string>>(new Set());

  const markStageComplete = useCallback((stage: StageKey) => {
    setCompletedStages((prev) => {
      const next = new Set(prev);
      next.add(stage);
      // Auto-advance active stage to next incomplete
      const nextStageIdx = LOADING_STAGES.findIndex((s) => s.key === stage) + 1;
      if (nextStageIdx < LOADING_STAGES.length) {
        setActiveStage(LOADING_STAGES[nextStageIdx].key);
      }
      // All done? Hide loading screen
      if (next.size >= LOADING_STAGES.length) {
        setTimeout(() => setIsLoading(false), 400);
      }
      return next;
    });
  }, []);

  // ── Fetch whale wallets from DevPrint every 60s ───────────────────────────
  useEffect(() => {
    const fetchWallets = async () => {
      try {
        const res = await fetch('/api/proxy/devprint/wallets');
        if (!res.ok) return;
        const json = await res.json() as { success: boolean; data: { wallets: DevPrintWallet[] } };
        const wallets: DevPrintWallet[] = json?.data?.wallets ?? [];
        if (wallets.length > 0) {
          setAgents(walletsToAgents(wallets));
        }
      } catch {
        // silently keep fallback data on failure
      } finally {
        markStageComplete('wallets');
      }
    };

    fetchWallets();
    const interval = setInterval(fetchWallets, 60_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lift station data from canvas ───────────────────────────────────────────
  const handleStationsReady = useCallback((s: StationInfo[]) => {
    setStations(s);
  }, []);

  // ── Scanner calls polling (every 30s) ─────────────────────────────────────
  useEffect(() => {
    const fetchScannerCalls = async () => {
      try {
        const allCalls: ScannerCallsMap = {};
        const results = await Promise.allSettled(
          SCANNER_IDS.map(async (id) => {
            const res = await fetch(`/api/proxy/scanner/calls?scannerId=${id}`);
            if (!res.ok) return [];
            const json = await res.json() as { calls?: ScannerCallData[] };
            return json.calls ?? [];
          }),
        );
        const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        results.forEach((r) => {
          if (r.status !== 'fulfilled') return;
          for (const call of r.value) {
            const addr = call.tokenAddress;
            if (!allCalls[addr]) allCalls[addr] = [];
            allCalls[addr].push(call);

            // Inject new scanner calls as feed events (avoid duplicates)
            if (!prevScannerCallIdsRef.current.has(call.id)) {
              prevScannerCallIdsRef.current.add(call.id);
              // Evict old IDs to prevent unbounded growth over long sessions
              if (prevScannerCallIdsRef.current.size > 500) {
                const iter = prevScannerCallIdsRef.current.values();
                for (let j = 0; j < 200; j++) iter.next();
                // Keep the newest 300 by rebuilding from remaining iterator
                const keep = new Set<string>();
                for (const v of iter) keep.add(v);
                prevScannerCallIdsRef.current = keep;
              }
              const sym = call.tokenSymbol ? `$${call.tokenSymbol}` : addr.slice(0, 8);
              const detail = call.reasoning?.[0] ?? '';
              setEvents((prev) => {
                const evt: FeedEvent = {
                  timestamp: now,
                  agentName: call.scannerName,
                  action: 'SCANNER_CALL',
                  token: sym,
                  detail: `${call.convictionScore.toFixed(2)} conviction${detail ? ` | ${detail}` : ''}`,
                };
                const next = [...prev, evt];
                return next.length > 50 ? next.slice(next.length - 50) : next;
              });
            }
          }
        });
        setScannerCalls(allCalls);
      } catch {
        // scanner data is optional — keep existing
      }
    };

    // Start after 3s (wait for initial load)
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const initialDelay = setTimeout(() => {
      fetchScannerCalls();
      intervalId = setInterval(fetchScannerCalls, 30_000);
    }, 3000);

    return () => {
      clearTimeout(initialDelay);
      if (intervalId) clearInterval(intervalId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Animated background — WarpTwister tunnel */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {!isMobile && !isLoading && (
          <div className="absolute inset-0 opacity-40">
            <WarpTwister
              radius={1.3}
              narrow={1.2}
              length={10}
              hazeSpeed={1.5}
              dustSpeed={0.55}
              hazeStrength={0.22}
              hazeFrequency={165}
              dustDensity={100}
              dustSize={70}
              dustOpacity={0.5}
              edgeFade={2}
              spiralTight={0.45}
              rotSpeed={0}
              baseColor={[0.91, 0.71, 0.37]}
              baseColorLight={[0.91, 0.71, 0.37]}
              cameraDistance={7.5}
            />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.40) 15%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0.92) 100%)',
          }}
        />
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

        {/* View mode selector */}
        <div className="ml-4 flex items-center gap-1">
          {(['war-room', 'scanner-grid', 'heat-map'] as ViewMode[]).map((mode) => {
            const labels: Record<ViewMode, string> = { 'war-room': 'War Room', 'scanner-grid': 'Scanners', 'heat-map': 'Heat Map' };
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: isActive ? '#E8B45E' : 'rgba(255,255,255,0.3)',
                  background: isActive ? 'rgba(232,180,94,0.12)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(232,180,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer',
                }}
              >
                {labels[mode]}
              </button>
            );
          })}
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

      {/* Main content: canvas + sidebar (constrained max-width for ultrawide) */}
      <div className="relative z-10 flex flex-1 overflow-hidden mx-auto w-full" style={{ maxWidth: '2400px' }}>
        {/* PixiJS War Room Canvas */}
        <div className="flex-1 relative overflow-hidden min-w-0">
          <WarRoomCanvas
            agents={agents}
            onEvent={handleEvent}
            onAgentHover={handleAgentHover}
            onLoadingStage={markStageComplete}
            onStationsReady={handleStationsReady}
            scannerCalls={scannerCalls}
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

        {/* Right panel (responsive width): Intel Brief + Live Feed — hidden on mobile */}
        <div
          className="hidden lg:flex flex-col flex-shrink-0 h-full"
          style={{
            width: 'clamp(320px, 22vw, 420px)',
            background: '#0A0A0A',
            borderLeft: '1px solid rgba(232, 180, 94, 0.3)',
          }}
        >
          {/* Top 40%: INTEL BRIEF narrative */}
          <IntelBrief agents={agents} events={events} stations={stations} scannerCalls={scannerCalls} />

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

      {/* ── Loading overlay ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background: 'rgba(0,0,0,0.95)',
            backdropFilter: 'blur(8px)',
            transition: 'opacity 0.4s ease-out',
          }}
        >
          <Swords className="w-8 h-8 mb-6" style={{ color: '#E8B45E', opacity: 0.8 }} />
          <h2
            className="text-sm font-bold uppercase tracking-[0.25em] mb-8"
            style={{ color: '#E8B45E', fontFamily: 'JetBrains Mono, monospace' }}
          >
            War Room
          </h2>

          {/* Progress bar */}
          <div className="w-64 sm:w-80 mb-6">
            <div
              className="w-full h-1 rounded-full overflow-hidden"
              style={{ background: 'rgba(232,180,94,0.15)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(8, (completedStages.size / LOADING_STAGES.length) * 100)}%`,
                  background: 'linear-gradient(90deg, #E8B45E, #f0c96e)',
                  boxShadow: '0 0 12px rgba(232,180,94,0.4)',
                  transition: 'width 0.5s ease-out',
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: 'rgba(232,180,94,0.5)', fontFamily: 'JetBrains Mono, monospace' }}
              >
                {completedStages.size}/{LOADING_STAGES.length}
              </span>
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: 'rgba(232,180,94,0.5)', fontFamily: 'JetBrains Mono, monospace' }}
              >
                {Math.round((completedStages.size / LOADING_STAGES.length) * 100)}%
              </span>
            </div>
          </div>

          {/* Stage list */}
          <div className="flex flex-col gap-2 w-64 sm:w-80">
            {LOADING_STAGES.map((stage) => {
              const isDone = completedStages.has(stage.key);
              const isActive = activeStage === stage.key && !isDone;
              return (
                <div
                  key={stage.key}
                  className="flex items-center gap-3 text-xs"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    opacity: isDone ? 0.4 : isActive ? 1 : 0.2,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  {/* Status indicator */}
                  <span className="w-4 flex justify-center shrink-0">
                    {isDone ? (
                      <span style={{ color: '#00ff41' }}>&#10003;</span>
                    ) : isActive ? (
                      <span
                        className="inline-block w-2 h-2 rounded-full animate-pulse"
                        style={{ background: '#E8B45E', boxShadow: '0 0 8px #E8B45E' }}
                      />
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.2)' }}>&#8226;</span>
                    )}
                  </span>
                  <span style={{ color: isDone ? '#00ff41' : isActive ? '#E8B45E' : 'rgba(255,255,255,0.3)' }}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              key={`${evt.timestamp}-${evt.agentName}-${evt.token}-${i}`}
              className="px-3 py-1 text-xs flex items-center gap-2"
              style={{ fontFamily: 'JetBrains Mono, monospace', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
            >
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px' }}>{evt.timestamp}</span>
              <span
                style={{
                  color: evt.action === 'BUY' ? '#00ff41' : evt.action === 'SELL' ? '#ff0033' : evt.action === 'SCANNER_CALL' ? '#00d4ff' : '#ffaa00',
                  fontWeight: '700',
                  fontSize: '9px',
                }}
              >
                {evt.action === 'SCANNER_CALL' ? 'CALL' : evt.action === 'ANALYZING' ? 'WATCH' : evt.action}
              </span>
              <span style={{ color: '#E8B45E' }}>{evt.agentName}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{evt.token}</span>
              {evt.detail && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '8px' }}>{evt.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
