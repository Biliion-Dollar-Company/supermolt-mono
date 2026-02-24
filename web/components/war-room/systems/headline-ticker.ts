import type {
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Text as PixiText,
} from 'pixi.js';
import type { AgentState, TokenStation, Conversation } from '../types';
import { generateHeadlines } from '../helpers';

interface PixiModules {
  Container: new () => PixiContainer;
  Graphics: new () => PixiGraphics;
  Text: new (opts: { text: string; style: unknown }) => PixiText;
  TextStyle: new (opts: Record<string, unknown>) => unknown;
}

const SCROLL_SPEED = 0.08; // px per ms

export class HeadlineTicker {
  private pixi: PixiModules;
  private layer: PixiContainer;
  private tickerBg: PixiGraphics;
  private tickerAccent: PixiGraphics;
  private headlineText: PixiText;
  private currentHeadlineIdx = 0;
  private headlines: string[] = [];
  private W: () => number;
  private needsBgRedraw = true;
  private lastWidth = 0;
  private isPriorityOverride = false;

  constructor(pixi: PixiModules, parent: PixiContainer, W: () => number) {
    this.pixi = pixi;
    this.W = W;
    const { Container, Graphics, Text, TextStyle } = pixi;

    this.layer = new Container();
    parent.addChild(this.layer);

    this.tickerBg = new Graphics();
    this.layer.addChild(this.tickerBg);

    this.tickerAccent = new Graphics();
    this.tickerAccent.rect(0, 0, 3, 28);
    this.tickerAccent.fill({ color: 0xe8b45e, alpha: 0.8 });
    this.layer.addChild(this.tickerAccent);

    this.headlineText = new Text({
      text: 'INITIALIZING WAR ROOM...',
      style: new TextStyle({
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        fontWeight: '700',
        fill: 0xffaa00,
        letterSpacing: 1.5,
      }),
    });
    this.headlineText.y = 9;
    this.headlineText.x = this.W(); // start off-screen right
    this.layer.addChild(this.headlineText);

    this.drawBg();
  }

  private drawBg() {
    const w = this.W();
    this.tickerBg.clear();
    this.tickerBg.rect(0, 0, w, 28);
    this.tickerBg.fill({ color: 0x050505, alpha: 0.92 });
    this.tickerBg.setStrokeStyle({ width: 1, color: 0xe8b45e, alpha: 0.15 });
    this.tickerBg.rect(0, 0, w, 28);
    this.tickerBg.stroke();
    this.lastWidth = w;
    this.needsBgRedraw = false;
  }

  refreshHeadlines(agents: AgentState[], stations: TokenStation[], conversations: Conversation[]) {
    this.headlines = generateHeadlines(agents, stations, conversations);
  }

  overridePriority(text: string, color: number) {
    this.headlineText.text = text;
    (this.headlineText.style as { fill: number }).fill = color;
    this.headlineText.x = this.W(); // reset to right edge for scroll-in
    this.isPriorityOverride = true;
  }

  update(dt: number) {
    // Only redraw bg on resize
    const w = this.W();
    if (w !== this.lastWidth) {
      this.drawBg();
    }

    // Scroll left
    this.headlineText.x -= SCROLL_SPEED * dt;

    // When text fully exits left, advance to next headline
    const textWidth = this.headlineText.width;
    if (this.headlineText.x < -textWidth) {
      this.advanceHeadline();
    }

    // Color based on content (skip if priority override is active)
    if (!this.isPriorityOverride) {
      const hl = this.headlineText.text;
      if (hl.includes('ALPHA') || hl.includes('COORDINATED')) {
        (this.headlineText.style as { fill: number }).fill = 0xe8b45e;
      } else if (hl.includes('NEW GRADUATION')) {
        (this.headlineText.style as { fill: number }).fill = 0x00ff41;
      } else {
        (this.headlineText.style as { fill: number }).fill = 0xffaa00;
      }
    }
  }

  private advanceHeadline() {
    if (this.headlines.length === 0) return;
    this.currentHeadlineIdx = (this.currentHeadlineIdx + 1) % this.headlines.length;
    this.headlineText.text = this.headlines[this.currentHeadlineIdx];
    this.headlineText.x = this.W(); // start from right edge
    // Reset color override so normal headlines get normal colors
    this.isPriorityOverride = false;
  }
}
