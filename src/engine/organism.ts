// The light organism: a soft head, a trailing body of linked lights, small cilia that stream
// back with the motion, and a fading trail. It glides with inertia and turns slowly, like
// something floating in water rather than a cursor.
//
// It grows from what it eats: the words of the verses it has read (see growth.ts). Its body
// lengthens and grows, and in stages it unfolds fins, a trailing veil of light threads, a crown
// of light, waves of light along its body and at last two wide, translucent wings. Each word it
// eats sends a pulse of light down its body. What the player has discovered stays with it as
// well: small lights along the body in the colours of the passages, and a ring of light around
// the head for every encounter.

import { Container, Particle, ParticleContainer, Sprite, type Texture } from 'pixi.js';
import { growth, type Growth } from './growth';
import type { Steer } from './input';
import { textures } from './textures';

const MAX_LIGHTS = 24;
const TRAIL = 90;
const GOLD = 0xffd98a;
const ROSE = 0xff9fc2;
const VIOLET = 0xb48cff;
const FILAMENTS = 4;
const FILAMENT_DOTS = 9;
const PETALS = 6;
/** How many past tail positions the filaments follow. */
const HISTORY = 48;

/** Something the player discovered, as the organism carries it. */
export interface Memory {
  /** Stable per discovery, so a light keeps its place. */
  key: string;
  kind: 'nt' | 'ot' | 'encounter';
  /** The colour of the passage's group of books, or of the encounter. */
  color: number;
}

interface Segment {
  s: Sprite;
  x: number;
  y: number;
  scale: number;
  alpha: number;
}

interface Light {
  key: string;
  s: Sprite;
  kind: Memory['kind'];
  color: number;
  /** Where along the body it rests (0 head … 1 tail), so it keeps its place as the body grows. */
  at: number;
  phase: number;
  /** Seconds since it joined; new lights travel from the head to their place. */
  age: number;
}

interface Wreath {
  key: string;
  s: Sprite;
  color: number;
  tilt: number;
  age: number;
}

interface TrailBit {
  p: Particle;
  life: number;
  vx: number;
  vy: number;
}

export class Organism {
  readonly root = new Container();
  readonly trailLayer: ParticleContainer;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  heading = 0;
  maxSpeed = 250;
  /** 0–1: dims and shrinks the organism (used in encounters). */
  vitality = 1;
  color = 0x7fe9ff;
  accent = 0xffffff;
  trailOn = true;
  /** Words eaten so far. */
  nourished = 0;
  private time = 0;
  private target: Growth = growth(0);
  /** The forms as they are drawn now; they ease towards the target, so new forms unfold. */
  private shown: Growth = growth(0);
  private layers = {
    wings: new Container(),
    body: new Container(),
    spots: new Container(),
    fins: new Container(),
    memory: new Container(),
    tail: new Container(),
    cilia: new Container(),
    crown: new Container(),
  };
  private aura: Sprite;
  private head: Sprite;
  private heart: Sprite;
  private body: Segment[] = [];
  private spots: Sprite[] = [];
  private fins: { s: Sprite; seg: number; side: 1 | -1 }[] = [];
  private filaments: { dots: Sprite[]; phase: number }[] = [];
  private petals: Sprite[] = [];
  private wings: Sprite[] = [];
  private cilia: { s: Sprite; phase: number; r: number }[] = [];
  private lights: Light[] = [];
  private wreaths: Wreath[] = [];
  private history: { x: number; y: number }[] = [];
  /** Pulses of light running down the body, one per word eaten. */
  private gulps: { t: number; color: number }[] = [];
  /** A brief flowering when a new stage is reached. */
  private bloom = 0;
  private trail: TrailBit[] = [];
  private emitClock = 0;

  constructor() {
    const t = textures();
    this.aura = this.sprite(t.glow, 1.5, 0.22, this.root);
    const L = this.layers;
    this.root.addChild(L.wings, L.body, L.spots, L.fins, L.memory, L.tail, L.cilia, L.crown);
    this.head = this.sprite(t.glow, 0.62, 0.9, this.root);
    this.heart = this.sprite(t.core, 0.28, 1, this.root);
    for (let f = 0; f < FILAMENTS; f++) {
      this.filaments.push({ dots: Array.from({ length: FILAMENT_DOTS }, () => this.sprite(t.glow, 0.1, 0, L.tail)), phase: f * 1.7 });
    }
    for (let i = 0; i < PETALS; i++) this.petals.push(this.sprite(t.leaf, 0.1, 0, L.crown));
    for (let i = 0; i < 2; i++) this.wings.push(this.sprite(t.leaf, 0.1, 0, L.wings));
    for (const s of [...this.petals, ...this.wings]) s.anchor.set(0.02, 0.5);
    this.trailLayer = new ParticleContainer({
      texture: t.glow,
      dynamicProperties: { position: true, vertex: true, color: true },
    });
    this.trailLayer.blendMode = 'add';
    for (let i = 0; i < TRAIL; i++) {
      const p = new Particle({ texture: t.glow, anchorX: 0.5, anchorY: 0.5, alpha: 0, scaleX: 0.1, scaleY: 0.1 });
      this.trailLayer.addParticle(p);
      this.trail.push({ p, life: 0, vx: 0, vy: 0 });
    }
    this.setGrowth(0, false);
  }

  private sprite(tex: Texture, scale: number, alpha: number, parent: Container) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(scale);
    s.alpha = alpha;
    s.blendMode = 'add';
    parent.addChild(s);
    return s;
  }

  /**
   * Grows the organism to what `words` eaten words make of it. Returns true when a new stage was
   * reached (it flowers briefly, unless `animate` is false, e.g. when a saved world is loaded).
   */
  setGrowth(words: number, animate = true): boolean {
    const t = textures();
    const before = this.target.stage;
    this.nourished = words;
    this.target = growth(words);
    const g = this.target;
    if (!animate) this.shown = { ...g };

    while (this.body.length < g.segments) {
      const tail = this.body[this.body.length - 1];
      this.body.push({ s: this.sprite(t.glow, 0.3, 0, this.layers.body), x: tail?.x ?? this.x, y: tail?.y ?? this.y, scale: 0, alpha: 0 });
    }
    while (this.body.length > g.segments) this.body.pop()!.s.destroy();
    const n = this.body.length;
    this.body.forEach((b, i) => {
      const k = i / (n - 1);
      b.scale = 0.42 * (1 - 0.57 * k);
      b.alpha = 0.5 * (1 - 0.65 * k);
    });
    // two spots of light beside every segment, for the waves of light
    while (this.spots.length < n * 2) this.spots.push(this.sprite(t.dot, 0.3, 0, this.layers.spots));
    while (this.spots.length > n * 2) this.spots.pop()!.destroy();
    // a pair of fins on every third segment, away from head and tail
    const finSegs: number[] = [];
    for (let i = 2; i < n - 2; i += 3) finSegs.push(i);
    while (this.fins.length > finSegs.length * 2) this.fins.pop()!.s.destroy();
    while (this.fins.length < finSegs.length * 2) {
      const s = this.sprite(t.leaf, 0.1, 0, this.layers.fins);
      s.anchor.set(0.02, 0.5);
      this.fins.push({ s, seg: 0, side: this.fins.length % 2 === 0 ? 1 : -1 });
    }
    this.fins.forEach((f, i) => (f.seg = finSegs[Math.floor(i / 2)]));
    while (this.cilia.length < g.cilia) {
      const i = this.cilia.length;
      this.cilia.push({ s: this.sprite(t.dot, 0.35, 0, this.layers.cilia), phase: i * 2.39996, r: 11 + (i % 3) * 3 });
    }
    while (this.cilia.length > g.cilia) this.cilia.pop()!.s.destroy();

    const grew = g.stage > before;
    if (grew && animate) this.bloom = 1;
    return grew;
  }

  /** One word eaten: a pulse of light runs down the body in its colour. */
  feed(color: number) {
    this.gulps.push({ t: 0, color });
    if (this.gulps.length > 8) this.gulps.shift();
  }

  /** How many stages of growth have been reached. */
  get stage() {
    return this.target.stage;
  }

  get segments() {
    return this.body.length;
  }

  /** How large the organism is drawn (1 at the start). */
  get size() {
    return this.shown.scale;
  }

  /**
   * Shows what has been discovered. New memories join with a small arrival (unless `animate`
   * is false, e.g. when a saved world is loaded); memories that are gone fade away.
   */
  setMemories(memories: Memory[], animate = true) {
    const t = textures();
    const shown = memories.filter((m) => m.kind !== 'encounter').slice(-MAX_LIGHTS);
    const keep = new Set(shown.map((m) => m.key));
    this.lights = this.lights.filter((l) => {
      if (keep.has(l.key)) return true;
      l.s.destroy();
      return false;
    });
    shown.forEach((m, i) => {
      if (this.lights.some((l) => l.key === m.key)) return;
      const s = this.sprite(t.glow, 0.1, 0, this.layers.memory);
      // spread along the body by the golden ratio, so neighbours rarely meet
      this.lights.push({ key: m.key, s, kind: m.kind, color: m.color, at: 0.1 + ((i * 0.618) % 1) * 0.85, phase: i * 2.39996, age: animate ? 0 : 99 });
    });
    for (const m of memories.filter((x) => x.kind === 'encounter')) {
      if (this.wreaths.some((w) => w.key === m.key)) continue;
      const s = this.sprite(t.ring, 0.1, 0, this.layers.memory);
      this.wreaths.push({ key: m.key, s, color: m.color, tilt: this.wreaths.length * 1.05 + 0.4, age: animate ? 0 : 99 });
    }
  }

  /** How many passages and encounters the organism carries. */
  get carried() {
    return this.lights.length + this.wreaths.length;
  }

  place(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
    for (const b of this.body) {
      b.x = x;
      b.y = y;
    }
    this.history = [];
    for (const t of this.trail) {
      t.life = 0;
      t.p.alpha = 0;
    }
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  /** Moves with the steering input plus an optional external current (world units per second). */
  update(dt: number, steer: Steer, current = { x: 0, y: 0 }) {
    this.time += dt;
    const max = this.maxSpeed * (steer.boost ? 1.6 : 1);
    const want = { x: steer.x * max * steer.thrust, y: steer.y * max * steer.thrust };
    // ease towards the wanted velocity; turning is slower than speeding up
    const k = 1 - Math.exp(-dt * (steer.thrust > 0 ? 1.9 : 0.6));
    this.vx += (want.x - this.vx) * k;
    this.vy += (want.y - this.vy) * k;
    this.x += (this.vx + current.x) * dt;
    this.y += (this.vy + current.y) * dt;
    // a gentle idle bob so the organism never looks frozen
    this.x += Math.sin(this.time * 0.9) * 3 * dt;
    this.y += Math.cos(this.time * 0.7) * 3 * dt;

    const sp = this.speed;
    if (sp > 4) {
      const target = Math.atan2(this.vy, this.vx);
      let d = target - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 4);
    }
    // new forms unfold over a few seconds
    const e = 1 - Math.exp(-dt * 0.9);
    for (const key of ['fins', 'tail', 'crown', 'pattern', 'veil', 'scale'] as const) this.shown[key] += (this.target[key] - this.shown[key]) * e;
    this.draw(dt, sp);
  }

  private draw(dt: number, sp: number) {
    const v = this.vitality;
    const g = this.shown;
    const S = g.scale * (0.6 + 0.4 * v);
    const pulse = 1 + Math.sin(this.time * 2.4) * 0.06;
    const stretch = Math.min(1, sp / this.maxSpeed);
    this.bloom = Math.max(0, this.bloom - dt * 0.35);
    for (const gulp of this.gulps) gulp.t += dt;
    this.gulps = this.gulps.filter((x) => x.t < 0.9);
    const swallow = this.gulps.length ? Math.max(0, 1 - this.gulps[this.gulps.length - 1].t / 0.25) : 0;

    this.head.position.set(this.x, this.y);
    this.head.scale.set(0.62 * pulse * S * (1 + 0.18 * swallow));
    this.head.tint = this.color;
    this.head.alpha = 0.55 + 0.4 * v;
    this.heart.position.set(this.x, this.y);
    this.heart.scale.set(0.26 * pulse * S * (1 + 0.3 * swallow));
    this.heart.tint = swallow > 0 ? mixColor(this.accent, this.gulps[this.gulps.length - 1].color, 0.6 * swallow) : this.accent;
    this.aura.position.set(this.x, this.y);
    this.aura.scale.set((1.3 + stretch * 0.4) * S * (1 + this.bloom * 0.8));
    this.aura.tint = this.bloom > 0 ? mixColor(this.color, GOLD, this.bloom) : this.color;
    this.aura.alpha = (0.12 + 0.12 * v) * (1 + this.bloom * 2.5);

    // body: each segment follows the one before it at a fixed spacing
    let px = this.x;
    let py = this.y;
    const spacing = 6.5 * S;
    const n = this.body.length;
    const side = { x: Math.cos(this.heading + Math.PI / 2), y: Math.sin(this.heading + Math.PI / 2) };
    this.body.forEach((b, i) => {
      const dx = b.x - px;
      const dy = b.y - py;
      const d = Math.hypot(dx, dy) || 1;
      const wave = Math.sin(this.time * 5 - i * 0.7) * 1.6 * stretch;
      b.x = px + (dx / d) * spacing + side.x * wave * dt * 10;
      b.y = py + (dy / d) * spacing + side.y * wave * dt * 10;
      // the light of eaten words runs from head to tail
      let glow = 0;
      let tint = i < 3 ? this.color : mixColor(this.color, this.accent, i / n);
      for (const gulp of this.gulps) {
        const at = (gulp.t / 0.9) * (n + 2) - 1;
        const k = Math.exp(-((i - at) ** 2) / 2);
        if (k > glow) {
          glow = k;
          tint = mixColor(tint, gulp.color, k * 0.7);
        }
      }
      const wave2 = g.pattern * Math.max(0, Math.sin(this.time * 2.6 - i * 0.55));
      b.s.position.set(b.x, b.y);
      b.s.scale.set(b.scale * S * (1 + 0.35 * glow + 0.15 * wave2));
      b.s.tint = tint;
      b.s.alpha = (b.alpha * (1 + 0.6 * wave2) + 0.35 * glow) * (0.35 + 0.65 * v);
      // waves of light: spots on both sides
      const sa = this.spots[i * 2];
      const sb = this.spots[i * 2 + 1];
      const off = b.scale * 24 * S;
      const nx = -dy / d;
      const ny = dx / d;
      for (const [s, sign] of [
        [sa, 1],
        [sb, -1],
      ] as const) {
        s.position.set(b.x + nx * off * sign, b.y + ny * off * sign);
        s.scale.set(0.24 * S * (0.6 + 0.4 * (1 - i / n)));
        s.tint = i % 2 ? GOLD : ROSE;
        s.alpha = (0.15 + wave2) * g.pattern * 0.8 * v;
      }
      px = b.x;
      py = b.y;
    });

    // fins: pairs along the body, beating with the motion
    for (const f of this.fins) {
      const b = this.body[f.seg];
      const front = this.body[Math.max(0, f.seg - 1)];
      const ang = Math.atan2(front.y - b.y, front.x - b.x);
      const flap = Math.sin(this.time * (4 + stretch * 4) + f.seg) * (0.25 + 0.35 * stretch);
      f.s.position.set(b.x, b.y);
      f.s.rotation = ang + f.side * (Math.PI / 2 + 0.55 + flap);
      const len = 0.17 * S * g.fins * (1 - (f.seg / n) * 0.45);
      f.s.scale.set(len, 0.13 * S * (0.4 + 0.6 * g.fins));
      f.s.tint = mixColor(this.color, 0x9ad0ff, 0.5);
      f.s.alpha = g.fins * 0.5 * v;
    }

    // a veil of light threads following the tail's path
    const tail = this.body[n - 1];
    if (sp > 6 || !this.history.length) this.history.unshift({ x: tail.x, y: tail.y });
    if (this.history.length > HISTORY) this.history.length = HISTORY;
    this.filaments.forEach((f, k) => {
      f.dots.forEach((s, j) => {
        const h = this.history[Math.min(this.history.length - 1, j * 5)];
        const spread = (k - (FILAMENTS - 1) / 2) * 3 * S * (j / FILAMENT_DOTS);
        const sway = Math.sin(this.time * 2.4 + j * 0.6 + f.phase) * 4 * S * (j / FILAMENT_DOTS);
        s.position.set(h.x + side.x * (spread + sway), h.y + side.y * (spread + sway));
        s.scale.set(0.12 * S * (1 - j / (FILAMENT_DOTS + 3)));
        s.tint = k % 2 ? ROSE : mixColor(this.color, this.accent, 0.4);
        s.alpha = g.tail * 0.55 * (1 - j / FILAMENT_DOTS) * v;
      });
    });

    // a crown of light around the head
    this.petals.forEach((s, i) => {
      const a = (i / PETALS) * Math.PI * 2 + this.time * 0.3;
      const r = 12 * S * (0.85 + 0.15 * Math.sin(this.time * 1.5 + i));
      s.position.set(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r * 0.85);
      s.rotation = a;
      s.scale.set(0.13 * S * g.crown, 0.07 * S * (0.4 + 0.6 * g.crown));
      s.tint = i % 2 ? GOLD : ROSE;
      s.alpha = g.crown * 0.6 * v;
    });

    // two wide wings of light near the front
    const front = this.body[Math.min(3, n - 1)];
    this.wings.forEach((s, i) => {
      const sign = i === 0 ? 1 : -1;
      const beat = Math.sin(this.time * 1.3) * 0.3;
      s.position.set(front.x, front.y);
      s.rotation = this.heading + Math.PI + sign * (Math.PI / 2 - 0.62 + beat);
      s.scale.set(0.5 * S * g.veil, 0.36 * S * (0.4 + 0.6 * g.veil));
      s.tint = mixColor(VIOLET, this.color, 0.3);
      s.alpha = g.veil * 0.42 * v;
    });

    // the discovered passages, resting along the body
    for (const l of this.lights) {
      l.age += dt;
      const seg = this.body[Math.min(n - 1, Math.max(1, Math.round(l.at * (n - 1))))];
      const a = l.phase + this.time * 0.9;
      const r = (4 + (l.phase % 3) * 1.5) * S;
      let x = seg.x + Math.cos(a) * r;
      let y = seg.y + Math.sin(a) * r;
      const twinkle = l.kind === 'ot' ? 0.6 + 0.4 * Math.sin(this.time * 4.2 + l.phase) : 0.8 + 0.2 * Math.sin(this.time * 2 + l.phase);
      let scale = 0.11 * S;
      // a new light leaves the head and settles in its place
      if (l.age < 1.4) {
        const k = l.age / 1.4;
        const e = 1 - Math.pow(1 - k, 3);
        x = this.x + (x - this.x) * e;
        y = this.y + (y - this.y) * e;
        scale *= 1 + 2.4 * (1 - e);
      }
      l.s.position.set(x, y);
      l.s.scale.set(scale);
      l.s.tint = l.kind === 'ot' ? mixColor(l.color, GOLD, 0.55) : mixColor(l.color, 0xffffff, 0.25);
      l.s.alpha = twinkle * (0.45 + 0.55 * v);
    }

    // one ring of light around the head for each encounter
    this.wreaths.forEach((w, i) => {
      w.age += dt;
      const born = Math.min(1, w.age / 1.8);
      const e = 1 - Math.pow(1 - born, 3);
      const size = (0.42 + i * 0.12) * S * (1 + (1 - e) * 1.6);
      w.s.position.set(this.x, this.y);
      w.s.rotation = w.tilt + Math.sin(this.time * 0.35 + i) * 0.5;
      w.s.scale.set(size, size * (0.5 + 0.08 * Math.sin(this.time * 0.8 + i * 2)));
      w.s.tint = w.color;
      w.s.alpha = (0.32 + 0.1 * Math.sin(this.time * 1.3 + i)) * v * (born < 1 ? 0.5 + 1.5 * (1 - e) : 1);
    });

    // cilia orbit the head and stream backwards when moving
    this.cilia.forEach((c, i) => {
      const a = c.phase + this.time * (0.8 + (i % 4) * 0.15);
      const back = stretch * 9 * S;
      const r = c.r * S * (0.7 + 0.3 * v) + Math.sin(this.time * 3 + i) * 2;
      c.s.position.set(this.x + Math.cos(a) * r - Math.cos(this.heading) * back, this.y + Math.sin(a) * r * 0.8 - Math.sin(this.heading) * back);
      c.s.tint = i % 3 === 0 ? this.accent : this.color;
      c.s.alpha = (0.35 + 0.35 * Math.sin(this.time * 2 + i)) * v;
    });

    // trail
    this.emitClock -= dt;
    if (this.trailOn && sp > 14 && this.emitClock <= 0) {
      this.emitClock = 0.035;
      const bit = this.trail.find((t) => t.life <= 0);
      if (bit) {
        bit.life = 1;
        bit.p.x = tail.x + (Math.random() - 0.5) * 4;
        bit.p.y = tail.y + (Math.random() - 0.5) * 4;
        bit.vx = (Math.random() - 0.5) * 6;
        bit.vy = (Math.random() - 0.5) * 6;
        bit.p.tint = Math.random() < 0.3 ? this.accent : this.color;
      }
    }
    for (const t of this.trail) {
      if (t.life <= 0) continue;
      t.life -= dt / 1.7;
      t.p.x += t.vx * dt;
      t.p.y += t.vy * dt;
      const s = 0.22 * t.life * (0.5 + 0.5 * v);
      t.p.scaleX = t.p.scaleY = s;
      t.p.alpha = Math.max(0, t.life * 0.45 * v);
    }
  }
}

export function mixColor(a: number, b: number, t: number) {
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
  const g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
  const bl = (a & 255) * (1 - t) + (b & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
