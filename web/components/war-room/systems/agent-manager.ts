import type {
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Text as PixiText,
  Sprite as PixiSprite,
} from 'pixi.js';
import type { AgentData, AgentState, TokenStation, FeedEvent } from '../types';
import { ACTION_COLORS, ACTIONS } from '../constants';
import { getBubbleText, getAvatarUrl, easeInOutCubic, clamp } from '../helpers';
import type { ParticlePool } from './particle-system';

interface PixiModules {
  Container: new () => PixiContainer;
  Graphics: new () => PixiGraphics;
  Text: new (opts: { text: string; style: unknown }) => PixiText;
  TextStyle: new (opts: Record<string, unknown>) => unknown;
  Assets: { load: (url: string) => Promise<unknown> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Sprite: new (texture: any) => PixiSprite;
}

export class AgentManager {
  private pixi: PixiModules;
  private agentsLayer: PixiContainer;
  agentStates: AgentState[] = [];

  constructor(pixi: PixiModules, agentsLayer: PixiContainer) {
    this.pixi = pixi;
    this.agentsLayer = agentsLayer;
  }

  async createAgentStates(agents: AgentData[], stations: TokenStation[]): Promise<void> {
    const { Container, Graphics, Text, TextStyle, Assets, Sprite } = this.pixi;

    this.agentStates = await Promise.all(
      agents.map(async (ag, i) => {
        const trustScore = ag.trustScore ?? 0.5;
        const color = ag.color ?? (trustScore > 0.95 ? 0xe8b45e : 0xffffff);

        const homeStation = i % stations.length;
        const sx = stations[homeStation]?.container.x ?? 100 + i * 80;
        const sy = (stations[homeStation]?.container.y ?? 100) - 60;

        const container = new Container();
        container.x = sx;
        container.y = sy;
        container.eventMode = 'static';
        container.cursor = 'pointer';

        const outerRing = new Graphics();
        outerRing.circle(0, 0, 18);
        outerRing.fill({ color, alpha: trustScore > 0.95 ? 0.18 : 0.08 });

        const ring = new Graphics();
        ring.circle(0, 0, 16);
        ring.setStrokeStyle({
          width: trustScore > 0.95 ? 2.5 : 1.5,
          color: trustScore > 0.95 ? 0xe8b45e : 0x444444,
        });
        ring.stroke();

        const circle = new Graphics();
        circle.circle(0, 0, 14);
        circle.fill({ color });

        let avatarSprite: PixiSprite | null = null;
        try {
          const avatarUrl = getAvatarUrl(ag);
          const texture = await Assets.load(avatarUrl);
          avatarSprite = new Sprite(texture);
          avatarSprite.width = 28;
          avatarSprite.height = 28;
          avatarSprite.anchor.set(0.5);

          const avatarMask = new Graphics();
          avatarMask.circle(0, 0, 14);
          avatarMask.fill(0xffffff);
          avatarSprite.mask = avatarMask;
          container.addChild(avatarMask);
        } catch {
          // fall through to colored circle
        }

        const rankText = new Text({
          text: String(ag.rank),
          style: new TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            fontWeight: '900',
            fill: 0x000000,
          }),
        });
        rankText.anchor.set(0.5, 0.5);
        rankText.visible = avatarSprite === null;

        const label = new Text({
          text: ag.name.toUpperCase(),
          style: new TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            fontWeight: '700',
            fill: trustScore > 0.95 ? 0xe8b45e : 0xffffff,
          }),
        });
        label.anchor.set(0.5, 0);
        label.y = 18;

        const bubbleBg = new Graphics();
        bubbleBg.visible = false;

        const bubbleText = new Text({
          text: '',
          style: new TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            fontWeight: '700',
            fill: 0xffffff,
          }),
        });
        bubbleText.anchor.set(0.5, 1);
        bubbleText.y = -22;
        bubbleText.visible = false;

        container.addChild(outerRing, ring, circle);
        if (avatarSprite) container.addChild(avatarSprite);
        container.addChild(rankText, label, bubbleBg, bubbleText);
        this.agentsLayer.addChild(container);

        const firstTarget = (homeStation + 1 + i) % stations.length;
        const tx = (stations[firstTarget]?.container.x ?? 200) + (Math.random() - 0.5) * 20;
        const ty = ((stations[firstTarget]?.container.y ?? 200) + 60) + (Math.random() - 0.5) * 20;
        const dur = 4000 + Math.random() * 2000;

        return {
          data: ag,
          color,
          trustScore,
          x: sx, y: sy,
          startX: sx, startY: sy,
          targetX: tx, targetY: ty,
          targetStationIdx: firstTarget,
          currentStationIdx: homeStation,
          homeStationIdx: homeStation,
          travelDuration: dur,
          travelElapsed: 0,
          dwellTimer: -1,
          arrived: false,
          breathOffset: Math.random() * Math.PI * 2,
          isUrgent: false,
          pnlScale: clamp(1.0 + ag.pnl / 10000 * 0.4, 0.8, 1.4),
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
  }

  update(
    dt: number,
    now: number,
    stations: TokenStation[],
    particlePool: ParticlePool,
    onArrival: (ag: AgentState, station: TokenStation) => void,
  ) {
    this.agentStates.forEach((ag) => {
      // Breathing animation
      const breathScale = 1.0 + 0.05 * Math.sin(now / 2000 + ag.breathOffset);
      const combinedScale = breathScale * ag.pnlScale;
      ag.circle.scale.set(combinedScale);
      if (ag.avatarSprite) ag.avatarSprite.scale.set(combinedScale);

      // Urgent ring oscillation
      if (ag.isUrgent && !ag.arrived) {
        const urgentAlpha = 0.6 + 0.4 * Math.sin(now / 150);
        ag.ring.alpha = urgentAlpha;
      } else {
        ag.ring.alpha = 1;
      }

      if (ag.arrived) {
        ag.dwellTimer -= dt;
        if (ag.dwellTimer <= 0) {
          // Smarter movement: 40% chance to return home
          let next: number;
          const goHome = Math.random() < 0.4 && ag.currentStationIdx !== ag.homeStationIdx;
          if (goHome) {
            next = ag.homeStationIdx;
          } else {
            do { next = Math.floor(Math.random() * stations.length); }
            while (next === ag.currentStationIdx && stations.length > 1);
          }

          ag.startX = ag.container.x;
          ag.startY = ag.container.y;
          ag.targetStationIdx = next;
          ag.targetX = stations[next].container.x + (Math.random() - 0.5) * 20;
          ag.targetY = stations[next].container.y + 60 + (Math.random() - 0.5) * 20;
          ag.travelDuration = 4000 + Math.random() * 2000;
          ag.travelElapsed = 0;
          ag.arrived = false;
          ag.dwellTimer = -1;
          ag.isUrgent = false;
        }
      } else {
        ag.travelElapsed += dt;
        const t = Math.min(1, ag.travelElapsed / ag.travelDuration);
        const ease = easeInOutCubic(t);

        ag.container.x = ag.startX + (ag.targetX - ag.startX) * ease;
        ag.container.y = ag.startY + (ag.targetY - ag.startY) * ease;
        ag.x = ag.container.x;
        ag.y = ag.container.y;

        // Emit particles during travel
        const isHighTrust = ag.trustScore > 0.95;
        const isUrgent = ag.isUrgent;
        const particleCount = isUrgent ? 3 : isHighTrust ? 2 : 1;
        const particleSize = isUrgent ? 4 : isHighTrust ? 3 : 2;
        const particleLife = isUrgent ? 1800 : isHighTrust ? 1500 : 800;
        const particleAlpha = isUrgent ? 0.7 : isHighTrust ? 0.6 : 0.3;

        // Emit every frame for urgent/high-trust, every other frame for normal
        const shouldEmit = isHighTrust || isUrgent || (Math.floor(ag.travelElapsed / 32) % 2 === 0);
        if (shouldEmit) {
          particlePool.emit(ag.x, ag.y, ag.color, {
            count: particleCount,
            size: particleSize,
            life: particleLife,
            alpha: particleAlpha,
          });
        }

        if (t >= 1) {
          ag.container.x = ag.targetX;
          ag.container.y = ag.targetY;
          ag.x = ag.targetX;
          ag.y = ag.targetY;
          ag.arrived = true;
          ag.currentStationIdx = ag.targetStationIdx;
          // Home dwell: 4000-6000ms. Non-home: 2000-3000ms.
          const isHome = ag.currentStationIdx === ag.homeStationIdx;
          ag.dwellTimer = isHome
            ? 4000 + Math.random() * 2000
            : 2000 + Math.random() * 1000;

          const station = stations[ag.currentStationIdx];
          if (station) onArrival(ag, station);
        }
      }

      // Bubble fade-out
      if (ag.bubbleTimer > 0) {
        ag.bubbleTimer -= dt;
        const alpha = Math.min(1, ag.bubbleTimer / 400);
        ag.bubbleText.alpha = alpha;
        ag.bubbleBg.alpha = alpha;
        if (ag.bubbleTimer <= 0) {
          ag.bubbleText.visible = false;
          ag.bubbleBg.visible = false;
        }
      }
    });
  }

  handleArrival(
    ag: AgentState,
    station: TokenStation,
    onEvent: (evt: FeedEvent) => void,
    spawnPopup: (x: number, y: number, txt: string, color: number) => void,
  ) {
    const bubbleMsg = getBubbleText(ag.trustScore);
    const token = station.ticker;

    let action: FeedEvent['action'];
    if (ag.trustScore > 0.95) action = 'BUY';
    else if (ag.trustScore < 0.7) action = 'ANALYZING';
    else action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];

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
    onEvent({ timestamp: ts, agentName: ag.data.name, action, token });
  }

  sendAgentToStation(agIdx: number, stIdx: number, stations: TokenStation[]) {
    const ag = this.agentStates[agIdx];
    const st = stations[stIdx];
    if (!ag || !st) return;

    ag.startX = ag.container.x;
    ag.startY = ag.container.y;
    ag.targetStationIdx = stIdx;
    ag.targetX = st.container.x + (Math.random() - 0.5) * 12;
    ag.targetY = st.container.y + 55 + (Math.random() - 0.5) * 12;
    ag.travelDuration = 1000 + Math.random() * 500; // urgent: 1000-1500ms
    ag.travelElapsed = 0;
    ag.arrived = false;
    ag.dwellTimer = -1;
    ag.isUrgent = true;
  }
}
