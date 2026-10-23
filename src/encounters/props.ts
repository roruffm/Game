// The figures and things of the stories, drawn in the same light as the organism: no outlines
// and no pictures, only glows, motes and soft leaves of light. A pig is a warm round glow that
// roots about; wine is a deep red light in a thin golden rim; a crowd is a ring of small lights.
// The encounter modules place them and say what they do.

import { Container, Graphics, Particle, ParticleContainer, Sprite, type Texture } from 'pixi.js';
import { noise } from '../engine/noise';
import { mixColor } from '../engine/organism';
import type { Rect } from '../engine/particles';
import { textures } from '../engine/textures';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** A soft additive sprite, the brick everything here is built from. */
export function light(tex: Texture, scale: number, tint: number, alpha: number, parent?: Container) {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.blendMode = 'add';
  s.scale.set(scale);
  s.tint = tint;
  s.alpha = alpha;
  parent?.addChild(s);
  return s;
}

/** Eases `from` towards `to` at `rate` per second. */
export const ease = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

/**
 * People as small lights: a crowd standing together, a round dance (Reigen) circling someone,
 * or a group scattering. Each light keeps its own little rhythm.
 */
export class Swarm {
  readonly root = new Container();
  x = 0;
  y = 0;
  radius: number;
  /** How the lights move: in a calm crowd, dancing in a ring, or drifting apart. */
  mode: 'crowd' | 'dance' | 'scatter' = 'crowd';
  /** Turns per second of the round dance. */
  spin = 0.12;
  /** 0–1, how visible the lights are. */
  shown = 1;
  /** Extra brightness, e.g. while someone feeds them. */
  glee = 0;
  private bits: { body: Sprite; head: Sprite; size: number; a: number; r: number; phase: number; x: number; y: number; drift: { x: number; y: number } }[] = [];
  private time = Math.random() * 5;
  /** How visible the lights are now; starts at `shown` (-1: not yet drawn). */
  private fade = -1;

  constructor(n: number, colors: number[], size: number, radius: number) {
    this.radius = radius;
    const t = textures();
    for (let i = 0; i < n; i++) {
      // a figure: a soft upright body and a small bright head
      const k = size * rnd(0.85, 1.15);
      const color = colors[i % colors.length];
      const body = light(t.glow, k, color, 0, this.root);
      body.scale.set(k * 0.55, k);
      const head = light(t.core, k * 0.32, mixColor(color, 0xffffff, 0.35), 0, this.root);
      this.bits.push({ body, head, size: k, a: (i / n) * Math.PI * 2, r: rnd(0.55, 1), phase: rnd(0, 7), x: 0, y: 0, drift: { x: rnd(-1, 1), y: rnd(-1, 1) } });
    }
  }

  place(x: number, y: number) {
    this.x = x;
    this.y = y;
    for (const b of this.bits) {
      b.x = x + Math.cos(b.a) * this.radius * b.r;
      b.y = y + Math.sin(b.a) * this.radius * b.r * 0.7;
    }
  }

  update(dt: number) {
    this.time += dt;
    this.fade = this.fade < 0 ? this.shown : ease(this.fade, this.shown, 1.5, dt);
    this.glee = Math.max(0, this.glee - dt * 0.6);
    for (const b of this.bits) {
      let tx: number;
      let ty: number;
      if (this.mode === 'dance') {
        b.a += this.spin * Math.PI * 2 * dt;
        // a hop with every step of the dance
        const hop = Math.abs(Math.sin(this.time * 4 + b.phase)) * 8;
        tx = this.x + Math.cos(b.a) * this.radius;
        ty = this.y + Math.sin(b.a) * this.radius * 0.7 - hop;
      } else if (this.mode === 'scatter') {
        tx = b.x + b.drift.x * 60;
        ty = b.y + b.drift.y * 60;
      } else {
        tx = this.x + Math.cos(b.a) * this.radius * b.r + Math.sin(this.time * 0.7 + b.phase) * 6;
        ty = this.y + Math.sin(b.a) * this.radius * b.r * 0.7 + Math.cos(this.time * 0.5 + b.phase) * 4;
      }
      b.x = ease(b.x, tx, this.mode === 'dance' ? 6 : 1.5, dt);
      b.y = ease(b.y, ty, this.mode === 'dance' ? 6 : 1.5, dt);
      const sway = this.mode === 'dance' ? Math.sin(this.time * 4 + b.phase) * 0.25 : Math.sin(this.time * 0.8 + b.phase) * 0.05;
      b.body.position.set(b.x, b.y);
      b.body.rotation = sway;
      b.head.position.set(b.x + Math.sin(sway) * b.size * 38, b.y - Math.cos(sway) * b.size * 38);
      const flicker = 0.75 + 0.25 * Math.sin(this.time * 2.3 + b.phase);
      const a = Math.min(1, (0.6 + 0.5 * this.glee) * flicker * this.fade);
      b.body.alpha = a * 0.8;
      b.head.alpha = a;
    }
  }
}

/**
 * A pig, as a light: a round warm body, a smaller head with a snout, two ears and a curled
 * tail. It roots about on its own, follows whoever herds it, and eats.
 */
export class Beast {
  readonly root = new Container();
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  heading = Math.random() * Math.PI * 2;
  /** Where it wants to go (null: it roots about where it is). */
  goal: { x: number; y: number } | null = null;
  private body: Sprite;
  private head: Sprite;
  private snout: Sprite;
  private ears: Sprite[];
  private tail: Sprite[];
  private legs: Sprite[];
  private time = Math.random() * 9;
  private chew = 0;
  private wander = { x: 0, y: 0 };

  constructor(x: number, y: number, color = 0xe7a08e) {
    const t = textures();
    this.x = x;
    this.y = y;
    light(t.glow, 0.95, color, 0.22, this.root);
    this.legs = [0, 1, 2, 3].map(() => light(t.dot, 0.8, mixColor(color, 0x000000, 0.2), 0.75, this.root));
    this.tail = [0, 1, 2].map(() => light(t.dot, 0.5, color, 0.8, this.root));
    this.body = light(t.core, 0.9, mixColor(color, 0x000000, 0.15), 0.55, this.root);
    this.head = light(t.core, 0.48, color, 0.7, this.root);
    this.ears = [0, 1].map(() => {
      const s = light(t.leaf, 0.12, mixColor(color, 0xffffff, 0.2), 0.85, this.root);
      s.anchor.set(0.05, 0.5);
      return s;
    });
    this.snout = light(t.core, 0.2, mixColor(color, 0xffd0c0, 0.55), 0.95, this.root);
  }

  /** A little start of joy: it has eaten. */
  eat() {
    this.chew = 1;
  }

  update(dt: number, maxSpeed = 70) {
    this.time += dt;
    this.chew = Math.max(0, this.chew - dt * 1.2);
    let ax = 0;
    let ay = 0;
    if (this.goal) {
      const dx = this.goal.x - this.x;
      const dy = this.goal.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = Math.min(maxSpeed, d * 1.2);
      ax = ((dx / d) * want - this.vx) * 2;
      ay = ((dy / d) * want - this.vy) * 2;
    } else {
      // rooting about: short, lazy wanderings
      this.wander.x = noise.get(this.time * 0.2, this.x * 0.01) * 22;
      this.wander.y = noise.get(this.y * 0.01, this.time * 0.2 + 5) * 16;
      ax = (this.wander.x - this.vx) * 1.5;
      ay = (this.wander.y - this.vy) * 1.5;
    }
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 3) {
      let d = Math.atan2(this.vy, this.vx) - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 3);
    }
    this.draw(sp);
  }

  private draw(sp: number) {
    const fx = Math.cos(this.heading);
    const fy = Math.sin(this.heading);
    const step = this.time * (3 + sp * 0.08);
    const trot = Math.min(1, sp / 30);
    this.root.position.set(this.x, this.y);
    const bob = Math.sin(step * 2) * 1.5 * trot;
    this.body.position.set(0, bob);
    this.body.rotation = this.heading;
    this.body.scale.set(0.95, 0.66);
    // the head dips to the ground when rooting or chewing
    const dip = this.goal ? 0 : (0.5 + 0.5 * Math.sin(this.time * 1.7)) * 3;
    const nod = Math.sin(this.time * 18) * 2 * this.chew;
    const hx = fx * 30;
    const hy = fy * 30 + bob + dip + nod;
    this.head.position.set(hx, hy);
    this.snout.position.set(hx + fx * 12, hy + fy * 12 + 1);
    this.ears.forEach((e, i) => {
      const side = i === 0 ? 1 : -1;
      e.position.set(hx - fx * 4 - fy * side * 8, hy - fy * 4 + fx * side * 8 - 3);
      e.rotation = this.heading + Math.PI + side * 0.9 + Math.sin(this.time * 2 + i) * 0.15;
    });
    this.tail.forEach((s, i) => {
      // a little curl behind
      const a = this.time * 3 + i * 1.6;
      s.position.set(-fx * (32 + i * 4) + Math.cos(a) * 4, -fy * (32 + i * 4) + Math.sin(a) * 4 + bob);
    });
    this.legs.forEach((s, i) => {
      const front = i < 2 ? 15 : -15;
      const side = i % 2 ? 9 : -9;
      const lift = Math.max(0, Math.sin(step * 2 + (i % 2 ? Math.PI : 0) + (i < 2 ? 0 : Math.PI))) * 4 * trot;
      s.position.set(fx * front - fy * side, fy * front + fx * side + 14 - lift);
    });
  }
}

/** Carob pods (Treber), the pigs' food: small dry leaves of ochre light on the ground. */
export class Pod {
  readonly root: Sprite;
  x: number;
  y: number;
  eaten = false;
  /** Who takes it: the pod slides there, out of reach. */
  taker: Beast | null = null;
  private time = Math.random() * 6;
  private gone = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.root = light(textures().leaf, 0.2, 0xc9a24e, 0.85);
    this.root.anchor.set(0.5);
    this.root.rotation = rnd(0, Math.PI * 2);
  }

  /** False once it has been eaten and faded. */
  update(dt: number) {
    this.time += dt;
    if (this.taker && !this.eaten) {
      this.x = ease(this.x, this.taker.x + Math.cos(this.taker.heading) * 30, 5, dt);
      this.y = ease(this.y, this.taker.y + Math.sin(this.taker.heading) * 30, 5, dt);
      if (Math.hypot(this.x - this.taker.x, this.y - this.taker.y) < 40) {
        this.eaten = true;
        this.taker.eat();
      }
    }
    if (this.eaten) this.gone = Math.min(1, this.gone + dt * 2);
    this.root.position.set(this.x, this.y);
    this.root.scale.set(0.3 * (1 - this.gone), 0.12 * (1 - this.gone));
    this.root.alpha = (0.75 + 0.2 * Math.sin(this.time * 1.5)) * (1 - this.gone);
    return this.gone < 1;
  }
}

/** A flickering lamp: warm, a little restless, and it can go out. */
export class Lantern {
  readonly root = new Container();
  lit = 1;
  private halo: Sprite;
  private flame: Sprite;
  private time = Math.random() * 9;
  private target = 1;

  constructor(
    public x: number,
    public y: number,
    private color: number,
    size = 1,
  ) {
    const t = textures();
    this.halo = light(t.glow, 0.9 * size, color, 0.3, this.root);
    this.flame = light(t.core, 0.2 * size, mixColor(color, 0xffffff, 0.45), 0.9, this.root);
    this.root.position.set(x, y);
  }

  set on(on: boolean) {
    this.target = on ? 1 : 0;
  }

  update(dt: number) {
    this.time += dt;
    this.lit = ease(this.lit, this.target, this.target ? 1.2 : 0.8, dt);
    const flick = 0.8 + 0.2 * noise.get(this.time * 3, this.x);
    this.root.position.set(this.x, this.y + Math.sin(this.time * 0.9) * 2);
    this.halo.alpha = 0.32 * flick * this.lit;
    this.flame.alpha = 0.9 * flick * this.lit;
    this.halo.tint = this.color;
  }
}

/** Wine: a deep red light in a thin golden rim, drifting gently. */
export class Goblet {
  readonly root = new Container();
  drunk = 0;
  taken = false;
  /** Where it floats; it may be moved, e.g. to offer it. */
  home: { x: number; y: number };
  private time = Math.random() * 9;

  constructor(
    public x: number,
    public y: number,
  ) {
    const t = textures();
    this.home = { x, y };
    light(t.glow, 0.5, 0xc0284a, 0.5, this.root);
    // the cup: a bowl of wine on a thin stem
    const bowl = light(t.core, 0.3, 0xff5a78, 0.9, this.root);
    bowl.scale.set(0.3, 0.22);
    const stem = light(t.glow, 0.1, 0xffd98a, 0.6, this.root);
    stem.scale.set(0.05, 0.16);
    stem.y = 12;
    const rim = light(t.ring, 0.2, 0xffd98a, 0.8, this.root);
    rim.scale.set(0.2, 0.06);
    rim.y = -6;
    this.root.position.set(x, y);
  }

  update(dt: number, sip: { x: number; y: number } | null) {
    this.time += dt;
    if (this.taken) {
      this.drunk = Math.min(1, this.drunk + dt * 2.5);
      if (sip) {
        this.x = ease(this.x, sip.x, 8, dt);
        this.y = ease(this.y, sip.y, 8, dt);
      }
    } else {
      this.x = this.home.x + Math.sin(this.time * 0.6) * 18;
      this.y = this.home.y + Math.cos(this.time * 0.8) * 12;
    }
    this.root.position.set(this.x, this.y);
    this.root.rotation = this.taken ? this.drunk * 1.2 : Math.sin(this.time) * 0.12;
    this.root.alpha = 1 - this.drunk;
    this.root.scale.set(1 - this.drunk * 0.7);
  }
}

/** A round loaf of light that can be broken in two; crumbs of light fall from the break. */
export class Loaf {
  readonly root = new Container();
  broken = 0;
  /** Where the two halves go once broken. */
  givenTo: [{ x: number; y: number }, { x: number; y: number }] | null = null;
  private halves: Sprite[];
  private crumbs: { s: Sprite; vx: number; vy: number; life: number }[] = [];
  private time = 0;
  private breaking = false;
  private thanks = 0;

  constructor(
    public x: number,
    public y: number,
  ) {
    const t = textures();
    light(t.glow, 0.55, 0xffb35a, 0.35, this.root);
    this.halves = [0, 1].map(() => {
      const s = light(t.glow, 0.3, 0xffd08a, 0.95, this.root);
      s.scale.set(0.18, 0.3);
      return s;
    });
    this.root.position.set(x, y);
  }

  /** He took the bread and gave thanks: it brightens. */
  bless() {
    this.thanks = 1;
  }

  break() {
    this.breaking = true;
  }

  update(dt: number) {
    this.time += dt;
    this.thanks = Math.max(0, this.thanks - dt * 0.4);
    if (this.breaking) this.broken = Math.min(1, this.broken + dt * 0.7);
    this.root.position.set(this.x, this.y);
    const glow = 1 + this.thanks * 0.6;
    this.halves.forEach((s, i) => {
      const side = i === 0 ? -1 : 1;
      let hx = side * (8 + this.broken * 40);
      let hy = -this.broken * 10;
      if (this.givenTo && this.broken >= 1) {
        const to = this.givenTo[i];
        hx = ease(s.x, to.x - this.x, 2, dt);
        hy = ease(s.y, to.y - this.y, 2, dt);
      }
      s.position.set(hx, hy);
      s.rotation = side * this.broken * 0.4;
      s.alpha = 0.95 * Math.min(1.4, glow);
    });
    if (this.breaking && this.broken < 1 && Math.random() < dt * 30) {
      const s = light(textures().dot, rnd(0.25, 0.5), 0xffe2a8, 1, this.root);
      this.crumbs.push({ s, vx: rnd(-30, 30), vy: rnd(10, 50), life: 1 });
    }
    this.crumbs = this.crumbs.filter((c) => {
      c.life -= dt * 0.7;
      c.s.x += c.vx * dt;
      c.s.y += c.vy * dt;
      c.s.alpha = Math.max(0, c.life);
      if (c.life > 0) return true;
      c.s.destroy();
      return false;
    });
  }
}

/** Flames of light rising from something, e.g. a heart that burns. */
export class Flames {
  readonly root: ParticleContainer;
  intensity = 0;
  private bits: { p: Particle; life: number; vx: number; vy: number; ox: number; oy: number }[] = [];
  private clock = 0;

  constructor(
    count: number,
    private colors = [0xffb347, 0xff7a3d, 0xffe2a8],
  ) {
    const tex = textures().glow;
    this.root = new ParticleContainer({ texture: tex, dynamicProperties: { position: true, vertex: true, color: true } });
    this.root.blendMode = 'add';
    for (let i = 0; i < count; i++) {
      const p = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, alpha: 0, scaleX: 0.1, scaleY: 0.1, tint: colors[i % colors.length] });
      this.root.addParticle(p);
      this.bits.push({ p, life: 0, vx: 0, vy: 0, ox: 0, oy: 0 });
    }
  }

  /** Feeds the flames at `at`; call every frame. */
  update(dt: number, at: { x: number; y: number }[]) {
    this.clock -= dt;
    if (this.intensity > 0.02 && this.clock <= 0 && at.length) {
      this.clock = 0.03 / this.intensity;
      const bit = this.bits.find((b) => b.life <= 0);
      if (bit) {
        const src = at[Math.floor(Math.random() * at.length)];
        bit.life = 1;
        bit.ox = src.x + rnd(-8, 8);
        bit.oy = src.y + rnd(-4, 6);
        bit.vx = rnd(-8, 8);
        bit.vy = rnd(-70, -40);
        bit.p.tint = this.colors[Math.floor(Math.random() * this.colors.length)];
      }
    }
    for (const b of this.bits) {
      if (b.life <= 0) continue;
      b.life -= dt * 1.4;
      b.ox += (b.vx + Math.sin(b.life * 12) * 10) * dt;
      b.oy += b.vy * dt;
      b.p.x = b.ox;
      b.p.y = b.oy;
      const s = 0.22 * b.life * (0.6 + 0.4 * this.intensity);
      b.p.scaleX = s * 0.7;
      b.p.scaleY = s * 1.3;
      b.p.alpha = Math.max(0, b.life) * 0.8 * this.intensity;
    }
  }
}

/**
 * Wind made visible: thin streaks of light racing across the view, and spray where it throws
 * water. Only drawn around the camera.
 */
export class Wind {
  readonly root: ParticleContainer;
  strength = 0;
  private streaks: { p: Particle; x: number; y: number; len: number; speed: number }[] = [];

  constructor(count: number) {
    const tex = textures().glow;
    this.root = new ParticleContainer({ texture: tex, dynamicProperties: { position: true, vertex: true, rotation: true, color: true } });
    this.root.blendMode = 'add';
    for (let i = 0; i < count; i++) {
      const p = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, alpha: 0, tint: i % 3 ? 0x9fdcff : 0xe8f7ff });
      this.root.addParticle(p);
      this.streaks.push({ p, x: 0, y: 0, len: rnd(0.6, 1.6), speed: rnd(0.7, 1.3) });
    }
  }

  private time = 0;

  update(dt: number, view: Rect, wind: { x: number; y: number }) {
    this.time += dt;
    for (const s of this.streaks) {
      const inside = s.x >= view.x && s.x <= view.x + view.w && s.y >= view.y && s.y <= view.y + view.h;
      if (!inside) {
        s.x = view.x + Math.random() * view.w;
        s.y = view.y + Math.random() * view.h;
      }
      // a whirlwind: the gust, turned about by eddies
      const c = noise.curl(s.x, s.y, 520, this.time * 0.12);
      const vx = wind.x * 0.6 + c.x * 240;
      const vy = wind.y * 0.6 + c.y * 240;
      const k = (1.6 + this.strength * 2.5) * s.speed;
      s.x += vx * k * dt;
      s.y += vy * k * dt;
      s.p.x = s.x;
      s.p.y = s.y;
      s.p.rotation = Math.atan2(vy, vx);
      s.p.scaleX = (0.4 + (Math.hypot(vx, vy) / 200) * 0.7) * s.len * this.strength;
      s.p.scaleY = 0.025;
      s.p.alpha = 0.35 * this.strength;
    }
  }
}

/** Spray thrown up from the water: bursts of small drops that scatter and fade. */
export class Spray {
  readonly root: ParticleContainer;
  private drops: { p: Particle; vx: number; vy: number; life: number }[] = [];

  constructor(count: number) {
    const tex = textures().dot;
    this.root = new ParticleContainer({ texture: tex, dynamicProperties: { position: true, color: true, vertex: true } });
    this.root.blendMode = 'add';
    for (let i = 0; i < count; i++) {
      const p = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, alpha: 0, tint: i % 2 ? 0xbff4ff : 0x7fd8ff });
      this.root.addParticle(p);
      this.drops.push({ p, vx: 0, vy: 0, life: 0 });
    }
  }

  burst(x: number, y: number, n: number, dir: { x: number; y: number }) {
    for (const d of this.drops) {
      if (n <= 0) break;
      if (d.life > 0) continue;
      n--;
      d.life = rnd(0.6, 1);
      d.p.x = x + rnd(-30, 30);
      d.p.y = y + rnd(-6, 6);
      d.vx = dir.x * rnd(0.4, 1) + rnd(-40, 40);
      d.vy = dir.y * rnd(0.4, 1) - rnd(40, 140);
    }
  }

  update(dt: number) {
    for (const d of this.drops) {
      if (d.life <= 0) continue;
      d.life -= dt * 1.3;
      d.vy += 220 * dt;
      d.p.x += d.vx * dt;
      d.p.y += d.vy * dt;
      d.p.scaleX = d.p.scaleY = 0.45 * Math.max(0, d.life);
      d.p.alpha = Math.max(0, d.life) * 0.85;
    }
  }
}

/** Stars that come out one by one, and their reflection trembling on still water. */
export class Stars {
  readonly root: ParticleContainer;
  shown = 0;
  private stars: { p: Particle; at: number; phase: number; base: number }[] = [];
  private time = 0;
  private fade = 0;

  constructor(count: number, area: Rect) {
    const tex = textures().dot;
    this.root = new ParticleContainer({ texture: tex, dynamicProperties: { color: true, vertex: true } });
    this.root.blendMode = 'add';
    for (let i = 0; i < count; i++) {
      const base = rnd(0.25, 0.9) * (Math.random() < 0.08 ? 1.8 : 1);
      const p = new Particle({
        texture: tex,
        anchorX: 0.5,
        anchorY: 0.5,
        x: area.x + Math.random() * area.w,
        y: area.y + Math.random() * area.h,
        alpha: 0,
        scaleX: base,
        scaleY: base,
        tint: Math.random() < 0.2 ? 0xffe9c0 : 0xdff1ff,
      });
      this.root.addParticle(p);
      this.stars.push({ p, at: Math.random(), phase: rnd(0, 7), base });
    }
  }

  update(dt: number) {
    this.time += dt;
    this.fade = ease(this.fade, this.shown, 0.5, dt);
    for (const s of this.stars) {
      const on = Math.max(0, Math.min(1, (this.fade - s.at * 0.8) * 5));
      s.p.alpha = on * (0.55 + 0.45 * Math.sin(this.time * 1.7 + s.phase));
    }
  }
}

/**
 * A town at night: lit windows in uneven rows over a soft glow, as seen from the road.
 * `shown` lights them up or lets them go dark.
 */
export class Town {
  readonly root = new Container();
  shown = 1;
  private windows: { s: Sprite; at: number; phase: number }[] = [];
  private halo: Sprite;
  private time = 0;
  private fade = -1;

  constructor(
    x: number,
    y: number,
    width: number,
    count: number,
    color = 0xffc070,
  ) {
    const t = textures();
    this.halo = light(t.glow, width / 70, color, 0.18, this.root);
    this.halo.scale.set(width / 70, width / 150);
    for (let i = 0; i < count; i++) {
      // rows that rise towards the middle, like houses on a hill
      const u = rnd(-1, 1);
      const hill = (1 - u * u) * width * 0.22;
      const s = light(t.dot, rnd(0.45, 0.85), Math.random() < 0.3 ? 0xffe2a8 : color, 0, this.root);
      s.position.set(u * width * 0.5, -rnd(0, hill) + rnd(-6, 6));
      this.windows.push({ s, at: Math.random(), phase: rnd(0, 7) });
    }
    this.root.position.set(x, y);
  }

  update(dt: number) {
    this.time += dt;
    this.fade = this.fade < 0 ? this.shown : ease(this.fade, this.shown, 0.7, dt);
    this.halo.alpha = 0.18 * this.fade;
    for (const w of this.windows) {
      const on = Math.max(0, Math.min(1, (this.fade - w.at * 0.6) * 3));
      w.s.alpha = on * (0.7 + 0.3 * Math.sin(this.time * 0.8 + w.phase));
    }
  }
}

/**
 * An image of something told, not seen: it rises faintly beside the road, stays a while and
 * fades. The encounter draws into `root`; `alpha` handles the rest.
 */
export class Vision {
  readonly root = new Container();
  readonly g = new Graphics();
  age = 0;

  /** Moves what is in the image, by its age in seconds. */
  animate: ((age: number, dt: number) => void) | null = null;

  constructor(
    public x: number,
    public y: number,
    private hold = 9,
    private strength = 0.85,
  ) {
    this.g.blendMode = 'add';
    this.root.addChild(this.g);
    this.root.position.set(x, y);
    this.root.alpha = 0;
  }

  /** False once it has faded. */
  update(dt: number) {
    this.age += dt;
    this.animate?.(this.age, dt);
    const into = Math.min(1, this.age / 1.8);
    const out = Math.max(0, Math.min(1, (this.hold + 2.5 - this.age) / 2.5));
    this.root.alpha = this.strength * into * out;
    return this.age < this.hold + 2.5;
  }
}

/**
 * A bird of light: a small bright body with two wings that beat as it flies. It circles,
 * dives for what lies on the ground, and shies away from someone rushing at it.
 */
export class Bird {
  readonly root = new Container();
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** Where it dives to (null: it circles round `home`). */
  target: { x: number; y: number } | null = null;
  home: { x: number; y: number };
  private wings: Sprite[];
  private body: Sprite;
  private angle = Math.random() * Math.PI * 2;
  private radius = rnd(120, 220);
  private time = Math.random() * 9;

  constructor(x: number, y: number, color = 0xe8f1ff) {
    const t = textures();
    this.x = x;
    this.y = y;
    this.home = { x, y };
    light(t.glow, 0.45, color, 0.25, this.root);
    this.wings = [0, 1].map(() => {
      const s = light(t.leaf, 0.18, color, 0.8, this.root);
      s.anchor.set(0.04, 0.5);
      return s;
    });
    this.body = light(t.core, 0.16, 0xffffff, 0.95, this.root);
    this.body.scale.set(0.2, 0.12);
    this.root.scale.set(1.7);
  }

  /** `flee`: a point it keeps away from, and how close it lets it come. */
  update(dt: number, flee: { x: number; y: number; r: number } | null = null) {
    this.time += dt;
    let tx: number;
    let ty: number;
    let speed: number;
    if (this.target) {
      tx = this.target.x;
      ty = this.target.y;
      speed = 300;
    } else {
      this.angle += dt * 0.9;
      tx = this.home.x + Math.cos(this.angle) * this.radius;
      ty = this.home.y + Math.sin(this.angle) * this.radius * 0.6;
      speed = 160;
    }
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    let ax = ((dx / d) * speed - this.vx) * 2.2;
    let ay = ((dy / d) * speed - this.vy) * 2.2;
    if (flee) {
      const fx = this.x - flee.x;
      const fy = this.y - flee.y;
      const fd = Math.hypot(fx, fy) || 1;
      if (fd < flee.r) {
        ax += (fx / fd) * 2400 * (1 - fd / flee.r);
        ay += (fy / fd) * 2400 * (1 - fd / flee.r);
      }
    }
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const heading = Math.atan2(this.vy, this.vx);
    const beat = Math.sin(this.time * (this.target ? 16 : 9)) * 0.7;
    this.root.position.set(this.x, this.y);
    this.body.rotation = heading;
    this.wings.forEach((w, i) => {
      const side = i === 0 ? 1 : -1;
      w.rotation = heading + Math.PI + side * (Math.PI / 2 - 0.5 + beat * 0.6);
      w.scale.set(0.2 * (0.7 + 0.3 * Math.abs(Math.cos(beat))), 0.1);
    });
  }
}

/**
 * A light that leads down into the next layer (warm, its motes spiralling inwards) or back up
 * (cool, its motes rising outwards), as in flOw.
 */
export class DepthLight {
  readonly root = new Container();
  shown = 0;
  private motes: Sprite[] = [];
  private halo: Sprite;
  private time = 0;

  constructor(
    public x: number,
    public y: number,
    readonly kind: 'down' | 'up',
  ) {
    const t = textures();
    const color = kind === 'down' ? 0xff9a5a : 0x7fd8ff;
    this.halo = light(t.glow, 1.1, color, 0.35, this.root);
    light(t.core, 0.3, mixColor(color, 0xffffff, 0.5), 0.95, this.root);
    for (let i = 0; i < 10; i++) this.motes.push(light(t.dot, 0.6, color, 0.8, this.root));
    this.root.position.set(x, y);
    this.root.alpha = 0;
  }

  /** True when something at (x, y) touches it. */
  touches(x: number, y: number, r = 48) {
    return this.shown > 0.6 && Math.hypot(x - this.x, y - this.y) < r;
  }

  update(dt: number) {
    this.time += dt;
    this.shown = Math.min(1, this.shown + dt * 0.8);
    this.root.alpha = this.shown;
    this.root.position.set(this.x, this.y + Math.sin(this.time * 1.2) * 4);
    this.halo.scale.set(1.1 + Math.sin(this.time * 2) * 0.12);
    this.motes.forEach((m, i) => {
      // down: motes spiral inwards; up: they rise outwards
      const k = (this.time * 0.35 + i / this.motes.length) % 1;
      const r = this.kind === 'down' ? 70 * (1 - k) : 20 + 60 * k;
      const a = i * 2.4 + this.time * (this.kind === 'down' ? 1.6 : -1.2);
      m.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.8 - (this.kind === 'up' ? k * 20 : 0));
      m.alpha = Math.sin(k * Math.PI) * 0.9;
    });
  }
}
