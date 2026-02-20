'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Application as PixiApplication, Ticker as PixiTicker } from 'pixi.js';
import type {
  AgentData,
  FeedEvent,
  HoveredAgentInfo,
  LiveTxNotification,
  TokenDef,
  DevPrintToken,
  DevPrintTransaction,
  Conversation,
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

interface Props {
  agents: AgentData[];
  onEvent: (evt: FeedEvent) => void;
  onAgentHover?: (info: HoveredAgentInfo | null) => void;
  onLiveTx?: (notif: LiveTxNotification) => void;
}

export default function WarRoomCanvas({ agents, onEvent, onAgentHover, onLiveTx }: Props) {
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

  // Keep refs in sync
  const stationMgrRef = useRef<StationManager | null>(null);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onHoverRef.current = onAgentHover; }, [onAgentHover]);
  useEffect(() => { onLiveTxRef.current = onLiveTx; }, [onLiveTx]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // ── Token polling ──────────────────────────────────────────────────────────
  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('https://devprint-v2-production.up.railway.app/api/tokens');
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
    } catch {
      // keep existing data
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conversation polling ───────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('https://sr-mobile-production.up.railway.app/arena/conversations');
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
      const res = await fetch('https://devprint-v2-production.up.railway.app/api/transactions');
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

  // ── PixiJS initialization ──────────────────────────────────────────────────
  const initPixi = useCallback(async () => {
    if (!containerRef.current) return;

    const pixi = await import('pixi.js');
    const { Application, Graphics, Text, TextStyle, Container, Assets, Sprite } = pixi;

    const app = new Application();
    await app.init({
      background: 0x000000,
      resizeTo: containerRef.current,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    containerRef.current.appendChild(app.canvas as HTMLCanvasElement);
    appRef.current = app;

    const W = () => app.screen.width;
    const H = () => app.screen.height;

    const pixiModules = { Container, Graphics, Text, TextStyle, Assets, Sprite };

    // ── Background dot-grid ──────────────────────────────────────────────────
    const bgLayer = new Container();
    app.stage.addChild(bgLayer);

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

    // ── Headline ticker ──────────────────────────────────────────────────────
    const headlineTicker = new HeadlineTicker(pixiModules, app.stage, W);

    // ── Stations ─────────────────────────────────────────────────────────────
    const stationsLayer = new Container();
    app.stage.addChild(stationsLayer);
    const coordinationLayer = new Container();
    app.stage.addChild(coordinationLayer);

    const stationMgr = new StationManager(pixiModules, stationsLayer, coordinationLayer, W, H);
    stationMgr.buildStations(tokenDefsRef.current);
    stationMgrRef.current = stationMgr;

    // ── Bloom layer (additive blend — behind agents, above stations) ─────────
    const bloomLayer = new BloomLayer(pixiModules, app.stage);
    bloomLayer.buildStationGlows(stationMgr.stations);

    // ── Particle system (lives inside bloom for additive glow) ───────────────
    const particlePool = new ParticlePool(bloomLayer.getContainer(), new Container(), Graphics);

    // ── Agents ───────────────────────────────────────────────────────────────
    const agentsLayer = new Container();
    app.stage.addChild(agentsLayer);

    const agentMgr = new AgentManager(pixiModules, agentsLayer);
    await agentMgr.createAgentStates(agentsRef.current, stationMgr.stations);

    // ── Mouse hover ──────────────────────────────────────────────────────────
    const HOVER_RADIUS = 20;
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    app.stage.on('mousemove', (event) => {
      const { x, y } = event.global;
      let found: (typeof agentMgr.agentStates)[number] | null = null;

      for (const ag of agentMgr.agentStates) {
        const dx = ag.container.x - x;
        const dy = ag.container.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < HOVER_RADIUS) {
          found = ag;
          break;
        }
      }

      if (onHoverRef.current) {
        if (found) {
          const currentStation = stationMgr.stations[found.currentStationIdx]?.ticker ?? '';
          onHoverRef.current({ agent: found.data, currentStation, x, y });
        } else {
          onHoverRef.current(null);
        }
      }
    });

    app.stage.on('mouseleave', () => {
      if (onHoverRef.current) onHoverRef.current(null);
    });

    // ── Popups ───────────────────────────────────────────────────────────────
    const popupLayer = new Container();
    app.stage.addChild(popupLayer);
    const liveTxLayer = new Container();
    app.stage.addChild(liveTxLayer);
    const popupMgr = new PopupManager(pixiModules, popupLayer, liveTxLayer);

    // ── Coordination lines ───────────────────────────────────────────────────
    const coordLinesLayer = new Container();
    app.stage.addChild(coordLinesLayer);

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

          const popX = agIdx !== -1 ? agentMgr.agentStates[agIdx].container.x : w / 2 + (Math.random() - 0.5) * 100;
          const popY = agIdx !== -1 ? agentMgr.agentStates[agIdx].container.y : h / 2;
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

      // ── Decay visit counts every 10s ───────────────────────────────────────
      visitDecayMs += dt;
      if (visitDecayMs >= 10_000) {
        visitDecayMs = 0;
        stationMgr.resetVisitCounts();
      }

      // ── Station glow pulse ─────────────────────────────────────────────────
      stationMgr.updateGlowPulse(now);

      // ── Coordination visuals ───────────────────────────────────────────────
      stationMgr.updateCoordination(now, agentMgr.agentStates, coordLinesLayer, conversationsRef.current);

      // ── Station volume scaling ─────────────────────────────────────────────
      stationMgr.updateVolumeScaling(dt);

      // ── Agent movement + particles ─────────────────────────────────────────
      agentMgr.update(dt, now, stationMgr.stations, particlePool, (ag, station) => {
        stationMgr.recordVisit(ag.currentStationIdx);
        agentMgr.handleArrival(
          ag,
          station,
          (evt) => onEventRef.current(evt),
          (x, y, txt, color) => popupMgr.spawnPopup(x, y, txt, color),
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

    // ── Resize ───────────────────────────────────────────────────────────────
    const handleResize = () => {
      stationMgr.handleResize();
      bloomLayer.buildStationGlows(stationMgr.stations);
      drawBg();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start polling
  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 60_000);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 30_000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 30_000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

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

      {/* Live TX overlay notifications */}
      <div
        className="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-none"
        style={{ zIndex: 50 }}
      >
        {liveTxNotifs.map((notif) => (
          <div
            key={notif.id}
            className="flex items-center gap-3 px-4 py-3 rounded text-xs font-mono font-bold animate-fade-in"
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
              className="shrink-0 px-2 py-0.5 rounded text-black text-[10px] font-black"
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
