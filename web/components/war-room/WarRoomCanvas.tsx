'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type {
  Application as PixiApplication,
  Graphics as PixiGraphics,
  Text as PixiText,
  Container as PixiContainer,
  Ticker as PixiTicker,
  Sprite as PixiSprite,
} from 'pixi.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentData {
  id: string;
  name: string;
  rank: number;
  winRate: number;
  pnl: number;
  totalTrades: number;
  trustScore: number;
  color?: number;
  pfpUrl?: string;
  twitterHandle?: string;
  notes?: string;
  bestTradePct?: number;
}

export interface FeedEvent {
  timestamp: string;
  agentName: string;
  action: 'BUY' | 'SELL' | 'ANALYZING';
  token: string;
}

export interface HoveredAgentInfo {
  agent: AgentData;
  currentStation: string;
  x: number;
  y: number;
}

// ─── DevPrint token shape ─────────────────────────────────────────────────────
interface DevPrintToken {
  symbol: string;
  name: string;
  mint: string;
  detection_source: string;
  detected_at: string;
  twitter_url: string | null;
  image_url: string | null;
}

// ─── DevPrint transaction shape ───────────────────────────────────────────────
interface DevPrintTransaction {
  id: string;
  wallet_label: string;
  action: 'BUY' | 'SELL';
  token_symbol: string;
  token_mint?: string;
  usd_amount: number;
  timestamp: string;
}

// ─── Live TX notification (shown as overlay banner) ──────────────────────────
export interface LiveTxNotification {
  id: string;
  text: string;
  action: 'BUY' | 'SELL';
  agentName: string;
  token: string;
  amount: string;
}

// ─── Conversation shape ───────────────────────────────────────────────────────
interface Conversation {
  conversationId: string;
  topic: string;
  tokenMint: string;
  participantCount: number;
  messageCount: number;
  lastMessage: string | null;
  lastMessageAt: string;
  createdAt: string;
}

// ─── Token station positions (relative, reused across refreshes) ──────────────
const STATION_POSITIONS = [
  { rx: 0.12, ry: 0.22 },
  { rx: 0.38, ry: 0.16 },
  { rx: 0.65, ry: 0.24 },
  { rx: 0.88, ry: 0.19 },
  { rx: 0.08, ry: 0.60 },
  { rx: 0.33, ry: 0.67 },
  { rx: 0.62, ry: 0.60 },
  { rx: 0.87, ry: 0.65 },
];

interface TokenDef {
  ticker: string;
  name: string;
  mint?: string;
  rx: number;
  ry: number;
  detectedAt: Date;
  isNew: boolean;
  isOld: boolean;
}

interface TokenStation {
  ticker: string;
  name: string;
  mint?: string;
  rx: number;
  ry: number;
  detectedAt: Date;
  isNew: boolean;
  isOld: boolean;
  container: PixiContainer;
  priceText: PixiText;
  dot: PixiGraphics;
  box: PixiGraphics;
  glowGraphics: PixiGraphics;
  timeText: PixiText;
  coordinationRing: PixiGraphics;
  chatIcon: PixiText;
}

interface AgentState {
  data: AgentData;
  color: number;
  trustScore: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  targetStationIdx: number;
  currentStationIdx: number;
  travelDuration: number;
  travelElapsed: number;
  dwellTimer: number;
  arrived: boolean;
  breathOffset: number; // for breathing animation
  container: PixiContainer;
  ring: PixiGraphics;
  circle: PixiGraphics;
  label: PixiText;
  bubbleText: PixiText;
  bubbleBg: PixiGraphics;
  bubbleTimer: number;
  avatarSprite: PixiSprite | null;
}

interface Popup {
  container: PixiContainer;
  elapsed: number;
  duration: number;
  startY: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minsAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

function fmtMinsAgo(date: Date): string {
  const m = minsAgo(date);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function getBubbleText(trustScore: number): string {
  if (trustScore > 0.95) {
    return Math.random() < 0.5 ? 'ALPHA SIGNAL' : 'SMART MONEY IN';
  } else if (trustScore >= 0.7) {
    return Math.random() < 0.5 ? 'Analyzing...' : 'Watching closely';
  } else {
    return Math.random() < 0.5 ? 'Risky...' : 'Uncertain';
  }
}

const ACTION_COLORS: Record<string, number> = {
  BUY:       0x00ff41,
  SELL:      0xff0033,
  ANALYZING: 0xffaa00,
};

const ACTIONS: FeedEvent['action'][] = ['BUY', 'SELL', 'ANALYZING'];

const getAvatarUrl = (agent: AgentData): string => {
  if (agent.pfpUrl) return agent.pfpUrl;
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${agent.id}&backgroundColor=0a0a0a&radius=50`;
};

// ─── Generate cinematic headlines ────────────────────────────────────────────

function generateHeadlines(
  agents: AgentState[],
  stations: TokenStation[],
  conversations: Conversation[],
): string[] {
  const headlines: string[] = [];

  // Whale movement headlines
  agents.forEach((ag) => {
    if (ag.data.trustScore > 0.95) {
      const target = stations[ag.targetStationIdx];
      if (target) {
        headlines.push(
          `🚨 ALPHA SIGNAL — ${ag.data.name} entering ${target.ticker} | ${Math.round(ag.data.winRate * 100)}% win rate`,
        );
      }
    }
  });

  // Coordination headlines (multiple agents at same station)
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
        headlines.push(`⚡ COORDINATED SIGNAL — ${ags.length} smart money wallets on ${st.ticker}`);
      }
    }
  });

  // Conversation headlines
  conversations.slice(0, 2).forEach((conv) => {
    if (conv.lastMessage) {
      const excerpt = conv.lastMessage.length > 60
        ? conv.lastMessage.slice(0, 60) + '…'
        : conv.lastMessage;
      headlines.push(`💬 INTEL: "${excerpt}"`);
    }
  });

  // New token headlines
  stations.filter((s) => s.isNew).forEach((s) => {
    headlines.push(`🚀 NEW GRADUATION — ${s.ticker} just hit pump.fun | Smart money scanning`);
  });

  return headlines.length > 0
    ? headlines
    : [`📊 MONITORING — ${agents.length} whale wallets active | Season 1 live`];
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  agents: AgentData[];
  onEvent: (evt: FeedEvent) => void;
  onAgentHover?: (info: HoveredAgentInfo | null) => void;
  onLiveTx?: (notif: LiveTxNotification) => void;
}

export default function WarRoomCanvas({ agents, onEvent, onAgentHover, onLiveTx }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const appRef        = useRef<PixiApplication | null>(null);
  const onEventRef    = useRef(onEvent);
  const onHoverRef    = useRef(onAgentHover);
  const onLiveTxRef   = useRef(onLiveTx);
  const agentsRef     = useRef(agents);
  const tokenDefsRef  = useRef<TokenDef[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  // Live transactions state — stored in a ref so the pixi loop can read them
  const seenTxIdsRef  = useRef<Set<string>>(new Set());
  const pendingTxsRef = useRef<DevPrintTransaction[]>([]);
  const [liveTxNotifs, setLiveTxNotifs] = useState<LiveTxNotification[]>([]);
  const [, forceRender] = useState(0);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onHoverRef.current = onAgentHover; }, [onAgentHover]);
  useEffect(() => { onLiveTxRef.current = onLiveTx; }, [onLiveTx]);
  useEffect(() => { agentsRef.current  = agents;  }, [agents]);

  // ── Token polling ────────────────────────────────────────────────────────────
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
        const ageMs      = now - detectedAt.getTime();
        return {
          ticker:     `$${t.symbol}`,
          name:       t.name,
          mint:       t.mint,
          rx:         STATION_POSITIONS[i % STATION_POSITIONS.length].rx,
          ry:         STATION_POSITIONS[i % STATION_POSITIONS.length].ry,
          detectedAt,
          isNew:      ageMs < 10 * 60 * 1000,
          isOld:      ageMs > 2 * 60 * 60 * 1000,
        };
      });

      tokenDefsRef.current = defs;
      if (appRef.current) updateStationLabels();
    } catch {
      // keep existing data
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conversation polling ─────────────────────────────────────────────────────
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

  // ── Transaction polling (DevPrint /api/transactions) ─────────────────────────
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
      // Queue them for the PixiJS loop to consume
      pendingTxsRef.current.push(...newTxs);

      // Also fire React-level notifications for any UI overlay
      newTxs.forEach((tx) => {
        const amount = `$${tx.usd_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        const token  = tx.token_symbol.startsWith('$') ? tx.token_symbol : `$${tx.token_symbol}`;
        const notif: LiveTxNotification = {
          id:        tx.id,
          text:      `${tx.wallet_label} ${tx.action === 'BUY' ? 'BOUGHT' : 'SOLD'} ${token} — ${amount}`,
          action:    tx.action,
          agentName: tx.wallet_label,
          token,
          amount,
        };
        onLiveTxRef.current?.(notif);

        // React state for overlay rendering (auto-dismiss after 5s)
        setLiveTxNotifs((prev) => [notif, ...prev].slice(0, 5));
        setTimeout(() => {
          setLiveTxNotifs((prev) => prev.filter((n) => n.id !== notif.id));
        }, 5000);
      });
    } catch {
      // API not yet available — silently skip
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStationLabelsRef = useRef<() => void>(() => {});
  function updateStationLabels() {
    updateStationLabelsRef.current();
  }

  const initPixi = useCallback(async () => {
    if (!containerRef.current) return;

    const {
      Application,
      Graphics,
      Text,
      TextStyle,
      Container,
      Assets,
      Sprite,
    } = await import('pixi.js');

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

    // ── Subtle dot-grid background ──────────────────────────────────────────
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

    // ── Headline ticker layer (top of canvas) ────────────────────────────────
    const headlineLayer = new Container();
    app.stage.addChild(headlineLayer);

    let currentHeadlineIdx  = 0;
    let headlineElapsed     = 0;
    const HEADLINE_DURATION = 4000;
    let headlineFadeIn      = 0; // 0→1 over 500ms
    let headlineFadeOut     = 0; // starts at HEADLINE_DURATION - 500

    // Ticker bar bg
    const tickerBg = new Graphics();
    tickerBg.rect(0, 0, W(), 28);
    tickerBg.fill({ color: 0x050505, alpha: 0.92 });
    tickerBg.setStrokeStyle({ width: 1, color: 0xe8b45e, alpha: 0.15 });
    tickerBg.rect(0, 0, W(), 28);
    tickerBg.stroke();
    headlineLayer.addChild(tickerBg);

    // Left accent line
    const tickerAccent = new Graphics();
    tickerAccent.rect(0, 0, 3, 28);
    tickerAccent.fill({ color: 0xe8b45e, alpha: 0.8 });
    headlineLayer.addChild(tickerAccent);

    const headlineText = new Text({
      text: '📊 INITIALIZING WAR ROOM...',
      style: new TextStyle({
        fontFamily:    'JetBrains Mono, monospace',
        fontSize:      10,
        fontWeight:    '700',
        fill:          0xffaa00,
        letterSpacing: 1.5,
      }),
    });
    headlineText.x = 12;
    headlineText.y = 9;
    headlineLayer.addChild(headlineText);

    // ── Token Stations ───────────────────────────────────────────────────────
    const stationsLayer = new Container();
    app.stage.addChild(stationsLayer);

    const coordinationLayer = new Container();
    app.stage.addChild(coordinationLayer);

    const stations: TokenStation[] = [];

    const buildStations = () => {
      stationsLayer.removeChildren();
      coordinationLayer.removeChildren();
      stations.length = 0;

      const defs = tokenDefsRef.current.length > 0
        ? tokenDefsRef.current
        : STATION_POSITIONS.map((pos, i) => ({
            ticker:     `$TOKEN${i + 1}`,
            name:       'Loading...',
            mint:       undefined as string | undefined,
            rx:         pos.rx,
            ry:         pos.ry,
            detectedAt: new Date(),
            isNew:      false,
            isOld:      false,
          }));

      defs.forEach((def) => {
        const container = new Container();
        const x = def.rx * W();
        const y = def.ry * H();
        container.x = x;
        container.y = y;

        const BW = 70;
        const BH = 44;

        const glowColor = def.isNew ? 0xffcc00 : 0xe8b45e;
        const glowAlpha = def.isNew ? 0.18 : def.isOld ? 0.02 : 0.05;
        const glow = new Graphics();
        glow.roundRect(-BW - 6, -BH - 6, (BW + 6) * 2, (BH + 6) * 2, 8);
        glow.fill({ color: glowColor, alpha: glowAlpha });

        const boxBorderAlpha = def.isOld ? 0.25 : def.isNew ? 1.0 : 0.7;
        const boxBorderColor = def.isNew ? 0xffcc00 : 0xe8b45e;
        const box = new Graphics();
        box.roundRect(-BW, -BH, BW * 2, BH * 2, 5);
        box.fill({ color: 0x0a0a0a, alpha: 0.95 });
        box.setStrokeStyle({ width: def.isNew ? 2.0 : 1.5, color: boxBorderColor, alpha: boxBorderAlpha });
        box.roundRect(-BW, -BH, BW * 2, BH * 2, 5);
        box.stroke();

        const tickerText = new Text({
          text: def.ticker,
          style: new TextStyle({
            fontFamily:    'JetBrains Mono, monospace',
            fontSize:      12,
            fontWeight:    '800',
            fill:          def.isNew ? 0xffcc00 : def.isOld ? 0x888888 : 0xe8b45e,
            letterSpacing: 1,
          }),
        });
        tickerText.anchor.set(0.5, 0);
        tickerText.y = -BH + 5;

        const shortName = def.name.length > 14 ? def.name.slice(0, 13) + '…' : def.name;
        const nameText = new Text({
          text: shortName,
          style: new TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize:   8,
            fill:       def.isOld ? 0x555555 : 0xaaaaaa,
          }),
        });
        nameText.anchor.set(0.5, 0);
        nameText.y = -BH + 22;

        const badgeText = new Text({
          text: '🚀 pump.fun',
          style: new TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize:   7,
            fill:       def.isOld ? 0x555555 : 0x888888,
          }),
        });
        badgeText.anchor.set(0.5, 0);
        badgeText.y = -BH + 32;

        const timeText = new Text({
          text: fmtMinsAgo(def.detectedAt),
          style: new TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize:   7,
            fill:       def.isNew ? 0xffcc00 : def.isOld ? 0x444444 : 0x666666,
          }),
        });
        timeText.anchor.set(0.5, 0);
        timeText.y = BH - 16;

        const dot = new Graphics();
        dot.circle(0, 0, 4);
        dot.fill({ color: def.isNew ? 0xffcc00 : 0xffaa00 });
        dot.y = BH + 10;

        // Coordination ring (hidden by default)
        const coordinationRing = new Graphics();
        coordinationRing.visible = false;

        // Chat icon (hidden by default)
        const chatIcon = new Text({
          text: '💬',
          style: new TextStyle({ fontSize: 12 }),
        });
        chatIcon.anchor.set(0.5, 1);
        chatIcon.x = BW - 8;
        chatIcon.y = -BH + 2;
        chatIcon.visible = false;

        container.addChild(glow, box, tickerText, nameText, badgeText, timeText, dot, coordinationRing, chatIcon);
        stationsLayer.addChild(container);

        stations.push({
          ticker:           def.ticker,
          name:             def.name,
          mint:             def.mint,
          rx:               def.rx,
          ry:               def.ry,
          detectedAt:       def.detectedAt,
          isNew:            def.isNew,
          isOld:            def.isOld,
          container,
          priceText:        nameText,
          dot,
          box,
          glowGraphics:     glow,
          timeText,
          coordinationRing,
          chatIcon,
        });
      });
    };

    buildStations();

    updateStationLabelsRef.current = () => {
      buildStations();
    };

    // ── Trail lines layer ────────────────────────────────────────────────────
    const trailLayer = new Container();
    app.stage.addChild(trailLayer);

    // ── Agents ───────────────────────────────────────────────────────────────
    const agentsLayer = new Container();
    app.stage.addChild(agentsLayer);

    // ── Load avatar textures ─────────────────────────────────────────────────
    const agentStates: AgentState[] = await Promise.all(
      agentsRef.current.map(async (ag, i) => {
        const trustScore = ag.trustScore ?? 0.5;
        const color = ag.color ?? (trustScore > 0.95 ? 0xe8b45e : 0xffffff);

        const homeStation = i % stations.length;
        const sx = stations[homeStation]?.container.x ?? 100 + i * 80;
        const sy = (stations[homeStation]?.container.y ?? 100) - 60;

        const container = new Container();
        container.x = sx;
        container.y = sy;
        container.eventMode = 'static';
        container.cursor    = 'pointer';

        // ── Gold ring (rank glow) ─────────────────────────────────────────
        const outerRing = new Graphics();
        outerRing.circle(0, 0, 18);
        outerRing.fill({ color, alpha: trustScore > 0.95 ? 0.18 : 0.08 });

        // ── Border ring ────────────────────────────────────────────────────
        const ring = new Graphics();
        ring.circle(0, 0, 16);
        ring.setStrokeStyle({
          width: trustScore > 0.95 ? 2.5 : 1.5,
          color: trustScore > 0.95 ? 0xe8b45e : 0x444444,
        });
        ring.stroke();

        // ── Inner circle (placeholder if avatar fails) ─────────────────────
        const circle = new Graphics();
        circle.circle(0, 0, 14);
        circle.fill({ color });

        // ── Avatar sprite ──────────────────────────────────────────────────
        let avatarSprite: PixiSprite | null = null;
        try {
          const avatarUrl = getAvatarUrl(ag);
          const texture   = await Assets.load(avatarUrl);
          avatarSprite    = new Sprite(texture);
          avatarSprite.width  = 28;
          avatarSprite.height = 28;
          avatarSprite.anchor.set(0.5);

          // Circular mask
          const avatarMask = new Graphics();
          avatarMask.circle(0, 0, 14);
          avatarMask.fill(0xffffff);
          avatarSprite.mask = avatarMask;

          container.addChild(avatarMask);
        } catch {
          // fall through to colored circle
        }

        // ── Rank label ─────────────────────────────────────────────────────
        const rankText = new Text({
          text: String(ag.rank),
          style: new TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize:   10,
            fontWeight: '900',
            fill:       0x000000,
          }),
        });
        rankText.anchor.set(0.5, 0.5);
        rankText.visible = avatarSprite === null;

        // ── Name label ─────────────────────────────────────────────────────
        const label = new Text({
          text: ag.name.toUpperCase(),
          style: new TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize:   9,
            fontWeight: '700',
            fill:       trustScore > 0.95 ? 0xe8b45e : 0xffffff,
          }),
        });
        label.anchor.set(0.5, 0);
        label.y = 18;

        // ── Bubble ─────────────────────────────────────────────────────────
        const bubbleBg = new Graphics();
        bubbleBg.visible = false;

        const bubbleText = new Text({
          text: '',
          style: new TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize:   9,
            fontWeight: '700',
            fill:       0xffffff,
          }),
        });
        bubbleText.anchor.set(0.5, 1);
        bubbleText.y = -22;
        bubbleText.visible = false;

        container.addChild(outerRing, ring, circle);
        if (avatarSprite) container.addChild(avatarSprite);
        container.addChild(rankText, label, bubbleBg, bubbleText);
        agentsLayer.addChild(container);

        const firstTarget = (homeStation + 1 + i) % stations.length;
        const tx = (stations[firstTarget]?.container.x ?? 200) + (Math.random() - 0.5) * 20;
        const ty = ((stations[firstTarget]?.container.y ?? 200) + 60) + (Math.random() - 0.5) * 20;
        const dur = 3000 + Math.random() * 2000;

        return {
          data: ag,
          color,
          trustScore,
          x: sx, y: sy,
          startX: sx, startY: sy,
          targetX: tx, targetY: ty,
          targetStationIdx: firstTarget,
          currentStationIdx: homeStation,
          travelDuration: dur,
          travelElapsed: 0,
          dwellTimer: -1,
          arrived: false,
          breathOffset: Math.random() * Math.PI * 2, // each agent has unique phase
          container,
          ring,
          circle,
          label,
          bubbleText,
          bubbleBg,
          bubbleTimer: 0,
          avatarSprite,
        };
      }),
    );

    // ── Mouse hover detection ────────────────────────────────────────────────
    const HOVER_RADIUS = 20;
    app.stage.eventMode = 'static';
    app.stage.hitArea   = app.screen;

    app.stage.on('mousemove', (event) => {
      const { x, y } = event.global;
      let found: AgentState | null = null;

      for (const ag of agentStates) {
        const dx = ag.container.x - x;
        const dy = ag.container.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < HOVER_RADIUS) {
          found = ag;
          break;
        }
      }

      if (onHoverRef.current) {
        if (found) {
          const currentStation = stations[found.currentStationIdx]?.ticker ?? '';
          onHoverRef.current({
            agent:          found.data,
            currentStation,
            x,
            y,
          });
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
    const popups: Popup[] = [];

    const spawnPopup = (x: number, y: number, txt: string, color: number) => {
      const container = new Container();

      const textObj = new Text({
        text: txt,
        style: new TextStyle({
          fontFamily: 'JetBrains Mono, monospace',
          fontSize:   10,
          fontWeight: '700',
          fill:       color,
        }),
      });
      textObj.anchor.set(0.5, 0.5);

      const tw = textObj.width + 16;
      const th = textObj.height + 8;
      const bg = new Graphics();
      bg.roundRect(-tw / 2, -th / 2, tw, th, 3);
      bg.fill({ color: 0x050505, alpha: 0.95 });
      bg.setStrokeStyle({ width: 1, color, alpha: 0.9 });
      bg.roundRect(-tw / 2, -th / 2, tw, th, 3);
      bg.stroke();

      container.addChild(bg, textObj);
      container.x = x;
      container.y = y - 60;
      popupLayer.addChild(container);
      popups.push({ container, elapsed: 0, duration: 2800, startY: y - 60 });
    };

    // ── Coordination lines layer ─────────────────────────────────────────────
    const coordLinesLayer = new Container();
    app.stage.addChild(coordLinesLayer);

    // ── Live TX popup (larger, colored border, 5s) ───────────────────────────
    const liveTxLayer = new Container();
    app.stage.addChild(liveTxLayer);

    const spawnLiveTxPopup = (
      x: number,
      y: number,
      txt: string,
      action: 'BUY' | 'SELL',
    ) => {
      const borderColor = action === 'BUY' ? 0x00ff41 : 0xff0033;
      const container   = new Container();

      const textObj = new Text({
        text: txt,
        style: new TextStyle({
          fontFamily: 'JetBrains Mono, monospace',
          fontSize:   12,
          fontWeight: '800',
          fill:       borderColor,
        }),
      });
      textObj.anchor.set(0.5, 0.5);

      const tw = textObj.width + 24;
      const th = textObj.height + 14;
      const bg = new Graphics();
      // Outer glow
      bg.roundRect(-tw / 2 - 3, -th / 2 - 3, tw + 6, th + 6, 6);
      bg.fill({ color: borderColor, alpha: 0.12 });
      // Main box
      bg.roundRect(-tw / 2, -th / 2, tw, th, 4);
      bg.fill({ color: 0x050505, alpha: 0.97 });
      bg.setStrokeStyle({ width: 2, color: borderColor, alpha: 1.0 });
      bg.roundRect(-tw / 2, -th / 2, tw, th, 4);
      bg.stroke();

      // Action badge (BUY / SELL)
      const badge = new Text({
        text: action,
        style: new TextStyle({
          fontFamily: 'JetBrains Mono, monospace',
          fontSize:   9,
          fontWeight: '900',
          fill:       0x000000,
        }),
      });
      badge.anchor.set(0.5, 0.5);
      const badgeBg = new Graphics();
      badgeBg.roundRect(-18, -8, 36, 16, 3);
      badgeBg.fill({ color: borderColor });
      badgeBg.x = tw / 2 - 22;
      badgeBg.y = -th / 2 + 10;
      badge.x = badgeBg.x;
      badge.y = badgeBg.y;

      container.addChild(bg, textObj, badgeBg, badge);
      container.x = x;
      container.y = y - 80;
      liveTxLayer.addChild(container);
      popups.push({ container, elapsed: 0, duration: 5000, startY: y - 80 });
    };

    // ── Time counters ────────────────────────────────────────────────────────
    let timeUpdateMs   = 0;
    let headlineTick   = 0;

    // ── Main ticker loop ──────────────────────────────────────────────────────
    app.ticker.add((ticker: PixiTicker) => {
      const dt  = ticker.deltaMS;
      const now = Date.now();

      // ── Headline ticker ──────────────────────────────────────────────────
      headlineTick    += dt;
      headlineElapsed += dt;

      if (headlineElapsed >= HEADLINE_DURATION) {
        headlineElapsed = 0;
        const headlines = generateHeadlines(agentStates, stations, conversationsRef.current);
        currentHeadlineIdx = (currentHeadlineIdx + 1) % headlines.length;
        headlineText.text = headlines[currentHeadlineIdx] ?? headlines[0];
      }

      // Fade in/out effect via alpha
      const progress = headlineElapsed / HEADLINE_DURATION;
      if (progress < 0.1) {
        headlineText.alpha = progress / 0.1;
      } else if (progress > 0.85) {
        headlineText.alpha = 1 - (progress - 0.85) / 0.15;
      } else {
        headlineText.alpha = 1;
      }

      // Ticker color cycles: amber for normal, gold for alpha signals
      const hl = headlineText.text;
      if (hl.includes('ALPHA') || hl.includes('COORDINATED')) {
        (headlineText.style as { fill: number }).fill = 0xe8b45e;
      } else if (hl.includes('NEW GRADUATION')) {
        (headlineText.style as { fill: number }).fill = 0x00ff41;
      } else {
        (headlineText.style as { fill: number }).fill = 0xffaa00;
      }

      // Resize ticker bg if canvas width changed
      tickerBg.clear();
      tickerBg.rect(0, 0, W(), 28);
      tickerBg.fill({ color: 0x050505, alpha: 0.92 });
      tickerBg.setStrokeStyle({ width: 1, color: 0xe8b45e, alpha: 0.15 });
      tickerBg.rect(0, 0, W(), 28);
      tickerBg.stroke();

      // ── Process pending live transactions ────────────────────────────────
      if (pendingTxsRef.current.length > 0) {
        const txBatch = pendingTxsRef.current.splice(0);
        txBatch.forEach((tx) => {
          const txTicker = tx.token_symbol.startsWith('$') ? tx.token_symbol : `$${tx.token_symbol}`;
          const amount   = `$${tx.usd_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

          // Find matching station
          const stIdx = stations.findIndex(
            (st) =>
              st.ticker.toUpperCase() === txTicker.toUpperCase() ||
              (tx.token_mint && st.mint && st.mint === tx.token_mint),
          );

          // Find matching agent by wallet_label (case-insensitive partial match)
          const agIdx = agentStates.findIndex(
            (ag) =>
              ag.data.name.toLowerCase().includes(tx.wallet_label.toLowerCase()) ||
              tx.wallet_label.toLowerCase().includes(ag.data.name.toLowerCase()),
          );

          // Override agent's target to the matched station
          if (agIdx !== -1 && stIdx !== -1) {
            const ag = agentStates[agIdx];
            const st = stations[stIdx];
            ag.startX          = ag.container.x;
            ag.startY          = ag.container.y;
            ag.targetStationIdx = stIdx;
            ag.targetX         = st.container.x + (Math.random() - 0.5) * 12;
            ag.targetY         = st.container.y + 55 + (Math.random() - 0.5) * 12;
            ag.travelDuration  = 2000 + Math.random() * 1000; // faster — urgent!
            ag.travelElapsed   = 0;
            ag.arrived         = false;
            ag.dwellTimer      = -1;
          }

          // Emit feed event
          const ts = new Date(tx.timestamp).toLocaleTimeString('en-US', {
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
          });
          onEventRef.current({
            timestamp: ts,
            agentName: tx.wallet_label,
            action:    tx.action,
            token:     txTicker,
          });

          // Spawn live TX popup at agent position (or center of canvas)
          const popX = agIdx !== -1
            ? agentStates[agIdx].container.x
            : W() / 2 + (Math.random() - 0.5) * 100;
          const popY = agIdx !== -1
            ? agentStates[agIdx].container.y
            : H() / 2;
          spawnLiveTxPopup(
            popX,
            popY,
            `🔴 LIVE TX — ${tx.wallet_label} ${tx.action === 'BUY' ? 'BOUGHT' : 'SOLD'} ${txTicker} | ${amount}`,
            tx.action,
          );

          // Priority headline override (inject into rotation)
          headlineText.text  = `🔴 LIVE TX — ${tx.wallet_label} just ${tx.action === 'BUY' ? 'bought' : 'sold'} ${txTicker} | ${amount}`;
          headlineElapsed    = 0; // reset so it stays visible
          (headlineText.style as { fill: number }).fill = tx.action === 'BUY' ? 0x00ff41 : 0xff0033;
        });
      }

      // ── Update station time labels every 30s ─────────────────────────────
      timeUpdateMs += dt;
      if (timeUpdateMs >= 30_000) {
        timeUpdateMs = 0;
        stations.forEach((st) => {
          st.timeText.text = fmtMinsAgo(st.detectedAt);
        });
      }

      // ── Station: animate new-token glow pulse ────────────────────────────
      const pulseAlpha = 0.10 + 0.08 * Math.sin(now / 400);
      stations.forEach((st) => {
        if (st.isNew) st.glowGraphics.alpha = pulseAlpha * 2.5;
      });

      // ── Coordination visuals ──────────────────────────────────────────────
      const stationOccupants: Record<number, AgentState[]> = {};
      agentStates.forEach((ag) => {
        if (ag.arrived) {
          if (!stationOccupants[ag.currentStationIdx]) stationOccupants[ag.currentStationIdx] = [];
          stationOccupants[ag.currentStationIdx].push(ag);
        }
      });

      coordLinesLayer.removeChildren();

      stations.forEach((st, idx) => {
        const occupants = stationOccupants[idx] ?? [];
        const hasCoordination = occupants.length >= 2;

        if (hasCoordination) {
          // Pulsing ring around station
          const ringScale = 1.0 + 0.08 * Math.sin(now / 500);
          st.coordinationRing.clear();
          const rW = 76 * ringScale;
          const rH = 50 * ringScale;
          st.coordinationRing.roundRect(-rW, -rH, rW * 2, rH * 2, 7);
          st.coordinationRing.setStrokeStyle({
            width: 2.5,
            color: 0xe8b45e,
            alpha: 0.5 + 0.3 * Math.sin(now / 300),
          });
          st.coordinationRing.stroke();
          st.coordinationRing.visible = true;

          // Box glows brighter
          st.box.alpha = 1.0;
          st.glowGraphics.alpha = 0.25 + 0.1 * Math.sin(now / 400);

          // Dashed lines between coordinating agents
          for (let a = 0; a < occupants.length - 1; a++) {
            for (let b = a + 1; b < occupants.length; b++) {
              const ag1 = occupants[a];
              const ag2 = occupants[b];
              const line = new Graphics();
              line.moveTo(ag1.container.x, ag1.container.y);
              // Dashed: draw segments
              const dx = ag2.container.x - ag1.container.x;
              const dy = ag2.container.y - ag1.container.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const dashLen = 6;
              const gapLen  = 4;
              let pos = 0;
              while (pos < len) {
                const segStart = pos / len;
                const segEnd   = Math.min((pos + dashLen) / len, 1);
                line.moveTo(
                  ag1.container.x + dx * segStart,
                  ag1.container.y + dy * segStart,
                );
                line.lineTo(
                  ag1.container.x + dx * segEnd,
                  ag1.container.y + dy * segEnd,
                );
                pos += dashLen + gapLen;
              }
              line.setStrokeStyle({
                width: 1,
                color: 0xe8b45e,
                alpha: 0.4 + 0.2 * Math.sin(now / 300),
              });
              line.stroke();
              coordLinesLayer.addChild(line);
            }
          }
        } else {
          st.coordinationRing.visible = false;
          st.box.alpha = 1.0;
        }

        // ── Conversation bubbles ────────────────────────────────────────────
        const hasConversation = conversationsRef.current.some(
          (c) => st.mint && c.tokenMint === st.mint,
        );
        if (hasConversation && !st.chatIcon.visible) {
          st.chatIcon.visible = true;
        } else if (!hasConversation && st.chatIcon.visible) {
          st.chatIcon.visible = false;
        }
      });

      // ── Agent movement & breathing ────────────────────────────────────────
      trailLayer.removeChildren();

      agentStates.forEach((ag) => {
        // ── Breathing animation ────────────────────────────────────────────
        const breathScale = 1.0 + 0.05 * Math.sin(now / 2000 + ag.breathOffset);
        ag.circle.scale.set(breathScale);
        if (ag.avatarSprite) ag.avatarSprite.scale.set(breathScale);

        if (ag.arrived) {
          ag.dwellTimer -= dt;
          if (ag.dwellTimer <= 0) {
            let next: number;
            do { next = Math.floor(Math.random() * stations.length); }
            while (next === ag.currentStationIdx && stations.length > 1);

            ag.startX = ag.container.x;
            ag.startY = ag.container.y;
            ag.targetStationIdx = next;
            ag.targetX = stations[next].container.x + (Math.random() - 0.5) * 20;
            ag.targetY = stations[next].container.y + 60 + (Math.random() - 0.5) * 20;
            ag.travelDuration = 3000 + Math.random() * 2000;
            ag.travelElapsed  = 0;
            ag.arrived        = false;
            ag.dwellTimer     = -1;
          }
        } else {
          ag.travelElapsed += dt;
          const t    = Math.min(1, ag.travelElapsed / ag.travelDuration);
          const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

          ag.container.x = ag.startX + (ag.targetX - ag.startX) * ease;
          ag.container.y = ag.startY + (ag.targetY - ag.startY) * ease;
          ag.x = ag.container.x;
          ag.y = ag.container.y;

          // Trail line
          const trail = new Graphics();
          trail.moveTo(ag.startX, ag.startY);
          trail.lineTo(ag.x, ag.y);
          trail.setStrokeStyle({
            width: ag.trustScore > 0.95 ? 1.5 : 1,
            color: ag.color,
            alpha: ag.trustScore > 0.95 ? 0.45 : 0.2,
          });
          trail.stroke();
          trailLayer.addChild(trail);

          if (t >= 1) {
            ag.container.x = ag.targetX;
            ag.container.y = ag.targetY;
            ag.x = ag.targetX;
            ag.y = ag.targetY;
            ag.arrived          = true;
            ag.currentStationIdx = ag.targetStationIdx;
            ag.dwellTimer       = 2000 + Math.random() * 3000;

            const bubbleMsg = getBubbleText(ag.trustScore);
            const token     = stations[ag.currentStationIdx]?.ticker ?? '$TOKEN';

            let action: FeedEvent['action'];
            if (ag.trustScore > 0.95)     action = 'BUY';
            else if (ag.trustScore < 0.7) action = 'ANALYZING';
            else                           action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];

            const aColor = ACTION_COLORS[action];

            ag.bubbleText.text = bubbleMsg;
            (ag.bubbleText.style as { fill: number }).fill = aColor;
            ag.bubbleText.visible = true;
            ag.bubbleTimer = 2500;

            const bw = ag.bubbleText.width + 12;
            const bh = ag.bubbleText.height + 6;
            ag.bubbleBg.clear();
            ag.bubbleBg.roundRect(-bw / 2, -(bh + 24), bw, bh, 3);
            ag.bubbleBg.fill({ color: 0x050505, alpha: 0.9 });
            ag.bubbleBg.setStrokeStyle({ width: 1, color: aColor, alpha: 0.8 });
            ag.bubbleBg.roundRect(-bw / 2, -(bh + 24), bw, bh, 3);
            ag.bubbleBg.stroke();
            ag.bubbleBg.visible = true;

            spawnPopup(ag.x, ag.y, `${ag.data.name} spotted ${token}`, aColor);

            const ts = new Date().toLocaleTimeString('en-US', {
              hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
            });
            onEventRef.current({ timestamp: ts, agentName: ag.data.name, action, token });
          }
        }

        // Bubble fade-out
        if (ag.bubbleTimer > 0) {
          ag.bubbleTimer -= dt;
          const alpha = Math.min(1, ag.bubbleTimer / 400);
          ag.bubbleText.alpha = alpha;
          ag.bubbleBg.alpha   = alpha;
          if (ag.bubbleTimer <= 0) {
            ag.bubbleText.visible = false;
            ag.bubbleBg.visible   = false;
          }
        }
      });

      // ── Popup updates ──────────────────────────────────────────────────────
      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.elapsed += dt;
        const progress    = p.elapsed / p.duration;
        p.container.alpha = progress < 0.75 ? 1 : 1 - (progress - 0.75) / 0.25;
        p.container.y     = p.startY - progress * 30;
        if (p.elapsed >= p.duration) {
          popupLayer.removeChild(p.container);
          popups.splice(i, 1);
        }
      }
    });

    // Initialize first headline after stations are built
    const initHeadlines = generateHeadlines(agentStates, stations, conversationsRef.current);
    headlineText.text = initHeadlines[0] ?? '📊 WAR ROOM ACTIVE';

    // ── Resize ────────────────────────────────────────────────────────────────
    const handleResize = () => {
      stations.forEach((st) => {
        st.container.x = st.rx * W();
        st.container.y = st.ry * H();
      });
      drawBg();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start token polling
  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 60_000);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  // Start conversation polling
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 30_000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Start transaction polling (every 30s)
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
      {/* PixiJS canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Live TX overlay notifications (bottom-right, 5s auto-dismiss) */}
      <div
        className="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-none"
        style={{ zIndex: 50 }}
      >
        {liveTxNotifs.map((notif) => (
          <div
            key={notif.id}
            className="flex items-center gap-3 px-4 py-3 rounded text-xs font-mono font-bold animate-fade-in"
            style={{
              background:   'rgba(5,5,5,0.97)',
              border:       `2px solid ${notif.action === 'BUY' ? '#00ff41' : '#ff0033'}`,
              boxShadow:    `0 0 16px ${notif.action === 'BUY' ? '#00ff4133' : '#ff003333'}`,
              color:        notif.action === 'BUY' ? '#00ff41' : '#ff0033',
              maxWidth:     360,
              letterSpacing: '0.05em',
            }}
          >
            {/* Action badge */}
            <span
              className="shrink-0 px-2 py-0.5 rounded text-black text-[10px] font-black"
              style={{ background: notif.action === 'BUY' ? '#00ff41' : '#ff0033' }}
            >
              {notif.action}
            </span>
            <span>🔴 LIVE TX — {notif.agentName} {notif.action === 'BUY' ? 'BOUGHT' : 'SOLD'} {notif.token} | {notif.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
