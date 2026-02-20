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

  spawnPopup(x: number, y: number, txt: string, color: number) {
    const { Container, Graphics, Text, TextStyle } = this.pixi;
    const container = new Container();

    const textObj = new Text({
      text: txt,
      style: new TextStyle({
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        fontWeight: '700',
        fill: color,
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
    this.popupLayer.addChild(container);
    this.popups.push({ container, elapsed: 0, duration: 2800, startY: y - 60 });
  }

  spawnLiveTxPopup(x: number, y: number, txt: string, action: 'BUY' | 'SELL') {
    const { Container, Graphics, Text, TextStyle } = this.pixi;
    const borderColor = action === 'BUY' ? 0x00ff41 : 0xff0033;
    const container = new Container();

    const textObj = new Text({
      text: txt,
      style: new TextStyle({
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        fontWeight: '800',
        fill: borderColor,
      }),
    });
    textObj.anchor.set(0.5, 0.5);

    const tw = textObj.width + 24;
    const th = textObj.height + 14;
    const bg = new Graphics();
    bg.roundRect(-tw / 2 - 3, -th / 2 - 3, tw + 6, th + 6, 6);
    bg.fill({ color: borderColor, alpha: 0.12 });
    bg.roundRect(-tw / 2, -th / 2, tw, th, 4);
    bg.fill({ color: 0x050505, alpha: 0.97 });
    bg.setStrokeStyle({ width: 2, color: borderColor, alpha: 1.0 });
    bg.roundRect(-tw / 2, -th / 2, tw, th, 4);
    bg.stroke();

    const badge = new Text({
      text: action,
      style: new TextStyle({
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9,
        fontWeight: '900',
        fill: 0x000000,
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
    this.liveTxLayer.addChild(container);
    this.popups.push({ container, elapsed: 0, duration: 5000, startY: y - 80 });
  }

  update(dt: number) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.elapsed += dt;
      const progress = p.elapsed / p.duration;
      p.container.alpha = progress < 0.75 ? 1 : 1 - (progress - 0.75) / 0.25;
      p.container.y = p.startY - progress * 30;
      if (p.elapsed >= p.duration) {
        p.container.parent?.removeChild(p.container);
        this.popups.splice(i, 1);
      }
    }
  }
}
