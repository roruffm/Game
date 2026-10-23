// The light organism: a soft head, a trailing body of linked lights, small cilia that stream
// back with the motion, and a fading trail. It glides with inertia and turns slowly, like
// something floating in water rather than a cursor. What the player has discovered stays with
// it: small lights along the body in the colours of the passages, and a ring of light around
// the head for every encounter. They show what was found; they are not a score.

import { Container, Particle, ParticleContainer, Sprite } from 'pixi.js';
import type { Steer } from './input';
import { textures } from './textures';

const SEGMENTS = 9;
/** The body grows by one segment for every few discoveries, up to this many. */
const MAX_SEGMENTS = 15;
const MAX_LIGHTS = 24;
const CILIA = 16;
const TRAIL = 90;
const GOLD = 0xffd98a;

/** Something the player discovered, as the organism carries it. */
export interface Memory {
  /** Stable per discovery, so a light keeps its place. */
  key: string;
  kind: 'nt' | 'ot' | 'encounter';
  /** The colour of the passage's group of books, or of the encounter. */
  color: number;
}

interface Light {
  key: string;
  s: Sprite;
  kind: Memory['kind'];
  color: number;
  /** Which body segment it rests by. */
  seg: number;
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
  private time = 0;
  private aura: Sprite;
  private head: Sprite;
  private heart: Sprite;
  private body: { s: Sprite; x: number; y: number; scale: number; alpha: number }[] = [];
  private cilia: { s: Sprite; phase: number; r: number }[] = [];
  private lights: Light[] = [];
  private wreaths: Wreath[] = [];
  private memoryLayer = new Container();
  private trail: TrailBit[] = [];
  private emitClock = 0;

  constructor() {
    const t = textures();
    this.aura = this.sprite(t.glow, 1.5, 0.22);
    for (let i = 0; i < SEGMENTS; i++) this.body.push({ s: this.sprite(t.glow, 0.4, 0.5), x: 0, y: 0, scale: 0, alpha: 0 });
    this.shapeBody();
    this.root.addChild(this.memoryLayer);
    for (let i = 0; i < CILIA; i++) {
      this.cilia.push({ s: this.sprite(t.dot, 0.35, 0.8), phase: (i / CILIA) * Math.PI * 2, r: 11 + (i % 3) * 3 });
    }
    this.head = this.sprite(t.glow, 0.62, 0.9);
    this.heart = this.sprite(t.core, 0.28, 1);
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
  }

  private sprite(tex: Sprite['texture'], scale: number, alpha: number) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(scale);
    s.alpha = alpha;
    s.blendMode = 'add';
    this.root.addChild(s);
    return s;
  }

  /** Tapers the body from head to tail, whatever its length. */
  private shapeBody() {
    const n = this.body.length;
    this.body.forEach((b, i) => {
      const k = i / (n - 1);
      b.scale = 0.42 * (1 - 0.57 * k);
      b.alpha = 0.5 * (1 - 0.65 * k);
      b.s.scale.set(b.scale);
    });
  }

  /**
   * Shows what has been discovered. New memories join with a small arrival (unless `animate`
   * is false, e.g. when a saved world is loaded); memories that are gone fade away.
   */
  setMemories(memories: Memory[], animate = true) {
    const t = textures();
    const passages = memories.filter((m) => m.kind !== 'encounter');
    // a longer body for a fuller world
    const wanted = Math.min(MAX_SEGMENTS, SEGMENTS + Math.floor(passages.length / 3));
    while (this.body.length < wanted) {
      const tail = this.body[this.body.length - 1];
      const s = new Sprite(t.glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.root.addChildAt(s, this.root.getChildIndex(tail.s) + 1);
      this.body.push({ s, x: tail.x, y: tail.y, scale: 0, alpha: 0 });
    }
    while (this.body.length > wanted && this.body.length > SEGMENTS) this.body.pop()!.s.destroy();
    this.shapeBody();

    const shown = passages.slice(-MAX_LIGHTS);
    const keep = new Set(shown.map((m) => m.key));
    this.lights = this.lights.filter((l) => {
      if (keep.has(l.key)) return true;
      l.s.destroy();
      return false;
    });
    shown.forEach((m, i) => {
      if (this.lights.some((l) => l.key === m.key)) return;
      const s = new Sprite(t.glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.alpha = 0;
      this.memoryLayer.addChild(s);
      // spread along the body by the golden angle, so neighbours rarely share a segment
      const seg = 1 + Math.floor(((i * 0.618) % 1) * (this.body.length - 1));
      this.lights.push({ key: m.key, s, kind: m.kind, color: m.color, seg, phase: i * 2.39996, age: animate ? 0 : 99 });
    });
    this.lights.forEach((l) => (l.seg = Math.min(l.seg, this.body.length - 1)));

    const encounters = memories.filter((m) => m.kind === 'encounter');
    for (const m of encounters) {
      if (this.wreaths.some((w) => w.key === m.key)) continue;
      const s = new Sprite(t.ring);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.alpha = 0;
      this.memoryLayer.addChild(s);
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
    this.draw(dt, sp);
  }

  private draw(dt: number, sp: number) {
    const v = this.vitality;
    const pulse = 1 + Math.sin(this.time * 2.4) * 0.06;
    const stretch = Math.min(1, sp / this.maxSpeed);
    this.head.position.set(this.x, this.y);
    this.head.scale.set(0.62 * pulse * (0.55 + 0.45 * v));
    this.head.tint = this.color;
    this.head.alpha = 0.55 + 0.4 * v;
    this.heart.position.set(this.x, this.y);
    this.heart.scale.set(0.26 * pulse * (0.6 + 0.4 * v));
    this.heart.tint = this.accent;
    this.aura.position.set(this.x, this.y);
    this.aura.scale.set((1.3 + stretch * 0.4) * (0.5 + 0.5 * v));
    this.aura.tint = this.color;
    this.aura.alpha = 0.12 + 0.12 * v;

    // body: each segment follows the one before it at a fixed spacing
    let px = this.x;
    let py = this.y;
    const spacing = 6.5;
    this.body.forEach((b, i) => {
      const dx = b.x - px;
      const dy = b.y - py;
      const d = Math.hypot(dx, dy) || 1;
      const wave = Math.sin(this.time * 5 - i * 0.7) * 1.6 * stretch;
      b.x = px + (dx / d) * spacing + Math.cos(this.heading + Math.PI / 2) * wave * dt * 10;
      b.y = py + (dy / d) * spacing + Math.sin(this.heading + Math.PI / 2) * wave * dt * 10;
      b.s.position.set(b.x, b.y);
      b.s.tint = i < 3 ? this.color : mixColor(this.color, this.accent, i / this.body.length);
      b.s.alpha = b.alpha * (0.35 + 0.65 * v);
      px = b.x;
      py = b.y;
    });

    // the discovered passages, resting along the body
    for (const l of this.lights) {
      l.age += dt;
      const seg = this.body[l.seg];
      const a = l.phase + this.time * 0.9;
      const r = 4 + (l.seg % 3) * 1.5;
      let x = seg.x + Math.cos(a) * r;
      let y = seg.y + Math.sin(a) * r;
      const twinkle = l.kind === 'ot' ? 0.6 + 0.4 * Math.sin(this.time * 4.2 + l.phase) : 0.8 + 0.2 * Math.sin(this.time * 2 + l.phase);
      let scale = 0.11 * (0.6 + 0.4 * v);
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
      const size = (0.42 + i * 0.12) * (0.6 + 0.4 * v) * (1 + (1 - e) * 1.6);
      w.s.position.set(this.x, this.y);
      w.s.rotation = w.tilt + Math.sin(this.time * 0.35 + i) * 0.5;
      w.s.scale.set(size, size * (0.5 + 0.08 * Math.sin(this.time * 0.8 + i * 2)));
      w.s.tint = w.color;
      w.s.alpha = (0.32 + 0.1 * Math.sin(this.time * 1.3 + i)) * v * (born < 1 ? 0.5 + 1.5 * (1 - e) : 1);
    });

    // cilia orbit the head and stream backwards when moving
    this.cilia.forEach((c, i) => {
      const a = c.phase + this.time * (0.8 + (i % 4) * 0.15);
      const back = stretch * 9;
      const r = c.r * (0.7 + 0.3 * v) + Math.sin(this.time * 3 + i) * 2;
      c.s.position.set(
        this.x + Math.cos(a) * r - Math.cos(this.heading) * back,
        this.y + Math.sin(a) * r * 0.8 - Math.sin(this.heading) * back,
      );
      c.s.tint = i % 3 === 0 ? this.accent : this.color;
      c.s.alpha = (0.35 + 0.35 * Math.sin(this.time * 2 + i)) * v;
    });

    // trail
    this.emitClock -= dt;
    if (this.trailOn && sp > 14 && this.emitClock <= 0) {
      this.emitClock = 0.035;
      const tail = this.body[this.body.length - 1];
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
