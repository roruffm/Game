// What a ride looks like: light flowing along the thread, the words of the verse drifting beside
// it, and the words the organism caught circling it as small sparks until they arrive.

import { Container, Sprite, Text } from 'pixi.js';
import type { Camera } from '../engine/camera';
import { Stream } from '../engine/particles';
import { textures } from '../engine/textures';
import { RIDE, type PlacedWord, type Point, type ThreadPath } from './ride';

const GOLD = 0xffd98a;

interface ViewWord {
  index: number;
  s: number;
  x: number;
  y: number;
  label: Text;
  spark: Sprite;
  state: 'waiting' | 'caught' | 'missed';
  /** Seconds in the current state. */
  age: number;
  /** Where the label flies from when caught (screen). */
  fromX: number;
  fromY: number;
  orbit: number;
}

export class RideView {
  /** In world space, under the nodes. */
  readonly world = new Container();
  /** In screen space, for crisp text. */
  readonly screen = new Container();
  private stream: Stream | null;
  private words: ViewWord[] = [];
  private gatherTo: Point | null = null;
  private gatherAge = 0;
  private fading = -1;
  private time = 0;

  constructor(
    private readonly path: ThreadPath,
    color: number,
    particles: number,
    calm: boolean,
  ) {
    this.stream = calm ? null : new Stream(path.pts, Math.round(46 * particles), color, 18, 340, 0.55);
    if (this.stream) this.world.addChild(this.stream.root);
  }

  /** Lays the words out along the path. */
  setWords(texts: string[], placed: PlacedWord[]) {
    const t = textures();
    for (const w of placed) {
      const q = this.path.at(w.s);
      const x = q.x - q.ty * w.offset;
      const y = q.y + q.tx * w.offset;
      const label = new Text({
        text: texts[w.index],
        style: {
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontStyle: 'italic',
          fontSize: 18,
          fill: 0xffe8bd,
          dropShadow: { color: 0xffc061, alpha: 0.55, blur: 10, distance: 0 },
        },
        resolution: 2,
      });
      label.anchor.set(0.5);
      label.alpha = 0;
      this.screen.addChild(label);
      const spark = new Sprite(t.glow);
      spark.anchor.set(0.5);
      spark.blendMode = 'add';
      spark.tint = GOLD;
      spark.scale.set(0.3);
      spark.alpha = 0;
      spark.position.set(x, y);
      this.world.addChild(spark);
      this.words.push({ index: w.index, s: w.s, x, y, label, spark, state: 'waiting', age: 0, fromX: 0, fromY: 0, orbit: Math.random() * Math.PI * 2 });
    }
  }

  /** Per frame while riding (or fading out). Returns the indices of words caught this frame. */
  update(dt: number, cam: Camera, org: Point, progress: number): number[] {
    this.time += dt;
    const caught: number[] = [];
    if (this.stream) {
      this.stream.alpha += ((this.fading >= 0 ? 0 : 1) - this.stream.alpha) * Math.min(1, dt * 3);
      this.stream.update(dt, this.time);
    }
    if (this.fading >= 0) this.fading += dt;
    const orbiting = this.words.filter((w) => w.state === 'caught');
    for (const w of this.words) {
      w.age += dt;
      if (w.state === 'waiting') {
        const bob = Math.sin(this.time * 1.3 + w.index) * 4;
        const ahead = w.s - progress;
        // words appear as they come into reach and drift past if not caught
        const show = this.fading >= 0 ? 0 : Math.max(0, Math.min(1, (900 - ahead) / 300));
        const s = cam.toScreen(w.x, w.y + bob);
        w.label.position.set(s.x, s.y);
        w.label.visible = cam.sees(w.x, w.y, 80);
        w.label.alpha = show;
        w.spark.alpha = show * (0.35 + 0.15 * Math.sin(this.time * 2 + w.index));
        w.spark.position.set(w.x, w.y + bob);
        if (this.fading < 0 && Math.hypot(org.x - w.x, org.y - w.y - bob) < RIDE.wordReach) {
          w.state = 'caught';
          w.age = 0;
          w.fromX = s.x;
          w.fromY = s.y;
          caught.push(w.index);
        } else if (ahead < -70) {
          w.state = 'missed';
          w.age = 0;
        }
      } else if (w.state === 'missed') {
        w.label.alpha = Math.max(0, w.label.alpha - dt * 1.4);
        w.spark.alpha = Math.max(0, w.spark.alpha - dt * 1.4);
      } else {
        // the word lifts towards the organism, then lives on as a spark circling it
        const o = cam.toScreen(org.x, org.y);
        const k = Math.min(1, w.age / 0.45);
        const e = 1 - Math.pow(1 - k, 3);
        w.label.position.set(w.fromX + (o.x - w.fromX) * e, w.fromY + (o.y - 26 - w.fromY) * e);
        w.label.scale.set(1 + 0.25 * Math.sin(k * Math.PI));
        w.label.alpha = Math.max(0, 1 - Math.max(0, w.age - 0.5) / 0.6);
        const i = orbiting.indexOf(w);
        w.orbit += dt * (1.2 + (i % 3) * 0.25);
        const r = 24 + (i % 3) * 9;
        let tx = org.x + Math.cos(w.orbit) * r;
        let ty = org.y + Math.sin(w.orbit) * r * 0.8;
        if (this.gatherTo) {
          const g = Math.min(1, this.gatherAge / 0.9);
          const ge = g * g;
          tx += (this.gatherTo.x - tx) * ge;
          ty += (this.gatherTo.y - ty) * ge;
          w.spark.alpha = 0.9 * (1 - Math.max(0, g - 0.7) / 0.3);
        } else w.spark.alpha = 0.85;
        w.spark.position.set(tx, ty);
        w.spark.scale.set(0.13);
      }
    }
    if (this.gatherTo) this.gatherAge += dt;
    return caught;
  }

  /** On arrival: the caught words fly into the passage. */
  gather(at: Point) {
    this.gatherTo = at;
    this.gatherAge = 0;
    this.fading = 0;
  }

  /** When the organism leaves the current early. */
  release() {
    this.fading = 0;
  }

  /** True once everything has faded and the view can be removed. */
  get finished() {
    return this.fading > (this.gatherTo ? 1.4 : 1.2);
  }

  destroy() {
    this.world.destroy({ children: true });
    this.screen.destroy({ children: true });
  }
}
