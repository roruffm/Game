// The light organism: a soft head, a trailing body of linked lights, small cilia that stream
// back with the motion, and a fading trail. It glides with inertia and turns slowly, like
// something floating in water rather than a cursor.

import { Container, Particle, ParticleContainer, Sprite } from 'pixi.js';
import type { Steer } from './input';
import { textures } from './textures';

const SEGMENTS = 9;
const CILIA = 16;
const TRAIL = 90;

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
  private body: { s: Sprite; x: number; y: number }[] = [];
  private cilia: { s: Sprite; phase: number; r: number }[] = [];
  private trail: TrailBit[] = [];
  private emitClock = 0;

  constructor() {
    const t = textures();
    this.aura = this.sprite(t.glow, 1.5, 0.22);
    for (let i = 0; i < SEGMENTS; i++) {
      const s = this.sprite(t.glow, 0.42 - i * 0.03, 0.55 - i * 0.045);
      this.body.push({ s, x: 0, y: 0 });
    }
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
      b.s.tint = i < 3 ? this.color : mixColor(this.color, this.accent, i / SEGMENTS);
      b.s.alpha = (0.5 - i * 0.045) * (0.35 + 0.65 * v);
      px = b.x;
      py = b.y;
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
