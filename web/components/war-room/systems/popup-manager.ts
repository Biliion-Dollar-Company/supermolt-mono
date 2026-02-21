import type {
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Text as PixiText,
} from 'pixi.js';
import type { Popup } from '../types';

interface PixiModules {
  Container: new () => PixiContainer;
  Graphics: new () => PixiGraphics;
  Text: new (opts: { text: string; style: unknown }) => PixiText;
  TextStyle: new (opts: Record<string, unknown>) => unknown;
}

const ACTION_ICONS: Record<string, string> = {
  BUY: '\u25B2',       // ▲
  SELL: '\u25BC',       // ▼
  ANALYZING: '\u25C6',  // ◆
  BOUGHT: '\u25B2',
  SOLD: '\u25BC',
};

const BRAND = 0xe8b45e;

export class PopupManager {
  private pixi: PixiModules;
  private popupLayer: PixiContainer;
  private liveTxLayer: PixiContainer;
  private popups: Popup[] = [];

  constructor(
    pixi: PixiModules,
    popupLayer: PixiContainer,
    liveTxLayer: PixiContainer,
  ) {
    this.pixi = pixi;
    this.popupLayer = popupLayer;
    this.liveTxLayer = liveTxLayer;
  }

  /** Agent activity popup — tiny, positioned well above station. */
  spawnPopup(
    stationX: number,
    stationY: number,
    txt: string,
    _color: number,
    action?: string,
  ) {
    const { Container, Graphics, Text, TextStyle } = this.pixi;
    const c = new Container();

    const icon = action ? (ACTION_ICONS[action] ?? '\u25C6') : '\u25C6';
    const short = txt.length > 20 ? txt.slice(0, 19) + '..' : txt;

    const iconT = new Text({
      text: icon,
      style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 5, fontWeight: '900', fill: BRAND }),
    });
    iconT.anchor.set(0.5, 0.5);

    const label = new Text({
      text: short,
      style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 5, fontWeight: '700', fill: 0x999999 }),
    });
    label.anchor.set(0, 0.5);

    const iconW = 8;
    const pad = 4;
    const w = iconW + label.width + pad * 2 + 2;
    const h = 11;

    iconT.x = -w / 2 + pad + 3;
    label.x = -w / 2 + pad + iconW + 1;

    const bg = new Graphics();
    bg.rect(-w / 2, -h / 2, w, h);
    bg.fill({ color: 0x0a0a0a, alpha: 0.88 });
    bg.setStrokeStyle({ width: 0.5, color: BRAND, alpha: 0.3 });
    bg.rect(-w / 2, -h / 2, w, h);
    bg.stroke();

    c.addChild(bg, iconT, label);

    // Well above the station — offset right so it clears the card
    const startY = stationY - 46;
    c.x = stationX + 34;
    c.y = startY;

    this.popupLayer.addChild(c);
    this.popups.push({ container: c, elapsed: 0, duration: 2200, startY });
  }

  /** Live TX popup — slightly bigger but still compact. */
  spawnLiveTxPopup(
    stationX: number,
    stationY: number,
    txt: string,
    action: 'BUY' | 'SELL',
  ) {
    const { Container, Graphics, Text, TextStyle } = this.pixi;
    const c = new Container();

    const icon = ACTION_ICONS[action] ?? '\u25C6';
    const short = txt.length > 26 ? txt.slice(0, 25) + '..' : txt;

    const iconT = new Text({
      text: icon,
      style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 6, fontWeight: '900', fill: BRAND }),
    });
    iconT.anchor.set(0.5, 0.5);

    const label = new Text({
      text: short,
      style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 5.5, fontWeight: '800', fill: 0xcccccc }),
    });
    label.anchor.set(0, 0.5);

    const iconW = 10;
    const pad = 5;
    const w = iconW + label.width + pad * 2 + 2;
    const h = 13;

    iconT.x = -w / 2 + pad + 4;
    label.x = -w / 2 + pad + iconW + 1;

    const bg = new Graphics();
    bg.rect(-w / 2, -h / 2, w, h);
    bg.fill({ color: 0x080808, alpha: 0.94 });
    bg.setStrokeStyle({ width: 0.6, color: BRAND, alpha: 0.5 });
    bg.rect(-w / 2, -h / 2, w, h);
    bg.stroke();

    // Action label — plain white text, no box
    const badgeT = new Text({
      text: action,
      style: new TextStyle({ fontFamily: 'JetBrains Mono, monospace', fontSize: 4, fontWeight: '800', fill: 0xffffff }),
    });
    badgeT.anchor.set(0.5, 0.5);
    badgeT.x = w / 2 + 10;
    badgeT.y = 0;

    c.addChild(bg, iconT, label, badgeT);

    // Above-left of station, well clear of the card
    const startY = stationY - 48;
    c.x = stationX - 20;
    c.y = startY;

    this.liveTxLayer.addChild(c);
    this.popups.push({ container: c, elapsed: 0, duration: 3500, startY });
  }

  update(dt: number) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.elapsed += dt;
      const progress = p.elapsed / p.duration;
      p.container.alpha = progress < 0.65 ? 1 : 1 - (progress - 0.65) / 0.35;
      p.container.y = p.startY - progress * 14;
      if (p.elapsed >= p.duration) {
        p.container.parent?.removeChild(p.container);
        this.popups.splice(i, 1);
      }
    }
  }
}
