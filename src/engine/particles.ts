// Particle systems for atmosphere: drifting motes carried by a curl-noise current, and
// streams of light that flow along a path.

import { Particle, ParticleContainer, type Texture } from 'pixi.js';
import { noise } from './noise';
import { textures } from './textures';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DriftOptions {
  count: number;
  colors: number[];
  scale: [number, number];
  alpha: [number, number];
  /** World units per second the current moves particles. */
  speed: number;
  /** Size of the eddies in world units. */
  eddy: number;
  texture?: Texture;
}

interface Mote {
  p: Particle;
  x: number;
  y: number;
  alpha: number;
  phase: number;
  depth: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class DriftField {
  readonly root: ParticleContainer;
  private motes: Mote[] = [];
  /** Extra force, e.g. a storm or a pull towards a node. */
  push: ((x: number, y: number, t: number) => { x: number; y: number }) | null = null;
  speed: number;
  eddy: number;
  turbulence = 1;
  visible = 1;
  private time = 0;

  constructor(opts: DriftOptions) {
    const tex = opts.texture ?? textures().dot;
    this.speed = opts.speed;
    this.eddy = opts.eddy;
    this.root = new ParticleContainer({ texture: tex, dynamicProperties: { position: true, vertex: false, color: true } });
    this.root.blendMode = 'add';
    for (let i = 0; i < opts.count; i++) {
      const p = new Particle({
        texture: tex,
        anchorX: 0.5,
        anchorY: 0.5,
        tint: opts.colors[i % opts.colors.length],
        scaleX: 1,
        scaleY: 1,
      });
      const s = rnd(opts.scale[0], opts.scale[1]);
      p.scaleX = p.scaleY = s;
      this.root.addParticle(p);
      this.motes.push({ p, x: 0, y: 0, alpha: rnd(opts.alpha[0], opts.alpha[1]), phase: Math.random() * 7, depth: rnd(0.6, 1.2) });
    }
  }

  /** Scatters every mote over the area, e.g. on the first frame. */
  scatter(area: Rect) {
    for (const m of this.motes) {
      m.x = area.x + Math.random() * area.w;
      m.y = area.y + Math.random() * area.h;
    }
  }

  setColors(colors: number[]) {
    this.motes.forEach((m, i) => (m.p.tint = colors[i % colors.length]));
  }

  /** Keeps motes inside the area by wrapping them to the opposite edge. */
  update(dt: number, area: Rect) {
    this.time += dt;
    const t = this.time * 0.04;
    const shown = Math.round(this.motes.length * Math.max(0, Math.min(1, this.visible)));
    this.motes.forEach((m, i) => {
      if (i >= shown) {
        m.p.alpha = 0;
        return;
      }
      const c = noise.curl(m.x, m.y, this.eddy, t);
      let vx = c.x * this.speed * this.turbulence * m.depth;
      let vy = c.y * this.speed * this.turbulence * m.depth;
      if (this.push) {
        const f = this.push(m.x, m.y, this.time);
        vx += f.x;
        vy += f.y;
      }
      m.x += vx * dt;
      m.y += vy * dt;
      if (m.x < area.x) m.x += area.w;
      else if (m.x > area.x + area.w) m.x -= area.w;
      if (m.y < area.y) m.y += area.h;
      else if (m.y > area.y + area.h) m.y -= area.h;
      m.p.x = m.x;
      m.p.y = m.y;
      m.p.alpha = m.alpha * (0.6 + 0.4 * Math.sin(this.time * 1.3 + m.phase));
    });
  }
}

/** Lights flowing along a polyline, like a current between places. */
export class Stream {
  readonly root: ParticleContainer;
  private bits: { p: Particle; t: number; off: number; speed: number }[] = [];
  private lengths: number[] = [];
  private total = 0;
  alpha = 1;

  constructor(
    private points: { x: number; y: number }[],
    count: number,
    color: number,
    private width = 10,
    speed = 60,
    scale = 0.5,
  ) {
    const tex = textures().dot;
    this.root = new ParticleContainer({ texture: tex, dynamicProperties: { position: true, color: true } });
    this.root.blendMode = 'add';
    this.measure();
    for (let i = 0; i < count; i++) {
      const p = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, tint: color, scaleX: scale, scaleY: scale });
      this.root.addParticle(p);
      this.bits.push({ p, t: Math.random() * this.total, off: (Math.random() - 0.5) * 2, speed: speed * rnd(0.6, 1.3) });
    }
  }

  private measure() {
    this.lengths = [0];
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      this.lengths.push(this.lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.total = this.lengths[this.lengths.length - 1] || 1;
  }

  /** Point and direction at distance d along the path. */
  at(d: number) {
    const pts = this.points;
    let i = 1;
    while (i < pts.length - 1 && this.lengths[i] < d) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const seg = this.lengths[i] - this.lengths[i - 1] || 1;
    const k = Math.max(0, Math.min(1, (d - this.lengths[i - 1]) / seg));
    const dx = (b.x - a.x) / seg;
    const dy = (b.y - a.y) / seg;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx, dy };
  }

  get length() {
    return this.total;
  }

  update(dt: number, time: number) {
    for (const b of this.bits) {
      b.t = (b.t + b.speed * dt) % this.total;
      const q = this.at(b.t);
      const side = b.off * this.width * (0.7 + 0.3 * Math.sin(time * 1.5 + b.off * 9));
      b.p.x = q.x - q.dy * side;
      b.p.y = q.y + q.dx * side;
      const edge = Math.min(1, b.t / 40, (this.total - b.t) / 40);
      b.p.alpha = this.alpha * edge * (0.45 + 0.35 * Math.sin(time * 2 + b.off * 13));
    }
  }
}
