// Words as food. Once a verse has been read, its words leave the thought and float in the
// world as small lights, each still carrying its word. They drift on the current, are drawn
// gently towards the organism and are taken in when it swims through them, as in flOw.
//
// The words are drawn on the screen layer, so they stay readable at every zoom; their glow
// lives in the world and moves with it.

import { Container, Sprite, Text, TextStyle } from 'pixi.js';
import type { Camera } from './camera';
import { noise } from './noise';
import type { Organism } from './organism';
import { textures } from './textures';

const MAX = 140;
/** Seconds a word floats before it fades (if it is not eaten). */
const LIFE = 70;
/** Seconds a word keeps its reading size after leaving the thought. */
const SETTLE = 1.4;

export interface Morsel {
  word: string;
  color: number;
}

interface Bit extends Morsel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  /** Seconds since it was taken in, or -1. */
  eaten: number;
  text: Text;
  glow: Sprite;
  phase: number;
  /** Size of the word on screen when it left the thought, in pixels. */
  size: number;
}

export class FoodField {
  /** Glows, in world space (added above the scene). */
  readonly glows = new Container();
  /** Words, in screen space. */
  readonly words = new Container();
  /** Called once for every word taken in. */
  onEat: (m: Morsel) => void = () => {};
  private bits: Bit[] = [];
  private styles = new Map<string, TextStyle>();
  private time = 0;

  constructor() {
    this.glows.blendMode = 'add';
  }

  get count() {
    return this.bits.filter((b) => b.eaten < 0).length;
  }

  /** Releases words at world positions (where they stood in the thought). */
  spill(words: { word: string; x: number; y: number; size: number }[], color: number, from: { x: number; y: number }) {
    for (const w of words) {
      if (this.bits.length >= MAX) this.drop(this.bits[0]);
      const style = this.style(w.size);
      const text = new Text({ text: w.word, style, resolution: Math.min(2, window.devicePixelRatio || 1) * 1.5 });
      text.anchor.set(0.5);
      this.words.addChild(text);
      const glow = new Sprite(textures().glow);
      glow.anchor.set(0.5);
      glow.tint = color;
      glow.alpha = 0;
      glow.scale.set(0.2);
      this.glows.addChild(glow);
      // away from the middle of the thought, a breath upwards
      const dx = w.x - from.x;
      const dy = w.y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = 10 + Math.random() * 14;
      this.bits.push({
        word: w.word,
        color,
        x: w.x,
        y: w.y,
        vx: (dx / d) * push,
        vy: (dy / d) * push - 8,
        age: 0,
        eaten: -1,
        text,
        glow,
        phase: Math.random() * Math.PI * 2,
        size: w.size,
      });
    }
  }

  private style(size: number) {
    const key = size.toFixed(0);
    let s = this.styles.get(key);
    if (!s) {
      s = new TextStyle({
        fontFamily: '"Source Serif 4", Georgia, serif',
        fontSize: Math.round(size),
        fill: 0xf4ecdc,
        dropShadow: { color: 0x02040c, alpha: 0.85, blur: 6, distance: 0 },
        padding: 8,
      });
      this.styles.set(key, s);
    }
    return s;
  }

  update(dt: number, org: Organism, camera: Camera, calm: boolean) {
    this.time += dt;
    const size = org.size;
    // the mouth sits just in front of the head
    const mx = org.x + Math.cos(org.heading) * 6 * size;
    const my = org.y + Math.sin(org.heading) * 6 * size;
    const eatR = 16 + 12 * size;
    const pullR = 150 + 40 * size;
    for (const b of [...this.bits]) {
      b.age += dt;
      if (b.eaten >= 0) {
        // drawn into the mouth
        b.eaten += dt;
        const k = Math.min(1, b.eaten / 0.28);
        b.x += (org.x - b.x) * Math.min(1, dt * 14);
        b.y += (org.y - b.y) * Math.min(1, dt * 14);
        this.draw(b, camera, 1 - k, 1 - k);
        if (k >= 1) this.drop(b);
        continue;
      }
      if (b.age > LIFE) {
        this.drop(b);
        continue;
      }
      const loose = Math.min(1, Math.max(0, (b.age - SETTLE * 0.5) / SETTLE));
      // drift on a slow current
      const flow = noise.curl(b.x, b.y, 420, this.time * 0.05);
      const drift = calm ? 4 : 12;
      let ax = (flow.x * drift - b.vx) * 0.8;
      let ay = (flow.y * drift - b.vy) * 0.8;
      // drawn towards the organism: softly from afar, strongly when close
      const dx = mx - b.x;
      const dy = my - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (loose > 0) {
        const far = d < 1100 ? 26 * loose : 0;
        const near = d < pullR ? 520 * (1 - d / pullR) ** 1.5 * loose : 0;
        ax += (dx / d) * (far + near) * 0.8;
        ay += (dy / d) * (far + near) * 0.8;
      }
      b.vx += ax * dt;
      b.vy += ay * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (loose >= 1 && d < eatR) {
        b.eaten = 0;
        this.onEat({ word: b.word, color: b.color });
        continue;
      }
      const fade = Math.min(1, (LIFE - b.age) / 4);
      this.draw(b, camera, fade, 1 - 0.32 * loose);
    }
  }

  private draw(b: Bit, camera: Camera, alpha: number, scale: number) {
    const loose = Math.min(1, Math.max(0, (b.age - SETTLE * 0.5) / SETTLE));
    const shimmer = 0.85 + 0.15 * Math.sin(this.time * 2.2 + b.phase);
    const s = camera.toScreen(b.x, b.y);
    b.text.position.set(s.x, s.y);
    b.text.scale.set(scale);
    b.text.alpha = alpha * (1 - 0.18 * loose) * (b.eaten >= 0 ? 1 : shimmer);
    b.text.tint = loose > 0 ? mixWarm(b.color, loose) : 0xffffff;
    b.glow.position.set(b.x, b.y);
    b.glow.scale.set((0.16 + 0.1 * loose) * (b.size / 18) * scale / Math.max(0.35, camera.zoom));
    b.glow.alpha = alpha * loose * 0.5 * shimmer;
  }

  private drop(b: Bit) {
    b.text.destroy();
    b.glow.destroy();
    this.bits.splice(this.bits.indexOf(b), 1);
  }

  clear() {
    for (const b of [...this.bits]) this.drop(b);
  }
}

/** A word warms towards its light as it becomes food. */
function mixWarm(color: number, t: number) {
  const k = 0.35 * t;
  const r = 255 * (1 - k) + ((color >> 16) & 255) * k;
  const g = 255 * (1 - k) + ((color >> 8) & 255) * k;
  const bl = 255 * (1 - k) + (color & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
