// A resonance: a wave of light rings out from the organism. Where it passes hidden links,
// they glimmer up; lights already in the world answer with a flare.

import { Container, Graphics, Sprite } from 'pixi.js';
import { textures } from '../engine/textures';

const GOLD = 0xffd98a;
const DURATION = 1.8;
const AFTERGLOW = 3.5;

export interface ResonanceMark {
  x: number;
  y: number;
  /** A hidden link (glimmers) or a light already there (only answers). */
  glimmer: boolean;
}

export class ResonanceView {
  readonly world = new Container();
  private ring = new Graphics();
  private marks: { m: ResonanceMark; d: number; reached: boolean; s: Sprite | null; age: number }[];
  private age = 0;
  private done = false;

  constructor(
    private readonly cx: number,
    private readonly cy: number,
    private readonly radius: number,
    marks: ResonanceMark[],
    private readonly onReach: (index: number) => void,
    private readonly onDone: () => void,
  ) {
    this.ring.blendMode = 'add';
    this.world.addChild(this.ring);
    const t = textures();
    this.marks = marks.map((m) => {
      let s: Sprite | null = null;
      if (m.glimmer) {
        s = new Sprite(t.glow);
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.tint = GOLD;
        s.alpha = 0;
        s.position.set(m.x, m.y);
        this.world.addChild(s);
      }
      return { m, d: Math.hypot(m.x - cx, m.y - cy), reached: false, s, age: 0 };
    });
  }

  /** Returns false once everything has faded. */
  update(dt: number, zoom: number): boolean {
    this.age += dt;
    const k = Math.min(1, this.age / DURATION);
    const r = this.radius * (1 - Math.pow(1 - k, 2.2));
    const g = this.ring;
    g.clear();
    if (k < 1) {
      const fade = 1 - k;
      g.circle(this.cx, this.cy, r).stroke({ width: 3 / zoom, color: GOLD, alpha: 0.45 * fade });
      g.circle(this.cx, this.cy, r * 0.96).stroke({ width: 10 / zoom, color: 0x7fe9ff, alpha: 0.12 * fade });
      g.circle(this.cx, this.cy, r * 0.9).stroke({ width: 22 / zoom, color: 0x7fe9ff, alpha: 0.05 * fade });
    }
    this.marks.forEach((mark, i) => {
      if (!mark.reached && r >= mark.d) {
        mark.reached = true;
        this.onReach(i);
      }
      if (!mark.s || !mark.reached) return;
      mark.age += dt;
      const flash = Math.max(0, 1 - mark.age / (DURATION + AFTERGLOW - mark.d / this.radius * DURATION));
      mark.s.alpha = Math.min(1, mark.age * 4) * flash * (0.7 + 0.3 * Math.sin(mark.age * 9));
      mark.s.scale.set((0.35 + 0.5 * flash) / Math.max(0.5, zoom));
    });
    if (k >= 1 && !this.done) {
      this.done = true;
      this.onDone();
    }
    return this.age < DURATION + AFTERGLOW;
  }

  destroy() {
    this.world.destroy({ children: true });
  }
}
