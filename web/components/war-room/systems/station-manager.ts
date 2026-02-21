import type {
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Text as PixiText,
  Sprite as PixiSprite,
} from 'pixi.js';
import type { TokenDef, TokenStation, TokenMetrics, AgentState, Conversation } from '../types';
import { STATION_POSITIONS } from '../constants';
import { fmtMinsAgo, fmtCompact, clamp } from '../helpers';

interface PixiModules {
  Container: new () => PixiContainer;
  Graphics: new () => PixiGraphics;
  Text: new (opts: { text: string; style: unknown }) => PixiText;
  TextStyle: new (opts: Record<string, unknown>) => unknown;
  Assets: { load: (url: string) => Promise<unknown> };
  Sprite: new (texture: any) => PixiSprite;
}

// ── Collapsed card ───────────────────────────────────────────────────────────
const C_SIZE = 52;
const C_HALF = C_SIZE / 2;
const C_IMG  = 28;
const C_PAD  = 5;

// ── Expanded card ────────────────────────────────────────────────────────────
const E_BW   = 88;
const E_BH   = 34;
const E_PAD  = 7;
const E_IMG  = 26;
const E_METRICS_W = 48;

// ── Animation ────────────────────────────────────────────────────────────────
const EXPAND_SPEED = 0.006;  // progress per ms (~170ms full transition)

function drawFancyBorder(
  g: PixiGraphics, x: number, y: number, w: number, h: number,
  cornerLen: number, dashLen: number, gapLen: number,
  color: number, alpha: number, lineWidth: number,
) {
  g.setStrokeStyle({ width: lineWidth, color, alpha });
  g.moveTo(x, y); g.lineTo(x + cornerLen, y);
  g.moveTo(x, y); g.lineTo(x, y + cornerLen);
  g.moveTo(x + w - cornerLen, y); g.lineTo(x + w, y);
  g.moveTo(x + w, y); g.lineTo(x + w, y + cornerLen);
  g.moveTo(x, y + h - cornerLen); g.lineTo(x, y + h);
  g.moveTo(x, y + h); g.lineTo(x + cornerLen, y + h);
  g.moveTo(x + w, y + h - cornerLen); g.lineTo(x + w, y + h);
  g.moveTo(x + w - cornerLen, y + h); g.lineTo(x + w, y + h);
  g.stroke();

  g.setStrokeStyle({ width: lineWidth, color, alpha: alpha * 0.45 });
  drawDashedLine(g, x + cornerLen, y, x + w - cornerLen, y, dashLen, gapLen);
  drawDashedLine(g, x + cornerLen, y + h, x + w - cornerLen, y + h, dashLen, gapLen);
  drawDashedLine(g, x, y + cornerLen, x, y + h - cornerLen, dashLen, gapLen);
  drawDashedLine(g, x + w, y + cornerLen, x + w, y + h - cornerLen, dashLen, gapLen);
  g.stroke();
}

function drawDashedLine(
  g: PixiGraphics,
  x1: number, y1: number, x2: number, y2: number,
  dashLen: number, gapLen: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const nx = dx / len;
  const ny = dy / len;
  let pos = 0;
  while (pos < len) {
    const segEnd = Math.min(pos + dashLen, len);
    g.moveTo(x1 + nx * pos, y1 + ny * pos);
    g.lineTo(x1 + nx * segEnd, y1 + ny * segEnd);
    pos += dashLen + gapLen;
  }
}

/** Ease-out cubic for smooth deceleration */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
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
          imageUrl: undefined as string | undefined,
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
      container.eventMode = 'static';
      container.cursor = 'pointer';

      const brandColor = def.isNew ? 0xffcc00 : 0xe8b45e;
      const borderAlpha = def.isOld ? 0.3 : def.isNew ? 1.0 : 0.7;
      const lineW = def.isNew ? 1.8 : 1.2;

      // ── Glow ───────────────────────────────────────────────────────────────
      const glowColor = def.isNew ? 0xffcc00 : 0xe8b45e;
      const glowAlpha = def.isNew ? 0.18 : def.isOld ? 0.02 : 0.05;
      const glow = new Graphics();
      glow.rect(-C_HALF - 6, -C_HALF - 6, C_SIZE + 12, C_SIZE + 12);
      glow.fill({ color: glowColor, alpha: glowAlpha });

      // ═════════════════════════════════════════════════════════════════════════
      // COLLAPSED STATE — small square: image centered + ticker below
      // ═════════════════════════════════════════════════════════════════════════
      const collapsedGroup = new Container();

      const cBox = new Graphics();
      cBox.rect(-C_HALF, -C_HALF, C_SIZE, C_SIZE);
      cBox.fill({ color: 0x0a0a0a, alpha: 0.92 });

      const cBorder = new Graphics();
      drawFancyBorder(cBorder, -C_HALF, -C_HALF, C_SIZE, C_SIZE, 10, 4, 3, brandColor, borderAlpha, lineW);

      const cImgX = -C_IMG / 2;
      const cImgY = -C_HALF + C_PAD;
      const cImgPlaceholder = new Graphics();
      cImgPlaceholder.rect(cImgX, cImgY, C_IMG, C_IMG);
      cImgPlaceholder.fill({ color: 0x141414, alpha: 0.8 });
      cImgPlaceholder.setStrokeStyle({ width: 0.5, color: brandColor, alpha: 0.2 });
      cImgPlaceholder.rect(cImgX, cImgY, C_IMG, C_IMG);
      cImgPlaceholder.stroke();

      const cTicker = new Text({
        text: def.ticker,
        style: new TextStyle({
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 8,
          fontWeight: '800',
          fill: def.isNew ? 0xffcc00 : def.isOld ? 0x888888 : 0xe8b45e,
          letterSpacing: 0.5,
        }),
      });
      cTicker.anchor.set(0.5, 0);
      cTicker.x = 0;
      cTicker.y = cImgY + C_IMG + 3;

      if (def.isNew) {
        const cNewBg = new Graphics();
        cNewBg.rect(C_HALF - 18, -C_HALF + 1, 18, 10);
        cNewBg.fill({ color: 0xffcc00 });
        const cNewText = new Text({
          text: 'NEW',
          style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 5, fontWeight: '900', fill: 0x000000 }),
        });
        cNewText.anchor.set(1, 0);
        cNewText.x = C_HALF - 2;
        cNewText.y = -C_HALF + 2;
        collapsedGroup.addChild(cNewBg, cNewText);
      }

      collapsedGroup.addChild(cBox, cBorder, cImgPlaceholder, cTicker);

      // ═════════════════════════════════════════════════════════════════════════
      // EXPANDED STATE — full panel that slides out
      // ═════════════════════════════════════════════════════════════════════════
      const expandedGroup = new Container();
      expandedGroup.visible = false;
      expandedGroup.alpha = 0;

      const eBox = new Graphics();
      eBox.rect(-E_BW, -E_BH, E_BW * 2, E_BH * 2);
      eBox.fill({ color: 0x0a0a0a, alpha: 0.95 });

      const eBorder = new Graphics();
      drawFancyBorder(eBorder, -E_BW, -E_BH, E_BW * 2, E_BH * 2, 12, 5, 4, brandColor, borderAlpha, lineW);

      const divX = E_BW - E_METRICS_W - E_PAD;
      const eDivider = new Graphics();
      eDivider.setStrokeStyle({ width: 0.5, color: brandColor, alpha: 0.15 });
      eDivider.moveTo(divX, -E_BH + E_PAD);
      eDivider.lineTo(divX, E_BH - E_PAD);
      eDivider.stroke();

      // Left: image + text
      const leftX = -E_BW + E_PAD;
      const eImgX = leftX;
      const eImgY = -E_BH + E_PAD;

      const eImgPlaceholder = new Graphics();
      eImgPlaceholder.rect(eImgX, eImgY, E_IMG, E_IMG);
      eImgPlaceholder.fill({ color: 0x141414, alpha: 0.8 });
      eImgPlaceholder.setStrokeStyle({ width: 0.5, color: brandColor, alpha: 0.2 });
      eImgPlaceholder.rect(eImgX, eImgY, E_IMG, E_IMG);
      eImgPlaceholder.stroke();

      const eTextX = eImgX + E_IMG + 6;

      const eTickerText = new Text({
        text: def.ticker,
        style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: '800', fill: def.isNew ? 0xffcc00 : def.isOld ? 0x888888 : 0xe8b45e, letterSpacing: 1 }),
      });
      eTickerText.x = eTextX;
      eTickerText.y = eImgY + 2;

      const shortName = def.name.length > 12 ? def.name.slice(0, 11) + '..' : def.name;
      const eNameText = new Text({
        text: shortName,
        style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 7, fill: def.isOld ? 0x555555 : 0x999999 }),
      });
      eNameText.x = eTextX;
      eNameText.y = eImgY + 15;

      const eTimeText = new Text({
        text: fmtMinsAgo(def.detectedAt),
        style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 6, fill: def.isNew ? 0xffcc00 : def.isOld ? 0x444444 : 0x555555 }),
      });
      eTimeText.x = leftX;
      eTimeText.y = E_BH - E_PAD - 8;

      // Right: metrics
      const mX = divX + 8;
      const labelStyle = new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 5, fill: 0x444444, letterSpacing: 0.5 });

      const mcapLabel = new Text({ text: 'MCAP', style: labelStyle });
      mcapLabel.x = mX; mcapLabel.y = -E_BH + E_PAD;

      const metricPriceText = new Text({
        text: '—',
        style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fontWeight: '800', fill: 0xffffff }),
      });
      metricPriceText.x = mX; metricPriceText.y = -E_BH + E_PAD + 8;

      const holdersLabel = new Text({ text: 'HOLDERS', style: labelStyle });
      holdersLabel.x = mX; holdersLabel.y = -E_BH + E_PAD + 26;

      const metricHoldersText = new Text({
        text: '—',
        style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fontWeight: '800', fill: 0xe8b45e }),
      });
      metricHoldersText.x = mX; metricHoldersText.y = -E_BH + E_PAD + 34;

      if (def.isNew) {
        const eNewBg = new Graphics();
        eNewBg.rect(E_BW - E_PAD - 22, -E_BH + 2, 24, 12);
        eNewBg.fill({ color: 0xffcc00 });
        const eNewText = new Text({
          text: 'NEW',
          style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 6, fontWeight: '900', fill: 0x000000 }),
        });
        eNewText.anchor.set(1, 0);
        eNewText.x = E_BW - E_PAD; eNewText.y = -E_BH + 4;
        expandedGroup.addChild(eNewBg, eNewText);
      }

      expandedGroup.addChild(
        eBox, eBorder, eDivider, eImgPlaceholder,
        eTickerText, eNameText, eTimeText,
        mcapLabel, metricPriceText, holdersLabel, metricHoldersText,
      );

      // ═════════════════════════════════════════════════════════════════════════
      // Shared
      // ═════════════════════════════════════════════════════════════════════════
      const dot = new Graphics();
      dot.rect(-2, C_HALF + 4, 4, 4);
      dot.fill({ color: def.isNew ? 0xffcc00 : 0xffaa00 });

      const coordinationRing = new Graphics();
      coordinationRing.visible = false;

      const chatIcon = new Text({ text: '', style: new TextStyle({ fontSize: 12 }) });
      chatIcon.anchor.set(0.5, 1);
      chatIcon.x = C_HALF - 4; chatIcon.y = -C_HALF + 2;
      chatIcon.visible = false;

      container.addChild(glow, collapsedGroup, expandedGroup, dot, coordinationRing, chatIcon);
      this.stationsLayer.addChild(container);

      // Click to toggle
      container.on('pointertap', () => {
        const stIdx = this.stations.findIndex((s) => s.container === container);
        if (stIdx !== -1) this.toggleExpanded(stIdx);
      });

      const station: TokenStation = {
        ticker: def.ticker,
        name: def.name,
        mint: def.mint,
        imageUrl: def.imageUrl,
        rx: def.rx, ry: def.ry,
        detectedAt: def.detectedAt,
        isNew: def.isNew, isOld: def.isOld,
        container,
        priceText: eNameText,
        dot, box: cBox,
        glowGraphics: glow,
        timeText: eTimeText,
        coordinationRing, chatIcon,
        imageSprite: null,
        collapsedGroup, collapsedBox: cBox, collapsedBorder: cBorder,
        expandedGroup, expandedBox: eBox, expandedBorder: eBorder,
        metricPriceText, metricHoldersText,
        metrics: null,
        expanded: false,
        expandProgress: 0,
        expandTarget: 0,
        visitCount: 0,
        scaleTarget: 1.0, scaleCurrent: 1.0,
      };

      this.stations.push(station);

      if (def.imageUrl) {
        this.loadTokenImage(station, def.imageUrl, cImgX, cImgY, C_IMG, collapsedGroup);
        this.loadTokenImage(station, def.imageUrl, eImgX, eImgY, E_IMG, expandedGroup);
      }
    });
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // EXPAND / COLLAPSE
  // ═════════════════════════════════════════════════════════════════════════════

  toggleExpanded(stationIdx: number) {
    const st = this.stations[stationIdx];
    if (!st) return;

    // Collapse any other expanded station
    this.stations.forEach((s, i) => {
      if (i !== stationIdx && s.expanded) {
        s.expanded = false;
        s.expandTarget = 0;
      }
    });

    st.expanded = !st.expanded;
    st.expandTarget = st.expanded ? 1 : 0;

    // Make expanded group visible immediately when opening (animation handles alpha/scale)
    if (st.expanded) {
      st.expandedGroup.visible = true;
    }
  }

  /**
   * Smooth expand/collapse animation. Call every frame.
   * - Collapsed card scales up slightly as panel opens
   * - Expanded panel scales from 0.5→1 and fades in with ease-out
   * - Glow smoothly resizes
   */
  updateExpandAnimation(dt: number) {
    this.stations.forEach((st) => {
      const prev = st.expandProgress;

      // Lerp toward target
      if (st.expandTarget > st.expandProgress) {
        st.expandProgress = Math.min(st.expandTarget, st.expandProgress + EXPAND_SPEED * dt);
      } else if (st.expandTarget < st.expandProgress) {
        st.expandProgress = Math.max(st.expandTarget, st.expandProgress - EXPAND_SPEED * dt);
      }

      // Skip update if nothing changed
      if (st.expandProgress === prev) return;

      const t = easeOut(st.expandProgress);

      // ── Collapsed group ────────────────────────────────────────────────────
      // Shrinks and fades as panel opens
      st.collapsedGroup.alpha = 1 - t;
      st.collapsedGroup.scale.set(1 + t * 0.15);  // subtle grow before disappearing
      st.collapsedGroup.visible = st.expandProgress < 0.99;

      // ── Expanded group ─────────────────────────────────────────────────────
      // Scales up from center and fades in
      st.expandedGroup.alpha = t;
      st.expandedGroup.scale.set(0.4 + t * 0.6);  // 0.4 → 1.0
      st.expandedGroup.visible = st.expandProgress > 0.01;

      // ── Glow interpolation ─────────────────────────────────────────────────
      // Smoothly grow glow from collapsed to expanded size
      st.glowGraphics.clear();
      const gHW = C_HALF + 6 + t * (E_BW + 6 - C_HALF - 6);  // half-width
      const gHH = C_HALF + 6 + t * (E_BH + 6 - C_HALF - 6);  // half-height
      const glowColor = st.isNew ? 0xffcc00 : 0xe8b45e;
      const glowAlpha = (st.isNew ? 0.18 : st.isOld ? 0.02 : 0.05) + t * 0.06;
      st.glowGraphics.rect(-gHW, -gHH, gHW * 2, gHH * 2);
      st.glowGraphics.fill({ color: glowColor, alpha: glowAlpha });

      // ── Dot position ───────────────────────────────────────────────────────
      const dotY = C_HALF + 4 + t * (E_BH + 4 - C_HALF - 4);
      st.dot.clear();
      st.dot.rect(-2, dotY, 4, 4);
      st.dot.fill({ color: st.isNew ? 0xffcc00 : 0xffaa00 });
    });
  }

  /** Auto-expand the station with the most agent visits. */
  autoExpandMostActive() {
    if (this.stations.length === 0) return;

    let bestIdx = -1;
    let bestVisits = 0;
    this.stations.forEach((st, i) => {
      if (st.visitCount > bestVisits) {
        bestVisits = st.visitCount;
        bestIdx = i;
      }
    });

    const currentlyExpanded = this.stations.findIndex((s) => s.expanded);

    // Nothing expanded + there's activity → open the busiest
    if (currentlyExpanded === -1 && bestIdx !== -1 && bestVisits > 0) {
      this.stations[bestIdx].expanded = true;
      this.stations[bestIdx].expandTarget = 1;
      this.stations[bestIdx].expandedGroup.visible = true;
    }

    // Currently expanded station went idle, another is active → switch
    if (currentlyExpanded !== -1 && bestIdx !== -1 && bestIdx !== currentlyExpanded
        && bestVisits > 0 && this.stations[currentlyExpanded].visitCount === 0) {
      this.stations[currentlyExpanded].expanded = false;
      this.stations[currentlyExpanded].expandTarget = 0;
      this.stations[bestIdx].expanded = true;
      this.stations[bestIdx].expandTarget = 1;
      this.stations[bestIdx].expandedGroup.visible = true;
    }
  }

  updateStationMetrics(stationIdx: number, metrics: TokenMetrics) {
    const st = this.stations[stationIdx];
    if (!st) return;
    st.metrics = metrics;
    st.metricPriceText.text = fmtCompact(metrics.marketCap);
    st.metricHoldersText.text = metrics.holders > 0 ? metrics.holders.toLocaleString('en-US') : '—';
  }

  private async loadTokenImage(
    station: TokenStation, url: string,
    imgX: number, imgY: number, size: number,
    parent: PixiContainer,
  ) {
    try {
      const { Assets, Sprite, Graphics } = this.pixi;
      const texture = await Assets.load(url);
      const sprite = new Sprite(texture);
      sprite.x = imgX; sprite.y = imgY;
      sprite.width = size; sprite.height = size;
      const mask = new Graphics();
      mask.rect(imgX, imgY, size, size);
      mask.fill({ color: 0xffffff });
      parent.addChild(mask);
      sprite.mask = mask;
      parent.addChild(sprite);
      if (!station.imageSprite) station.imageSprite = sprite;
    } catch {
      // Keep placeholder
    }
  }

  updateTimeLabels() {
    this.stations.forEach((st) => { st.timeText.text = fmtMinsAgo(st.detectedAt); });
  }

  updateGlowPulse(now: number) {
    const pulseAlpha = 0.10 + 0.08 * Math.sin(now / 400);
    this.stations.forEach((st) => {
      if (st.isNew) st.glowGraphics.alpha = pulseAlpha * 2.5;
    });
  }

  updateCoordination(
    now: number, agentStates: AgentState[],
    coordLinesLayer: PixiContainer, conversations: Conversation[],
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
        const rW = (st.expanded ? 94 : 36) * ringScale;
        const rH = (st.expanded ? 40 : 36) * ringScale;
        drawFancyBorder(st.coordinationRing, -rW, -rH, rW * 2, rH * 2, 14, 6, 4, 0xe8b45e, 0.5 + 0.3 * Math.sin(now / 300), 2.0);
        st.coordinationRing.visible = true;
        st.glowGraphics.alpha = 0.25 + 0.1 * Math.sin(now / 400);

        for (let a = 0; a < occupants.length - 1; a++) {
          for (let b = a + 1; b < occupants.length; b++) {
            const line = new Graphics();
            line.setStrokeStyle({ width: 1, color: 0xe8b45e, alpha: 0.4 + 0.2 * Math.sin(now / 300) });
            drawDashedLine(line, occupants[a].container.x, occupants[a].container.y, occupants[b].container.x, occupants[b].container.y, 6, 4);
            line.stroke();
            coordLinesLayer.addChild(line);
          }
        }
      } else {
        st.coordinationRing.visible = false;
      }

      st.chatIcon.visible = conversations.some((c) => st.mint && c.tokenMint === st.mint);
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
    if (this.stations[stationIdx]) this.stations[stationIdx].visitCount++;
  }

  resetVisitCounts() {
    this.stations.forEach((st) => { st.visitCount = Math.max(0, st.visitCount - 1); });
  }

  handleResize() {
    this.stations.forEach((st) => {
      st.container.x = st.rx * this.W();
      st.container.y = st.ry * this.H();
    });
  }
}
