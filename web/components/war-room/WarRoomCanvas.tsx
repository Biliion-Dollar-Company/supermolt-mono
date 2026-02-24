'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Application as PixiApplication, Ticker as PixiTicker } from 'pixi.js';
import type {
  AgentData,
  FeedEvent,
  HoveredAgentInfo,
  LiveTxNotification,
  TokenDef,
  TokenMetrics,
  DevPrintToken,
  DevPrintTransaction,
  Conversation,
  StationInfo,
  ScannerCallData,
  ScannerCallsMap,
} from './types';
import { STATION_POSITIONS } from './constants';
import { StationManager } from './systems/station-manager';
import { AgentManager } from './systems/agent-manager';
import { PopupManager } from './systems/popup-manager';
import { HeadlineTicker } from './systems/headline-ticker';
import { ParticlePool } from './systems/particle-system';
import { BloomLayer } from './systems/bloom-layer';
import { ScreenFlash } from './systems/screen-flash';

export type { AgentData, FeedEvent, HoveredAgentInfo, LiveTxNotification };

type LoadingStage = 'wallets' | 'pixi' | 'tokens' | 'agents' | 'feeds';

interface Props {
  agents: AgentData[];
  onEvent: (evt: FeedEvent) => void;
  onAgentHover?: (info: HoveredAgentInfo | null) => void;
  onLiveTx?: (notif: LiveTxNotification) => void;
  onLoadingStage?: (stage: LoadingStage) => void;
  onStationsReady?: (stations: StationInfo[]) => void;
  /** Scanner calls keyed by token address, provided by parent */
  scannerCalls?: ScannerCallsMap;
}

export default function WarRoomCanvas({ agents, onEvent, onAgentHover, onLiveTx, onLoadingStage, onStationsReady, scannerCalls }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PixiApplication | null>(null);
  const onEventRef = useRef(onEvent);
  const onHoverRef = useRef(onAgentHover);
  const onLiveTxRef = useRef(onLiveTx);
  const agentsRef = useRef(agents);
  const tokenDefsRef = useRef<TokenDef[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  const seenTxIdsRef = useRef<Set<string>>(new Set());
  const pendingTxsRef = useRef<DevPrintTransaction[]>([]);
  const [liveTxNotifs, setLiveTxNotifs] = useState<LiveTxNotification[]>([]);
  const [showPanHint, setShowPanHint] = useState(true);

  const onLoadingStageRef = useRef(onLoadingStage);
  const onStationsReadyRef = useRef(onStationsReady);
  const scannerCallsRef = useRef<ScannerCallsMap>(scannerCalls ?? {});

  // Keep refs in sync
  const stationMgrRef = useRef<StationManager | null>(null);

  // Auto-dismiss pan hint
  useEffect(() => {
    const t = setTimeout(() => setShowPanHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onHoverRef.current = onAgentHover; }, [onAgentHover]);
  useEffect(() => { onLiveTxRef.current = onLiveTx; }, [onLiveTx]);
  useEffect(() => { onLoadingStageRef.current = onLoadingStage; }, [onLoadingStage]);
  useEffect(() => { onStationsReadyRef.current = onStationsReady; }, [onStationsReady]);
  useEffect(() => { scannerCallsRef.current = scannerCalls ?? {}; }, [scannerCalls]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // ── Token polling ──────────────────────────────────────────────────────────
  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/devprint/tokens');
      if (!res.ok) return;
      const json = await res.json() as { success: boolean; data: DevPrintToken[] };
      const data: DevPrintToken[] = json.data ?? [];

      const sorted = data
        .filter((t) => t.symbol && t.name)
        .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
        .slice(0, 8);

      const now = Date.now();
      const defs: TokenDef[] = sorted.map((t, i) => {
        const detectedAt = new Date(t.detected_at);
        const ageMs = now - detectedAt.getTime();
        return {
          ticker: `$${t.symbol}`,
          name: t.name,
          mint: t.mint,
          imageUrl: t.image_url ?? undefined,
          chain: t.chain ?? 'SOL',
          rx: STATION_POSITIONS[i % STATION_POSITIONS.length].rx,
          ry: STATION_POSITIONS[i % STATION_POSITIONS.length].ry,
          detectedAt,
          isNew: ageMs < 10 * 60 * 1000,
          isOld: ageMs > 2 * 60 * 60 * 1000,
        };
      });

      tokenDefsRef.current = defs;
      if (stationMgrRef.current) {
        stationMgrRef.current.buildStations(defs);
      }
      // Emit lightweight station info to parent
      onStationsReadyRef.current?.(defs.map((d) => ({
        ticker: d.ticker,
        name: d.name,
        mint: d.mint,
        chain: d.chain,
        detectedAt: d.detectedAt,
        isNew: d.isNew,
      })));
    } catch {
      // keep existing data
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conversation polling ───────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/mobile/arena/conversations');
      if (!res.ok) return;
      const json = await res.json() as { conversations: Conversation[] };
      conversationsRef.current = json.conversations ?? [];
    } catch {
      // keep existing
    }
  }, []);

  // ── Transaction polling ────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/devprint/transactions');
      if (!res.ok) return;
      const raw = await res.json() as DevPrintTransaction[] | { data: DevPrintTransaction[] };
      const txs: DevPrintTransaction[] = Array.isArray(raw)
        ? raw
        : (raw as { data: DevPrintTransaction[] }).data ?? [];

      const newTxs = txs.filter((tx) => tx.id && !seenTxIdsRef.current.has(tx.id));
      if (newTxs.length === 0) return;

      newTxs.forEach((tx) => seenTxIdsRef.current.add(tx.id));
      pendingTxsRef.current.push(...newTxs);

      newTxs.forEach((tx) => {
        const amount = `$${tx.usd_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        const token = tx.token_symbol.startsWith('$') ? tx.token_symbol : `$${tx.token_symbol}`;
        const notif: LiveTxNotification = {
          id: tx.id,
          text: `${tx.wallet_label} ${tx.action === 'BUY' ? 'BOUGHT' : 'SOLD'} ${token} — ${amount}`,
          action: tx.action,
          agentName: tx.wallet_label,
          token,
          amount,
        };
        onLiveTxRef.current?.(notif);

        setLiveTxNotifs((prev) => [notif, ...prev].slice(0, 5));
        setTimeout(() => {
          setLiveTxNotifs((prev) => prev.filter((n) => n.id !== notif.id));
        }, 5000);
      });
    } catch {
      // silently skip
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Token metrics polling (via supermolt backend — DexScreener) ──────────
  const fetchMetrics = useCallback(async () => {
    if (!stationMgrRef.current) return;
    const stations = stationMgrRef.current.stations;

    // Fetch each token's analytics via the supermolt backend proxy
    const fetches = stations.map(async (s, stIdx) => {
      if (!s.mint) return;
      try {
        const res = await fetch(`/api/proxy/mobile/ponzinomics/tokens/${s.mint}`);
        if (!res.ok) return;
        const json = await res.json() as {
          success: boolean;
          data: {
            analytics?: { marketCap?: number; volume24h?: number };
            metadata?: { image_url?: string };
          };
        };
        if (!json.success || !json.data) return;

        const { analytics, metadata } = json.data;
        if (stationMgrRef.current) {
          stationMgrRef.current.updateStationMetrics(stIdx, {
            marketCap: analytics?.marketCap ?? 0,
            volume24h: Math.round(analytics?.volume24h ?? 0),
            imageUrl: metadata?.image_url || undefined,
          });
        }
      } catch {
        // Backend unreachable for this token — metrics stay as dashes
      }
    });

    await Promise.allSettled(fetches);
  }, []);

  // ── PixiJS initialization ──────────────────────────────────────────────────
  const initPixi = useCallback(async () => {
    if (!containerRef.current) return;

    const pixi = await import('pixi.js');
    const { Application, Graphics, Text, TextStyle, Container, Assets, Sprite } = pixi;

    const app = new Application();
    await app.init({
      backgroundAlpha: 0,
      resizeTo: containerRef.current,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    containerRef.current.appendChild(app.canvas as HTMLCanvasElement);
    appRef.current = app;
    onLoadingStageRef.current?.('pixi');

    const W = () => app.screen.width;
    const H = () => app.screen.height;

    const pixiModules = { Container, Graphics, Text, TextStyle, Assets, Sprite };

    // ── Pan / Zoom world container ─────────────────────────────────────────
    const worldContainer = new Container();
    app.stage.addChild(worldContainer);

    // Zoom / pan state
    let zoomLevel = 1.0;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 2.5;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragPanStartX = 0;
    let dragPanStartY = 0;

    const applyTransform = () => {
      worldContainer.scale.set(zoomLevel);
      worldContainer.x = panX;
      worldContainer.y = panY;
    };

    // Mouse wheel zoom (centered on cursor)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.93;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * zoomFactor));
      // Zoom toward cursor position
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const scale = newZoom / zoomLevel;
        panX = mx - scale * (mx - panX);
        panY = my - scale * (my - panY);
      }
      zoomLevel = newZoom;
      applyTransform();
    };

    // Drag to pan — left-click drag anywhere on the canvas
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 1) {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragPanStartX = panX;
        dragPanStartY = panY;
        (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
        canvasEl.style.cursor = 'grabbing';
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      panX = dragPanStartX + (e.clientX - dragStartX);
      panY = dragPanStartY + (e.clientY - dragStartY);
      applyTransform();
    };
    const onPointerUp = () => {
      isDragging = false;
      canvasEl.style.cursor = 'grab';
    };

    // Double-click to reset view
    const onDblClick = () => {
      zoomLevel = 1.0;
      panX = 0;
      panY = 0;
      applyTransform();
    };

    const canvasEl = app.canvas as HTMLCanvasElement;
    canvasEl.style.cursor = 'grab';
    canvasEl.addEventListener('wheel', onWheel, { passive: false });
    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerup', onPointerUp);
    canvasEl.addEventListener('pointercancel', onPointerUp);
    canvasEl.addEventListener('dblclick', onDblClick);

    // ── Background dot-grid ──────────────────────────────────────────────────
    const bgLayer = new Container();
    worldContainer.addChild(bgLayer);

    const drawBg = () => {
      bgLayer.removeChildren();
      const g = new Graphics();
      const spacing = 40;
      for (let x = 0; x < W(); x += spacing) {
        for (let y = 0; y < H(); y += spacing) {
          g.circle(x, y, 1);
          g.fill({ color: 0x1a1a1a });
        }
      }
      bgLayer.addChild(g);
    };
    drawBg();

    // ── Headline ticker (above world — doesn't pan/zoom) ──────────────────
    const headlineTicker = new HeadlineTicker(pixiModules, app.stage, W);

    // ── Stations ─────────────────────────────────────────────────────────────
    const stationsLayer = new Container();
    stationsLayer.eventMode = 'static';
    worldContainer.addChild(stationsLayer);
    const coordinationLayer = new Container();
    coordinationLayer.eventMode = 'none';
    worldContainer.addChild(coordinationLayer);

    const stationMgr = new StationManager(pixiModules, stationsLayer, coordinationLayer, W, H);
    stationMgrRef.current = stationMgr;
    // Fetch real tokens BEFORE building stations so we don't show placeholders
    await fetchTokens();
    stationMgr.buildStations(tokenDefsRef.current);
    stationMgr.drawGridLines(bgLayer);
    onLoadingStageRef.current?.('tokens');

    // ── Bloom layer (additive blend — behind agents, above stations) ─────────
    const bloomLayer = new BloomLayer(pixiModules, worldContainer);
    bloomLayer.buildStationGlows(stationMgr.stations);
    bloomLayer.getContainer().eventMode = 'none';

    // ── Particle system (lives inside bloom for additive glow) ───────────────
    const particlePool = new ParticlePool(bloomLayer.getContainer(), new Container(), Graphics);

    // ── Agents ───────────────────────────────────────────────────────────────
    const agentsLayer = new Container();
    agentsLayer.eventMode = 'none';
    worldContainer.addChild(agentsLayer);

    const agentMgr = new AgentManager(pixiModules, agentsLayer);
    await agentMgr.createAgentStates(agentsRef.current, stationMgr.stations);
    bloomLayer.buildAgentGlows(agentMgr.agentStates);
    onLoadingStageRef.current?.('agents');

    // ── Mouse hover ──────────────────────────────────────────────────────────
    const HOVER_RADIUS = 20;
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    app.stage.on('mousemove', (event) => {
      if (isDragging) return;
      // Convert global coords to world coords (account for pan/zoom)
      const gx = event.global.x;
      const gy = event.global.y;
      const wx = (gx - panX) / zoomLevel;
      const wy = (gy - panY) / zoomLevel;
      let found: (typeof agentMgr.agentStates)[number] | null = null;

      for (const ag of agentMgr.agentStates) {
        const dx = ag.container.x - wx;
        const dy = ag.container.y - wy;
        if (Math.sqrt(dx * dx + dy * dy) < HOVER_RADIUS / zoomLevel) {
          found = ag;
          break;
        }
      }

      if (onHoverRef.current) {
        if (found) {
          const currentStation = stationMgr.stations[found.currentStationIdx]?.ticker ?? '';
          onHoverRef.current({ agent: found.data, currentStation, x: gx, y: gy });
        } else {
          onHoverRef.current(null);
        }
      }
    });

    app.stage.on('mouseleave', () => {
      if (onHoverRef.current) onHoverRef.current(null);
    });

    // ── Popups (in world space so they move with pan/zoom) ────────────────
    const popupLayer = new Container();
    popupLayer.eventMode = 'none';
    worldContainer.addChild(popupLayer);
    const liveTxLayer = new Container();
    liveTxLayer.eventMode = 'none';
    worldContainer.addChild(liveTxLayer);
    const popupMgr = new PopupManager(pixiModules, popupLayer, liveTxLayer);

    // ── Coordination lines ───────────────────────────────────────────────────
    const coordLinesLayer = new Container();
    coordLinesLayer.eventMode = 'none';
    worldContainer.addChild(coordLinesLayer);

    // ── Screen flash ─────────────────────────────────────────────────────────
    const screenFlash = new ScreenFlash(pixiModules, app.stage, W, H);

    // ── Timers ───────────────────────────────────────────────────────────────
    let timeUpdateMs = 0;
    let headlineRefreshMs = 0;
    let visitDecayMs = 0;

    // Initialize headlines
    headlineTicker.refreshHeadlines(agentMgr.agentStates, stationMgr.stations, conversationsRef.current);

    // ── Main ticker loop ─────────────────────────────────────────────────────
    app.ticker.add((ticker: PixiTicker) => {
      const dt = ticker.deltaMS;
      const now = Date.now();
      const w = W();
      const h = H();

      // Headline ticker update
      headlineTicker.update(dt);

      // Refresh headlines every 4s
      headlineRefreshMs += dt;
      if (headlineRefreshMs >= 4000) {
        headlineRefreshMs = 0;
        headlineTicker.refreshHeadlines(agentMgr.agentStates, stationMgr.stations, conversationsRef.current);
      }

      // ── Process pending live transactions ──────────────────────────────────
      if (pendingTxsRef.current.length > 0) {
        const txBatch = pendingTxsRef.current.splice(0);
        txBatch.forEach((tx) => {
          const txTicker = tx.token_symbol.startsWith('$') ? tx.token_symbol : `$${tx.token_symbol}`;
          const amount = `$${tx.usd_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

          const stIdx = stationMgr.stations.findIndex(
            (st) =>
              st.ticker.toUpperCase() === txTicker.toUpperCase() ||
              (tx.token_mint && st.mint && st.mint === tx.token_mint),
          );

          const agIdx = agentMgr.agentStates.findIndex(
            (ag) =>
              ag.data.name.toLowerCase().includes(tx.wallet_label.toLowerCase()) ||
              tx.wallet_label.toLowerCase().includes(ag.data.name.toLowerCase()),
          );

          if (agIdx !== -1 && stIdx !== -1) {
            agentMgr.sendAgentToStation(agIdx, stIdx, stationMgr.stations);
          }

          const ts = new Date(tx.timestamp).toLocaleTimeString('en-US', {
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
          });
          onEventRef.current({ timestamp: ts, agentName: tx.wallet_label, action: tx.action, token: txTicker });

          // Position popup above the TOKEN STATION (not the agent)
          const popX = stIdx !== -1 ? stationMgr.stations[stIdx].container.x : w / 2 + (Math.random() - 0.5) * 100;
          const popY = stIdx !== -1 ? stationMgr.stations[stIdx].container.y : h / 2;
          popupMgr.spawnLiveTxPopup(
            popX, popY,
            `LIVE TX — ${tx.wallet_label} ${tx.action === 'BUY' ? 'BOUGHT' : 'SOLD'} ${txTicker} | ${amount}`,
            tx.action,
          );

          headlineTicker.overridePriority(
            `LIVE TX — ${tx.wallet_label} just ${tx.action === 'BUY' ? 'bought' : 'sold'} ${txTicker} | ${amount}`,
            tx.action === 'BUY' ? 0x00ff41 : 0xff0033,
          );

          // Screen flash for high-trust agent TXs
          if (agIdx !== -1 && agentMgr.agentStates[agIdx].trustScore > 0.9) {
            screenFlash.flash(tx.action);
          }
        });
      }

      // ── Station time labels every 30s ──────────────────────────────────────
      timeUpdateMs += dt;
      if (timeUpdateMs >= 30_000) {
        timeUpdateMs = 0;
        stationMgr.updateTimeLabels();
      }

      // ── Decay visit counts every 10s + auto-expand most active ────────────
      visitDecayMs += dt;
      if (visitDecayMs >= 10_000) {
        visitDecayMs = 0;
        stationMgr.resetVisitCounts();
        stationMgr.autoExpandMostActive();
        // Update scanner indicators
        stationMgr.updateScannerOverlays(scannerCallsRef.current);
      }

      // ── Station glow pulse ─────────────────────────────────────────────────
      stationMgr.updateGlowPulse(now);

      // ── Coordination visuals ───────────────────────────────────────────────
      stationMgr.updateCoordination(now, agentMgr.agentStates, coordLinesLayer, conversationsRef.current);

      // ── Station expand/collapse animation ──────────────────────────────────
      stationMgr.updateExpandAnimation(dt);

      // ── Station volume scaling ─────────────────────────────────────────────
      stationMgr.updateVolumeScaling(dt);

      // ── Agent movement + particles ─────────────────────────────────────────
      agentMgr.update(dt, now, stationMgr.stations, particlePool, (ag, station) => {
        stationMgr.recordVisit(ag.currentStationIdx);
        agentMgr.handleArrival(
          ag,
          station,
          (evt) => onEventRef.current(evt),
          (x, y, txt, color, action) => popupMgr.spawnPopup(x, y, txt, color, action),
        );
      });

      // ── Particles ──────────────────────────────────────────────────────────
      particlePool.update(dt);

      // ── Bloom ──────────────────────────────────────────────────────────────
      bloomLayer.update(now, agentMgr.agentStates, stationMgr.stations);

      // ── Screen flash ───────────────────────────────────────────────────────
      screenFlash.update(dt);

      // ── Popups ─────────────────────────────────────────────────────────────
      popupMgr.update(dt);
    });

    // Signal that all systems are live
    onLoadingStageRef.current?.('feeds');

    // ── Resize ───────────────────────────────────────────────────────────────
    const handleResize = () => {
      stationMgr.handleResize();
      stationMgr.drawGridLines(bgLayer);
      bloomLayer.buildStationGlows(stationMgr.stations);
      drawBg();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvasEl.removeEventListener('wheel', onWheel);
      canvasEl.removeEventListener('pointerdown', onPointerDown);
      canvasEl.removeEventListener('pointermove', onPointerMove);
      canvasEl.removeEventListener('pointerup', onPointerUp);
      canvasEl.removeEventListener('pointercancel', onPointerUp);
      canvasEl.removeEventListener('dblclick', onDblClick);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start polling (OPTIMIZED: staggered start to reduce initial load spike)
  // Note: first fetchTokens() happens inside initPixi (await-ed to build stations).
  // This effect only handles the recurring poll — skip the redundant initial call.
  const didInitialFetchRef = useRef(false);
  useEffect(() => {
    if (!didInitialFetchRef.current) {
      didInitialFetchRef.current = true;
    } else {
      fetchTokens(); // Only on dep change (shouldn't happen with stable useCallback)
    }
    const interval = setInterval(fetchTokens, 60_000);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  useEffect(() => {
    // Conversations: start after 1s
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const initialDelay = setTimeout(() => {
      fetchConversations();
      intervalId = setInterval(fetchConversations, 30_000);
    }, 1000);
    return () => { clearTimeout(initialDelay); if (intervalId) clearInterval(intervalId); };
  }, [fetchConversations]);

  useEffect(() => {
    // Transactions: start after 2s
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const initialDelay = setTimeout(() => {
      fetchTransactions();
      intervalId = setInterval(fetchTransactions, 30_000);
    }, 2000);
    return () => { clearTimeout(initialDelay); if (intervalId) clearInterval(intervalId); };
  }, [fetchTransactions]);

  // Metrics: first fetch after 5s (wait for stations + all initial data), then every 45s (less frequent)
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const initialDelay = setTimeout(() => {
      fetchMetrics();
      intervalId = setInterval(fetchMetrics, 45_000);
    }, 5000);
    return () => { clearTimeout(initialDelay); if (intervalId) clearInterval(intervalId); };
  }, [fetchMetrics]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initPixi().then((fn) => { cleanup = fn; });
    return () => {
      cleanup?.();
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [initPixi]);

  return (
    <div className="relative w-full h-full" style={{ background: '#000000' }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Pan/zoom hint */}
      {showPanHint && (
        <div
          className="absolute bottom-4 left-4 pointer-events-none"
          style={{
            zIndex: 40,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            color: 'rgba(232,180,94,0.5)',
            letterSpacing: '0.5px',
            background: 'rgba(0,0,0,0.6)',
            padding: '6px 10px',
            border: '1px solid rgba(232,180,94,0.15)',
            animation: 'fadeOut 1s ease-out 5s forwards',
          }}
        >
          SCROLL TO ZOOM &middot; CLICK+DRAG TO PAN &middot; DOUBLE-CLICK TO RESET
        </div>
      )}

      {/* Live TX overlay notifications */}
      <div
        className="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-none"
        style={{ zIndex: 50 }}
      >
        {liveTxNotifs.map((notif) => (
          <div
            key={notif.id}
            className="flex items-center gap-3 px-4 py-3 text-xs font-mono font-bold animate-fade-in"
            style={{
              background: 'rgba(5,5,5,0.97)',
              border: `2px solid ${notif.action === 'BUY' ? '#00ff41' : '#ff0033'}`,
              boxShadow: `0 0 16px ${notif.action === 'BUY' ? '#00ff4133' : '#ff003333'}`,
              color: notif.action === 'BUY' ? '#00ff41' : '#ff0033',
              maxWidth: 360,
              letterSpacing: '0.05em',
            }}
          >
            <span
              className="shrink-0 px-2 py-0.5 text-black text-[10px] font-black"
              style={{ background: notif.action === 'BUY' ? '#00ff41' : '#ff0033' }}
            >
              {notif.action}
            </span>
            <span>LIVE TX — {notif.agentName} {notif.action === 'BUY' ? 'BOUGHT' : 'SOLD'} {notif.token} | {notif.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
