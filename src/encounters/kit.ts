// Encounter Engine: the shared frame every encounter module runs in. It owns the organism
// inside the encounter, the camera, the narrative beats (verses shown on screen) and the
// four phases. Modules only describe their world and mechanics.

import { Container, Graphics, Sprite } from 'pixi.js';
import { audio } from '../audio/audio';
import type { Bible } from '../bible/bible';
import type { EncounterInfo } from '../content/encounters';
import type { Game, Scene } from '../engine/game';
import type { Steer } from '../engine/input';
import { textures } from '../engine/textures';
import { store, type Beat } from '../state/store';
import type { CrossRefs } from '../xref/crossrefs';

export interface EncounterApi {
  game: Game;
  bible: Bible;
  xrefs: CrossRefs;
  info: EncounterInfo;
  /** Verse texts of the passage's chapter, by verse number. */
  verse: (n: number) => string;
  finish: () => void;
}

export interface EncounterModule {
  create(api: EncounterApi): EncounterScene;
}

export abstract class EncounterScene implements Scene {
  readonly root = new Container();
  protected readonly back = new Container();
  protected readonly front = new Container();
  protected phase = 0;
  protected t = 0;
  /** Seconds since the current phase began. */
  protected phaseTime = 0;
  protected bounds = { x: -1200, y: -800, w: 2400, h: 1600 };
  protected cameraZoom = 0.9;
  private beats: Beat[] = [];
  /** Beats wait here so each one stays long enough to be read, in order. */
  private queue: Beat[] = [];
  private shownAt = -Infinity;
  private hold = 0;
  private schedule: { at: number; run: () => void }[] = [];
  protected steeringLocked = false;
  protected finished = false;

  constructor(protected readonly api: EncounterApi) {
    this.root.addChild(this.back, this.front);
  }

  get game() {
    return this.api.game;
  }

  get org() {
    return this.api.game.organism;
  }

  enter() {
    const g = this.game;
    this.root.addChild(g.organism.trailLayer, g.organism.root);
    const coarse = g.quality.particles < 1;
    g.camera.targetZoom = coarse ? this.cameraZoom * 0.72 : this.cameraZoom;
    g.camera.zoom = g.camera.targetZoom;
    this.publish({ hint: null, done: false });
    this.start();
    g.camera.jump(this.org.x, this.org.y + (g.camera.height * 0.12) / g.camera.zoom);
  }

  leave() {
    this.root.removeChild(this.game.organism.trailLayer, this.game.organism.root);
  }

  /** Set up the world and place the organism. */
  protected abstract start(): void;
  /** Per-frame logic of the encounter. */
  protected abstract step(dt: number): void;
  /** External current at a world position (water, wind, pull). */
  protected current(_x: number, _y: number): { x: number; y: number } {
    return { x: 0, y: 0 };
  }

  update(dt: number) {
    this.t += dt;
    this.phaseTime += dt;
    for (const s of this.schedule.filter((x) => x.at <= this.t)) s.run();
    this.schedule = this.schedule.filter((x) => x.at > this.t);
    if (this.queue.length && this.t - this.shownAt >= this.hold) this.showNext();
    const g = this.game;
    let steer: Steer = g.input.steer(g.camera, this.org.x, this.org.y);
    if (this.steeringLocked) steer = { x: 0, y: 0, thrust: 0, boost: false };
    this.org.update(dt, steer, this.current(this.org.x, this.org.y));
    // keep the organism inside the scene with a soft edge
    const b = this.bounds;
    const pad = 60;
    if (this.org.x < b.x + pad) this.org.vx += (b.x + pad - this.org.x) * dt * 4;
    if (this.org.x > b.x + b.w - pad) this.org.vx -= (this.org.x - (b.x + b.w - pad)) * dt * 4;
    if (this.org.y < b.y + pad) this.org.vy += (b.y + pad - this.org.y) * dt * 4;
    if (this.org.y > b.y + b.h - pad) this.org.vy -= (this.org.y - (b.y + b.h - pad)) * dt * 4;
    this.step(dt);
    // keep the organism in the upper part of the screen; the verses sit below
    const lift = (g.camera.height * 0.12) / g.camera.zoom;
    g.camera.follow(this.org.x + this.org.vx * 0.3, this.org.y + this.org.vy * 0.3 + lift, dt, 2.4);
  }

  /** Runs `run` after `seconds`. */
  protected later(seconds: number, run: () => void) {
    this.schedule.push({ at: this.t + seconds, run });
  }

  protected setPhase(n: number) {
    this.phase = n;
    this.phaseTime = 0;
    this.publish({});
    audio.chime('enter');
  }

  /** Shows verses of the passage's chapter as scripture. */
  protected say(from: number, to = from) {
    const verses: string[] = [];
    for (let v = from; v <= to; v++) verses.push(this.api.verse(v));
    const ch = this.api.bible.ref(this.api.bible.range(this.api.info.range).start);
    const book = this.api.bible.book(this.api.bible.range(this.api.info.range).start);
    const label = `${book.name} ${ch.c},${from}${to > from ? `–${to}` : ''}`;
    this.pushBeat({ ref: `${book.code} ${ch.c}:${from}${to > from ? `-${to}` : ''}`, label, text: verses.join(' '), kind: 'bibel' });
  }

  protected pushBeat(beat: Beat) {
    this.queue.push(beat);
    if (this.t - this.shownAt >= this.hold) this.showNext();
  }

  private showNext() {
    const beat = this.queue.shift();
    if (!beat) return;
    this.beats = [...this.beats, beat].slice(-4);
    this.shownAt = this.t;
    // roughly the time it takes to read the verse calmly
    this.hold = Math.max(2.5, Math.min(8, 1.5 + beat.text.length / 24));
    this.publish({});
    audio.chime('beat');
  }

  /** True while verses are still waiting to be shown. */
  protected get narrating() {
    return this.queue.length > 0;
  }

  protected hint(text: string | null) {
    this.publish({ hint: text });
  }

  protected complete() {
    if (this.finished) return;
    if (this.queue.length) {
      // let the last verses be read before the encounter closes
      this.later(this.hold + 0.5, () => this.complete());
      return;
    }
    this.finished = true;
    this.publish({ done: true, hint: null });
    this.api.finish();
  }

  private publish(patch: { hint?: string | null; done?: boolean }) {
    const prev = store.get().encounter;
    store.set({
      encounter: {
        id: this.api.info.id,
        phase: this.phase,
        beats: this.beats,
        hint: patch.hint !== undefined ? patch.hint : (prev?.hint ?? null),
        done: patch.done ?? prev?.done ?? false,
      },
    });
  }

  /** For tests and accessibility: where the player should go next, if anywhere. */
  abstract objective(): { x: number; y: number } | null;

  destroy() {
    this.root.destroy({ children: true });
  }
}

/** A point of the story: glows, pulls the eye, and reveals its beat when touched. */
export class Beacon {
  readonly root = new Container();
  revealed = false;
  active = true;
  private glow: Sprite;
  private ring: Sprite;
  private core: Sprite;
  private time = Math.random() * 5;

  constructor(
    public x: number,
    public y: number,
    public color: number,
    public radius = 70,
  ) {
    const t = textures();
    const mk = (tex: Sprite['texture'], s: number) => {
      const sp = new Sprite(tex);
      sp.anchor.set(0.5);
      sp.blendMode = 'add';
      sp.scale.set(s);
      sp.tint = color;
      this.root.addChild(sp);
      return sp;
    };
    this.glow = mk(t.glow, 1.4);
    this.ring = mk(t.ring, 0.6);
    this.core = mk(t.core, 0.25);
    this.root.position.set(x, y);
  }

  /** True on the frame the organism first touches it. */
  update(dt: number, ox: number, oy: number): boolean {
    this.time += dt;
    this.root.position.set(this.x, this.y);
    const pulse = 1 + Math.sin(this.time * 2.2) * 0.12;
    const shown = this.active && !this.revealed;
    this.root.alpha += ((shown ? 1 : this.revealed ? 0.25 : 0) - this.root.alpha) * Math.min(1, dt * 3);
    this.glow.scale.set(1.4 * pulse);
    this.ring.rotation += dt * 0.6;
    this.ring.scale.set(0.6 * pulse + (this.revealed ? 0.4 : 0));
    this.core.scale.set(0.25 * pulse);
    if (shown && Math.hypot(ox - this.x, oy - this.y) < this.radius) {
      this.revealed = true;
      return true;
    }
    return false;
  }
}

/** An expanding ring of light, e.g. when the storm is calmed. */
export class Shockwave {
  readonly g = new Graphics();
  private age = 0;

  constructor(
    private x: number,
    private y: number,
    private color: number,
    private duration = 3,
    private reach = 1400,
  ) {
    this.g.blendMode = 'add';
  }

  update(dt: number): boolean {
    this.age += dt;
    const k = this.age / this.duration;
    this.g.clear();
    if (k >= 1) return false;
    const r = this.reach * (1 - Math.pow(1 - k, 2));
    for (let i = 0; i < 3; i++) {
      this.g.circle(this.x, this.y, r * (1 - i * 0.08)).stroke({ width: 10 - i * 3, color: this.color, alpha: (1 - k) * (0.35 - i * 0.1) });
    }
    return true;
  }
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
