import type {
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Text as PixiText,
} from 'pixi.js';
import type { TokenDef, TokenStation, AgentState, Conversation } from '../types';
import { STATION_POSITIONS } from '../constants';
import { fmtMinsAgo, clamp } from '../helpers';

interface PixiModules {
  Container: new () => PixiContainer;
  Graphics: new () => PixiGraphics;
  Text: new (opts: { text: string; style: unknown }) => PixiText;
  TextStyle: new (opts: Record<string, unknown>) => unknown;
}

export class StationManager {
  private pixi: PixiModules;
  private stationsLayer: PixiContainer;
  private coordinationLayer: PixiContainer;
  stations: TokenStation[] = [];
  private W: () => number;
  private H: () => number;

  constructor(
    pixi: PixiModules,
    stationsLayer: PixiContainer,
    coordinationLayer: PixiContainer,
    W: () => number,
    H: () => number,
  ) {
    this.pixi = pixi;
    this.stationsLayer = stationsLayer;
    this.coordinationLayer = coordinationLayer;
    this.W = W;
    this.H = H;
  }

  buildStations(tokenDefs: TokenDef[]) {
    const { Container, Graphics, Text, TextStyle } = this.pixi;
    this.stationsLayer.removeChildren();
    this.coordinationLayer.removeChildren();
    this.stations.length = 0;

    const defs = tokenDefs.length > 0
      ? tokenDefs
      : STATION_POSITIONS.map((pos, i) => ({
          ticker: `$TOKEN${i + 1}`,
          name: 'Loading...',
          mint: undefined as string | undefined,
          rx: pos.rx,
          ry: pos.ry,
          detectedAt: new Date(),
          isNew: false,
          isOld: false,
        }));

    defs.forEach((def) => {
      const container = new Container();
      container.x = def.rx * this.W();
      container.y = def.ry * this.H();

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
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          fontWeight: '800',
          fill: def.isNew ? 0xffcc00 : def.isOld ? 0x888888 : 0xe8b45e,
          letterSpacing: 1,
        }),
      });
      tickerText.anchor.set(0.5, 0);
      tickerText.y = -BH + 5;

      const shortName = def.name.length > 14 ? def.name.slice(0, 13) + '...' : def.name;
      const nameText = new Text({
        text: shortName,
        style: new TextStyle({
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 8,
          fill: def.isOld ? 0x555555 : 0xaaaaaa,
        }),
      });
      nameText.anchor.set(0.5, 0);
      nameText.y = -BH + 22;

      const badgeText = new Text({
        text: 'pump.fun',
        style: new TextStyle({
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 7,
          fill: def.isOld ? 0x555555 : 0x888888,
        }),
      });
      badgeText.anchor.set(0.5, 0);
      badgeText.y = -BH + 32;

      const timeText = new Text({
        text: fmtMinsAgo(def.detectedAt),
        style: new TextStyle({
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 7,
          fill: def.isNew ? 0xffcc00 : def.isOld ? 0x444444 : 0x666666,
        }),
      });
      timeText.anchor.set(0.5, 0);
      timeText.y = BH - 16;

      const dot = new Graphics();
      dot.circle(0, 0, 4);
      dot.fill({ color: def.isNew ? 0xffcc00 : 0xffaa00 });
      dot.y = BH + 10;

      const coordinationRing = new Graphics();
      coordinationRing.visible = false;

      const chatIcon = new Text({
        text: '',
        style: new TextStyle({ fontSize: 12 }),
      });
      chatIcon.anchor.set(0.5, 1);
      chatIcon.x = BW - 8;
      chatIcon.y = -BH + 2;
      chatIcon.visible = false;

      container.addChild(glow, box, tickerText, nameText, badgeText, timeText, dot, coordinationRing, chatIcon);
      this.stationsLayer.addChild(container);

      this.stations.push({
        ticker: def.ticker,
        name: def.name,
        mint: def.mint,
        rx: def.rx,
        ry: def.ry,
        detectedAt: def.detectedAt,
        isNew: def.isNew,
        isOld: def.isOld,
        container,
        priceText: nameText,
        dot,
        box,
        glowGraphics: glow,
        timeText,
        coordinationRing,
        chatIcon,
        visitCount: 0,
        scaleTarget: 1.0,
        scaleCurrent: 1.0,
      });
    });
  }

  updateTimeLabels() {
    this.stations.forEach((st) => {
      st.timeText.text = fmtMinsAgo(st.detectedAt);
    });
  }

  updateGlowPulse(now: number) {
    const pulseAlpha = 0.10 + 0.08 * Math.sin(now / 400);
    this.stations.forEach((st) => {
      if (st.isNew) st.glowGraphics.alpha = pulseAlpha * 2.5;
    });
  }

  updateCoordination(
    now: number,
    agentStates: AgentState[],
    coordLinesLayer: PixiContainer,
    conversations: Conversation[],
  ) {
    const { Graphics } = this.pixi;
    const stationOccupants: Record<number, AgentState[]> = {};
    agentStates.forEach((ag) => {
      if (ag.arrived) {
        if (!stationOccupants[ag.currentStationIdx]) stationOccupants[ag.currentStationIdx] = [];
        stationOccupants[ag.currentStationIdx].push(ag);
      }
    });

    coordLinesLayer.removeChildren();

    this.stations.forEach((st, idx) => {
      const occupants = stationOccupants[idx] ?? [];
      const hasCoordination = occupants.length >= 2;

      if (hasCoordination) {
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

        st.box.alpha = 1.0;
        st.glowGraphics.alpha = 0.25 + 0.1 * Math.sin(now / 400);

        for (let a = 0; a < occupants.length - 1; a++) {
          for (let b = a + 1; b < occupants.length; b++) {
            const ag1 = occupants[a];
            const ag2 = occupants[b];
            const line = new Graphics();
            const dx = ag2.container.x - ag1.container.x;
            const dy = ag2.container.y - ag1.container.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const dashLen = 6;
            const gapLen = 4;
            let pos = 0;
            while (pos < len) {
              const segStart = pos / len;
              const segEnd = Math.min((pos + dashLen) / len, 1);
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

      const hasConversation = conversations.some(
        (c) => st.mint && c.tokenMint === st.mint,
      );
      st.chatIcon.visible = hasConversation;
    });
  }

  updateVolumeScaling(dt: number) {
    this.stations.forEach((st) => {
      st.scaleTarget = clamp(1.0 + st.visitCount * 0.12, 0.9, 1.4);
      const lerpSpeed = 0.003;
      st.scaleCurrent += (st.scaleTarget - st.scaleCurrent) * lerpSpeed * dt;
      st.container.scale.set(st.scaleCurrent);
    });
  }

  recordVisit(stationIdx: number) {
    if (this.stations[stationIdx]) {
      this.stations[stationIdx].visitCount++;
    }
  }

  resetVisitCounts() {
    this.stations.forEach((st) => {
      st.visitCount = Math.max(0, st.visitCount - 1);
    });
  }

  handleResize() {
    this.stations.forEach((st) => {
      st.container.x = st.rx * this.W();
      st.container.y = st.ry * this.H();
    });
  }
}
