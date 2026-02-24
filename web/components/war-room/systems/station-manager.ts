import type {
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Text as PixiText,
  Sprite as PixiSprite,
} from 'pixi.js';
import type { Chain, TokenDef, TokenStation, TokenMetrics, AgentState, Conversation, ScannerCallData, ScannerCallsMap } from '../types';
import { STATION_POSITIONS, SCANNER_COLORS, MONO_FONT } from '../constants';
import { fmtMinsAgo, fmtCompact, clamp } from '../helpers';

// Chain badge colors
const CHAIN_COLORS: Record<Chain, number> = {
  SOL: 0x9945ff,   // Solana purple
  BASE: 0x0052ff,  // Base blue
  BSC: 0xf0b90b,   // Binance yellow
};

interface PixiModules {
  Container: new () => PixiContainer;
  Graphics: new () => PixiGraphics;
  Text: new (opts: { text: string; style: unknown }) => PixiText;
  TextStyle: new (opts: Record<string, unknown>) => unknown;
  Assets: { load: (url: string) => Promise<unknown> };
  Sprite: new (texture: any) => PixiSprite;
}

// ── Collapsed card ───────────────────────────────────────────────────────────
const C_SIZE = 90;
const C_HALF = C_SIZE / 2;
const C_IMG  = 72;
const C_PAD  = 6;

// ── Expanded card ────────────────────────────────────────────────────────────
const E_BW   = 140;
const E_BH   = 60;
const E_PAD  = 10;
const E_IMG  = 52;
const E_METRICS_W = 65;

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
  /** Texture cache: URL → PixiJS Texture (avoids duplicate image loads per station) */
  private textureCache: Map<string, any> = new Map();

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
          chain: 'SOL' as Chain,
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

      // ── Glow (around image only, not old container) ───────────────────────
      const glowColor = def.isNew ? 0xffcc00 : 0xe8b45e;
      const glowAlpha = def.isNew ? 0.22 : def.isOld ? 0.03 : 0.08;  // Slightly stronger since smaller
      const glow = new Graphics();
      const glowSize = C_IMG + 10;  // Just around the image
      glow.rect(-glowSize / 2, -glowSize / 2, glowSize, glowSize);
      glow.fill({ color: glowColor, alpha: glowAlpha });

      // ═════════════════════════════════════════════════════════════════════════
      // COLLAPSED STATE — floating image with ticker below (NO CONTAINER)
      // ═════════════════════════════════════════════════════════════════════════
      const collapsedGroup = new Container();

      // REMOVED: cBox (background)
      // REMOVED: cBorder (fancy border)

      const cImgX = -C_IMG / 2;
      const cImgY = -C_IMG / 2;  // Center the image vertically now
      const cImgPlaceholder = new Graphics();
      cImgPlaceholder.rect(cImgX, cImgY, C_IMG, C_IMG);
      cImgPlaceholder.fill({ color: 0x141414, alpha: 0.6 });
      // Subtle border glow
      cImgPlaceholder.setStrokeStyle({ width: 1, color: brandColor, alpha: borderAlpha * 0.5 });
      cImgPlaceholder.rect(cImgX, cImgY, C_IMG, C_IMG);
      cImgPlaceholder.stroke();

      const cTicker = new Text({
        text: def.ticker,
        style: new TextStyle({
          fontFamily: MONO_FONT,
          fontSize: 13,
          fontWeight: '800',
          fill: def.isNew ? 0xffcc00 : def.isOld ? 0x888888 : 0xe8b45e,
          letterSpacing: 0.8,
        }),
      });
      cTicker.anchor.set(0.5, 0);
      cTicker.x = 0;
      cTicker.y = cImgY + C_IMG + 6;

      // Token name below ticker (truncated, grey)
      const shortCollapsedName = def.name.length > 14 ? def.name.slice(0, 13) + '..' : def.name;
      const cName = new Text({
        text: shortCollapsedName,
        style: new TextStyle({
          fontFamily: MONO_FONT,
          fontSize: 10,
          fill: 0x777777,
        }),
      });
      cName.anchor.set(0.5, 0);
      cName.x = 0;
      cName.y = cImgY + C_IMG + 22;

      if (def.isNew) {
        const cNewBg = new Graphics();
        cNewBg.rect(cImgX + C_IMG - 30, cImgY - 16, 30, 14);
        cNewBg.fill({ color: 0xffcc00 });
        const cNewText = new Text({
          text: 'NEW',
          style: new TextStyle({ fontFamily: MONO_FONT, fontSize: 8, fontWeight: '900', fill: 0x000000 }),
        });
        cNewText.anchor.set(1, 0);
        cNewText.x = cImgX + C_IMG - 3;
        cNewText.y = cImgY - 14;
        collapsedGroup.addChild(cNewBg, cNewText);
      }

      // ── Chain badge (collapsed) — OVERLAY ON IMAGE (top-right corner)
      const chainColor = CHAIN_COLORS[def.chain] ?? 0x9945ff;
      const cChainBadge = new Graphics();
      const cBadgeX = cImgX + C_IMG - 9;
      const cBadgeY = cImgY + 9;
      cChainBadge.circle(cBadgeX, cBadgeY, 9);
      cChainBadge.fill({ color: chainColor });
      cChainBadge.setStrokeStyle({ width: 1.5, color: 0x000000, alpha: 0.8 });
      cChainBadge.circle(cBadgeX, cBadgeY, 9);
      cChainBadge.stroke();
      const cChainLabel = new Text({
        text: def.chain,
        style: new TextStyle({ fontFamily: MONO_FONT, fontSize: 8, fontWeight: '900', fill: 0xffffff }),
      });
      cChainLabel.anchor.set(0.5, 0.5);
      cChainLabel.x = cBadgeX;
      cChainLabel.y = cBadgeY;

      collapsedGroup.addChild(cImgPlaceholder, cTicker, cName, cChainBadge, cChainLabel);  // REMOVED: cBox, cBorder

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
        style: new TextStyle({ fontFamily: MONO_FONT, fontSize: 14, fontWeight: '800', fill: def.isNew ? 0xffcc00 : def.isOld ? 0x888888 : 0xe8b45e, letterSpacing: 1 }),
      });
      eTickerText.x = eTextX;
      eTickerText.y = eImgY + 2;

      const shortName = def.name.length > 16 ? def.name.slice(0, 15) + '..' : def.name;
      const eNameText = new Text({
        text: shortName,
        style: new TextStyle({ fontFamily: MONO_FONT, fontSize: 10, fill: def.isOld ? 0x555555 : 0x999999 }),
      });
      eNameText.x = eTextX;
      eNameText.y = eImgY + 20;

      const eTimeText = new Text({
        text: fmtMinsAgo(def.detectedAt),
        style: new TextStyle({ fontFamily: MONO_FONT, fontSize: 9, fill: def.isNew ? 0xffcc00 : def.isOld ? 0x444444 : 0x555555 }),
      });
      eTimeText.x = leftX;
      eTimeText.y = E_BH - E_PAD - 12;

      // Right: metrics
      const mX = divX + 10;
      const labelStyle = new TextStyle({ fontFamily: MONO_FONT, fontSize: 8, fill: 0x555555, letterSpacing: 0.5 });

      const mcapLabel = new Text({ text: 'MCAP', style: labelStyle });
      mcapLabel.x = mX; mcapLabel.y = -E_BH + E_PAD;

      const metricPriceText = new Text({
        text: '—',
        style: new TextStyle({ fontFamily: MONO_FONT, fontSize: 12, fontWeight: '800', fill: 0xffffff }),
      });
      metricPriceText.x = mX; metricPriceText.y = -E_BH + E_PAD + 12;

      const holdersLabel = new Text({ text: 'VOL 24H', style: labelStyle });
      holdersLabel.x = mX; holdersLabel.y = -E_BH + E_PAD + 36;

      const metricHoldersText = new Text({
        text: '—',
        style: new TextStyle({ fontFamily: MONO_FONT, fontSize: 12, fontWeight: '800', fill: 0xe8b45e }),
      });
      metricHoldersText.x = mX; metricHoldersText.y = -E_BH + E_PAD + 48;

      if (def.isNew) {
        const eNewBg = new Graphics();
        eNewBg.rect(E_BW - E_PAD - 30, -E_BH + 2, 32, 16);
        eNewBg.fill({ color: 0xffcc00 });
        const eNewText = new Text({
          text: 'NEW',
          style: new TextStyle({ fontFamily: MONO_FONT, fontSize: 9, fontWeight: '900', fill: 0x000000 }),
        });
        eNewText.anchor.set(1, 0);
        eNewText.x = E_BW - E_PAD; eNewText.y = -E_BH + 4;
        expandedGroup.addChild(eNewBg, eNewText);
      }

      // ── Chain badge (expanded) — OVERLAY ON IMAGE (top-right corner)
      const eChainBadge = new Graphics();
      const eBadgeX = eImgX + E_IMG - 10;
      const eBadgeY = eImgY + 10;
      eChainBadge.circle(eBadgeX, eBadgeY, 10);
      eChainBadge.fill({ color: chainColor });
      eChainBadge.setStrokeStyle({ width: 1.5, color: 0x000000, alpha: 0.8 });
      eChainBadge.circle(eBadgeX, eBadgeY, 10);
      eChainBadge.stroke();
      const eChainText = new Text({
        text: def.chain,
        style: new TextStyle({ fontFamily: MONO_FONT, fontSize: 8, fontWeight: '900', fill: 0xffffff }),
      });
      eChainText.anchor.set(0.5, 0.5);
      eChainText.x = eBadgeX;
      eChainText.y = eBadgeY;

      expandedGroup.addChild(
        eBox, eBorder, eDivider, eImgPlaceholder,
        eTickerText, eNameText, eTimeText,
        mcapLabel, metricPriceText, holdersLabel, metricHoldersText,
        eChainBadge, eChainText,
      );

      // ═════════════════════════════════════════════════════════════════════════
      // Shared
      // ═════════════════════════════════════════════════════════════════════════
      const dot = new Graphics();
      const dotY = C_IMG / 2 + 4;  // Position below image (no container anymore)
      dot.rect(-2, dotY, 4, 4);
      dot.fill({ color: def.isNew ? 0xffcc00 : 0xffaa00 });

      const coordinationRing = new Graphics();
      coordinationRing.visible = false;

      const chatIcon = new Text({ text: '💬', style: new TextStyle({ fontSize: 12 }) });
      chatIcon.anchor.set(0.5, 1);
      chatIcon.x = C_IMG / 2 - 4;  // Top-right of image
      chatIcon.y = -C_IMG / 2 + 2;
      chatIcon.visible = false;

      // Scanner dots container (positioned below collapsed image, left side)
      const scannerDotsContainer = new Container();
      scannerDotsContainer.y = -C_IMG / 2 - 10;
      scannerDotsContainer.x = -C_IMG / 2;

      container.addChild(glow, collapsedGroup, expandedGroup, dot, coordinationRing, chatIcon, scannerDotsContainer);
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
        chain: def.chain,
        rx: def.rx, ry: def.ry,
        detectedAt: def.detectedAt,
        isNew: def.isNew, isOld: def.isOld,
        container,
        priceText: eNameText,
        dot, box: cImgPlaceholder,  // Use placeholder as "box" reference
        glowGraphics: glow,
        timeText: eTimeText,
        coordinationRing, chatIcon,
        imageSprite: null,
        collapsedGroup, collapsedBox: cImgPlaceholder, collapsedBorder: new (this.pixi.Graphics)(),  // Dummy border
        expandedGroup, expandedBox: eBox, expandedBorder: eBorder,
        metricPriceText, metricHoldersText,
        metrics: null,
        expanded: false,
        expandProgress: 0,
        expandTarget: 0,
        visitCount: 0,
        scaleTarget: 1.0, scaleCurrent: 1.0,
        scannerDotsContainer,
        scannerCalls: [],
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
      // Smoothly grow glow from collapsed image to expanded size
      st.glowGraphics.clear();
      const collapsedGlowHalf = (C_IMG + 10) / 2;  // Half of collapsed glow size
      const gHW = collapsedGlowHalf + t * (E_BW + 6 - collapsedGlowHalf);  // half-width
      const gHH = collapsedGlowHalf + t * (E_BH + 6 - collapsedGlowHalf);  // half-height
      const glowColor = st.isNew ? 0xffcc00 : 0xe8b45e;
      const glowAlpha = (st.isNew ? 0.22 : st.isOld ? 0.03 : 0.08) + t * 0.06;
      st.glowGraphics.rect(-gHW, -gHH, gHW * 2, gHH * 2);
      st.glowGraphics.fill({ color: glowColor, alpha: glowAlpha });

      // ── Dot position ───────────────────────────────────────────────────────
      const collapsedDotY = C_IMG / 2 + 4;
      const expandedDotY = E_BH + 4;
      const dotY = collapsedDotY + t * (expandedDotY - collapsedDotY);
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
    st.metricHoldersText.text = metrics.volume24h > 0 ? fmtCompact(metrics.volume24h) : '—';

    // If image failed to load and backend provided a CDN URL, retry
    if (!st.imageSprite && metrics.imageUrl) {
      const cImgX = -C_IMG / 2;
      const cImgY = -C_IMG / 2;
      const leftX = -E_BW + E_PAD;
      this.loadTokenImage(st, metrics.imageUrl, cImgX, cImgY, C_IMG, st.collapsedGroup);
      this.loadTokenImage(st, metrics.imageUrl, leftX, -E_BH + E_PAD, E_IMG, st.expandedGroup);
    }
  }

  /**
   * Rewrite IPFS URLs to a faster gateway. The default ipfs.io gateway
   * is extremely unreliable (timeouts, HTML error pages, CORS issues).
   */
  private rewriteIpfsUrl(url: string): string {
    // ipfs.io → Pinata public gateway (fast, CORS-safe, returns proper content-type)
    if (url.includes('ipfs.io/ipfs/')) {
      return url.replace('https://ipfs.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/');
    }
    return url;
  }

  private async loadTokenImage(
    station: TokenStation, url: string,
    imgX: number, imgY: number, size: number,
    parent: PixiContainer,
  ) {
    try {
      const { Sprite, Graphics } = this.pixi;
      const resolved = this.rewriteIpfsUrl(url);

      // Check texture cache first (avoids duplicate network requests for collapsed + expanded)
      let tex = this.textureCache.get(resolved);
      if (!tex) {
        // Load via HTML Image to avoid PixiJS null-texture crash
        const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Image load failed'));
          img.src = resolved;
          // Timeout after 8s — IPFS can be slow
          setTimeout(() => reject(new Error('Image load timeout')), 8000);
        });

        // Import Texture at runtime to create from the loaded HTMLImageElement
        const { Texture } = await import('pixi.js');
        tex = Texture.from(imgEl);
        if (!tex || !tex.source) return; // safety: skip if still null
        this.textureCache.set(resolved, tex);
      }

      const sprite = new Sprite(tex);
      sprite.x = imgX; sprite.y = imgY;
      sprite.width = size; sprite.height = size;
      const mask = new Graphics();
      mask.rect(imgX, imgY, size, size);
      mask.fill({ color: 0xffffff });
      parent.addChild(mask);
      sprite.mask = mask;
      parent.addChild(sprite);
      if (!station.imageSprite) station.imageSprite = sprite;
    } catch (err) {
      console.warn(`[StationManager] Image failed for ${station.ticker}: ${url}`, err instanceof Error ? err.message : err);
    }
  }

  updateTimeLabels() {
    this.stations.forEach((st) => { st.timeText.text = fmtMinsAgo(st.detectedAt); });
  }

  updateGlowPulse(now: number) {
    const pulseAlpha = 0.10 + 0.08 * Math.sin(now / 400);
    this.stations.forEach((st) => {
      if (st.isNew) {
        st.glowGraphics.alpha = pulseAlpha * 2.5;
      } else if (st.scannerCalls.length > 0) {
        // Scanner-active stations get a stronger, faster pulse
        const scannerPulse = 0.15 + 0.12 * Math.sin(now / 300);
        st.glowGraphics.alpha = scannerPulse * (1 + st.scannerCalls.length * 0.3);
      }
    });
  }

  /** Persistent Graphics for coordination lines (reused each frame to avoid GC churn) */
  private coordLinesGraphics: PixiGraphics | null = null;

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

    // Use a single persistent Graphics for all coordination lines
    if (!this.coordLinesGraphics) {
      this.coordLinesGraphics = new Graphics();
      coordLinesLayer.addChild(this.coordLinesGraphics);
    }
    this.coordLinesGraphics.clear();

    this.stations.forEach((st, idx) => {
      const occupants = stationOccupants[idx] ?? [];
      const hasCoordination = occupants.length >= 2;

      if (hasCoordination) {
        const ringScale = 1.0 + 0.08 * Math.sin(now / 500);
        st.coordinationRing.clear();
        const rW = (st.expanded ? E_BW + 6 : C_IMG / 2 + 10) * ringScale;
        const rH = (st.expanded ? E_BH + 6 : C_IMG / 2 + 10) * ringScale;
        drawFancyBorder(st.coordinationRing, -rW, -rH, rW * 2, rH * 2, 14, 6, 4, 0xe8b45e, 0.5 + 0.3 * Math.sin(now / 300), 2.0);
        st.coordinationRing.visible = true;
        st.glowGraphics.alpha = 0.25 + 0.1 * Math.sin(now / 400);

        const lineAlpha = 0.4 + 0.2 * Math.sin(now / 300);
        for (let a = 0; a < occupants.length - 1; a++) {
          for (let b = a + 1; b < occupants.length; b++) {
            this.coordLinesGraphics!.setStrokeStyle({ width: 1, color: 0xe8b45e, alpha: lineAlpha });
            drawDashedLine(this.coordLinesGraphics!, occupants[a].container.x, occupants[a].container.y, occupants[b].container.x, occupants[b].container.y, 6, 4);
            this.coordLinesGraphics!.stroke();
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

  /**
   * Update scanner call overlays on stations.
   * Renders colored dots for each scanner with an open call on that token.
   */
  updateScannerOverlays(callsMap: ScannerCallsMap) {
    const { Graphics, Text, TextStyle } = this.pixi;

    this.stations.forEach((st) => {
      st.scannerDotsContainer.removeChildren();

      const calls = st.mint ? (callsMap[st.mint] ?? []) : [];
      st.scannerCalls = calls;

      if (calls.length === 0) return;

      // Render a colored dot per scanner
      calls.forEach((call, i) => {
        const scannerKey = call.scannerName?.toLowerCase() ?? call.scannerId;
        const color = SCANNER_COLORS[scannerKey] ?? 0xffffff;
        const g = new Graphics();
        g.circle(i * 14, 0, 5);
        g.fill({ color, alpha: 0.9 });
        // Glow
        g.circle(i * 14, 0, 9);
        g.fill({ color, alpha: 0.15 });
        st.scannerDotsContainer.addChild(g);

        // Conviction mini-label for first call
        if (i === 0) {
          const convLabel = new Text({
            text: `${Math.round(call.convictionScore * 100)}%`,
            style: new TextStyle({
              fontFamily: MONO_FONT,
              fontSize: 9,
              fontWeight: '700',
              fill: color,
            }),
          });
          convLabel.x = calls.length * 14 + 6;
          convLabel.y = -6;
          st.scannerDotsContainer.addChild(convLabel);
        }
      });
    });
  }

  /**
   * Draw faint horizontal guide lines connecting station rows for spatial orientation.
   * Call once after buildStations and on resize.
   */
  drawGridLines(bgLayer: PixiContainer) {
    const { Graphics } = this.pixi;
    // Remove previous grid lines if any (tagged child)
    const existing = (bgLayer as unknown as { _gridLines?: PixiGraphics })._gridLines;
    if (existing) { bgLayer.removeChild(existing); existing.destroy(); }

    if (this.stations.length === 0) return;

    const g = new Graphics();
    (bgLayer as unknown as { _gridLines: PixiGraphics })._gridLines = g;

    // Group stations into rows by approximate Y position (within 15% of screen height)
    const rows: { y: number; minX: number; maxX: number }[] = [];
    const threshold = this.H() * 0.15;

    this.stations.forEach((st) => {
      const sy = st.container.y;
      const sx = st.container.x;
      const row = rows.find((r) => Math.abs(r.y - sy) < threshold);
      if (row) {
        row.y = (row.y + sy) / 2; // average Y
        row.minX = Math.min(row.minX, sx);
        row.maxX = Math.max(row.maxX, sx);
      } else {
        rows.push({ y: sy, minX: sx, maxX: sx });
      }
    });

    // Draw horizontal lines spanning each row
    g.setStrokeStyle({ width: 0.5, color: 0xe8b45e, alpha: 0.06 });
    rows.forEach((row) => {
      const pad = 40;
      g.moveTo(row.minX - pad, row.y);
      g.lineTo(row.maxX + pad, row.y);
    });
    g.stroke();

    bgLayer.addChild(g);
  }

  handleResize() {
    this.stations.forEach((st) => {
      st.container.x = st.rx * this.W();
      st.container.y = st.ry * this.H();
    });
  }
}
