import type { Container as PixiContainer, Graphics as PixiGraphics } from 'pixi.js';

interface Particle {
  graphics: PixiGraphics;
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  startAlpha: number;
  startScale: number;
}

const POOL_SIZE = 300;

export class ParticlePool {
  private particles: Particle[] = [];
  private container: PixiContainer;

  constructor(
    parentContainer: PixiContainer,
    containerInstance: PixiContainer,
    GraphicsClass: new () => PixiGraphics,
  ) {
    this.container = containerInstance;
    parentContainer.addChild(this.container);

    for (let i = 0; i < POOL_SIZE; i++) {
      const g = new GraphicsClass();
      g.circle(0, 0, 1);
      g.fill({ color: 0xffffff });
      g.visible = false;
      this.container.addChild(g);
      this.particles.push({
        graphics: g,
        active: false,
        life: 0,
        maxLife: 0,
        vx: 0,
        vy: 0,
        startAlpha: 0,
        startScale: 1,
      });
    }
  }

  getContainer(): PixiContainer {
    return this.container;
  }

  emit(
    x: number,
    y: number,
    color: number,
    opts: { count?: number; size?: number; life?: number; alpha?: number },
  ) {
    const count = opts.count ?? 1;
    const size = opts.size ?? 2;
    const life = opts.life ?? 800;
    const alpha = opts.alpha ?? 0.3;

    for (let i = 0; i < count; i++) {
      const p = this.particles.find((pp) => !pp.active);
      if (!p) return;

      p.active = true;
      p.life = life;
      p.maxLife = life;
      p.vx = (Math.random() - 0.5) * 0.04;
      p.vy = (Math.random() - 0.5) * 0.04;
      p.startAlpha = alpha;
      p.startScale = size;

      p.graphics.clear();
      p.graphics.circle(0, 0, size);
      p.graphics.fill({ color, alpha: 1 });
      p.graphics.x = x;
      p.graphics.y = y;
      p.graphics.alpha = alpha;
      p.graphics.scale.set(1);
      p.graphics.visible = true;
    }
  }

  update(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.graphics.visible = false;
        continue;
      }

      const t = p.life / p.maxLife;
      p.graphics.x += p.vx * dt;
      p.graphics.y += p.vy * dt;
      p.graphics.alpha = p.startAlpha * t;
      p.graphics.scale.set(t * 0.8 + 0.2);
    }
  }
}
