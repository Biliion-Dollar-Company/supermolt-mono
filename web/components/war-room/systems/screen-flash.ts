import type {
  Container as PixiContainer,
  Graphics as PixiGraphics,
} from 'pixi.js';

interface PixiModules {
  Graphics: new () => PixiGraphics;
}

const FLASH_DURATION = 300;

export class ScreenFlash {
  private pixi: PixiModules;
  private overlay: PixiGraphics;
  private flashTimer = 0;
  private flashColor = 0xe8b45e;
  private W: () => number;
  private H: () => number;

  constructor(pixi: PixiModules, parent: PixiContainer, W: () => number, H: () => number) {
    this.pixi = pixi;
    this.W = W;
    this.H = H;
    const { Graphics } = pixi;
    this.overlay = new Graphics();
    (this.overlay as unknown as { blendMode: string }).blendMode = 'add';
    this.overlay.visible = false;
    parent.addChild(this.overlay);
  }

  flash(action: 'BUY' | 'SELL') {
    this.flashColor = action === 'BUY' ? 0xe8b45e : 0xff0033;
    this.flashTimer = FLASH_DURATION;
    this.overlay.visible = true;
  }

  update(dt: number) {
    if (this.flashTimer <= 0) return;

    this.flashTimer -= dt;
    if (this.flashTimer <= 0) {
      this.overlay.visible = false;
      return;
    }

    const alpha = 0.3 * (this.flashTimer / FLASH_DURATION);
    this.overlay.clear();
    this.overlay.rect(0, 0, this.W(), this.H());
    this.overlay.fill({ color: this.flashColor, alpha });
  }
}
