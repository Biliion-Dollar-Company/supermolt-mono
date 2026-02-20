import type {
  Container as PixiContainer,
  Graphics as PixiGraphics,
} from 'pixi.js';
import type { AgentState, TokenStation } from '../types';

interface PixiModules {
  Container: new () => PixiContainer;
  Graphics: new () => PixiGraphics;
}

export class BloomLayer {
  private pixi: PixiModules;
  private container: PixiContainer;
  private stationGlows: PixiGraphics[] = [];
  private agentGlows: PixiGraphics[] = [];

  constructor(pixi: PixiModules, parent: PixiContainer) {
    this.pixi = pixi;
    const { Container } = pixi;
    this.container = new Container();
    this.container.alpha = 0.4;
    // PixiJS 8: blendMode on Container
    (this.container as unknown as { blendMode: string }).blendMode = 'add';
    parent.addChild(this.container);
  }

  getContainer(): PixiContainer {
    return this.container;
  }

  buildStationGlows(stations: TokenStation[]) {
    const { Graphics } = this.pixi;
    // Remove old glows
    this.stationGlows.forEach((g) => {
      g.parent?.removeChild(g);
    });
    this.stationGlows = [];

    stations.forEach((st) => {
      const g = new Graphics();
      const BW = 76;
      const BH = 50;
      g.roundRect(-BW, -BH, BW * 2, BH * 2, 10);
      g.fill({ color: st.isNew ? 0xffcc00 : 0xe8b45e, alpha: 0.15 });
      g.x = st.container.x;
      g.y = st.container.y;
      this.container.addChild(g);
      this.stationGlows.push(g);
    });
  }

  update(now: number, agents: AgentState[], stations: TokenStation[]) {
    const { Graphics } = this.pixi;

    // Sync station glow positions and pulse
    this.stationGlows.forEach((g, i) => {
      const st = stations[i];
      if (!st) return;
      g.x = st.container.x;
      g.y = st.container.y;
      g.alpha = 0.12 + 0.06 * Math.sin(now / 600 + i);
    });

    // Agent ring glows for high-trust agents
    // Remove old, rebuild (cheap — only a few agents)
    this.agentGlows.forEach((g) => {
      g.parent?.removeChild(g);
    });
    this.agentGlows = [];

    agents.forEach((ag) => {
      if (ag.trustScore <= 0.9) return;
      const g = new Graphics();
      g.circle(0, 0, 24);
      g.fill({ color: 0xe8b45e, alpha: 0.2 + 0.08 * Math.sin(now / 500) });
      g.x = ag.container.x;
      g.y = ag.container.y;
      this.container.addChild(g);
      this.agentGlows.push(g);
    });
  }
}
