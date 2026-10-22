// Begegnung 3: Die Emmausjünger (Lukas 24,13–35)
//
// A: a dark, winding road; fragments of the story lie at its edge, and a stranger walks with you.
// B: "Und fing an von Mose und allen Propheten" – scattered lights of scripture appear. Luke names
// no single passage, so these are the dataset's cross-references for Lk 24,27, labelled as such.
// Gathered, they begin to connect. C: at the breaking of the bread the light changes, the
// fragments become one constellation, and the stranger is gone. D: back to Jerusalem.

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { audio } from '../audio/audio';
import { BOOKS } from '../bible/books';
import { DriftField, Stream } from '../engine/particles';
import { mixColor } from '../engine/organism';
import { textures } from '../engine/textures';
import { XREF_SOURCE } from '../xref/crossrefs';
import { Beacon, EncounterScene, clamp01, lerp, type EncounterApi } from './kit';

const CONTROL = [
  { x: 0, y: 0 },
  { x: 420, y: -170 },
  { x: 820, y: 90 },
  { x: 1260, y: -110 },
  { x: 1700, y: 70 },
  { x: 2150, y: -250 },
  { x: 2520, y: -420 },
  { x: 2900, y: -560 },
];

function spline(points: { x: number; y: number }[], per = 18) {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

const PATH = spline(CONTROL);

interface Scripture {
  ref: string;
  label: string;
  text: string;
  votes: number;
  group: string;
  light: Beacon;
  tag: Text;
  attached: boolean;
  angle: number;
}

/** A small light that follows something softly. */
class Companion {
  readonly root = new Container();
  private glow: Sprite;
  private core: Sprite;
  x = 0;
  y = 0;
  alpha = 1;
  private time = Math.random() * 3;

  constructor(public color: number, size: number) {
    const t = textures();
    this.glow = new Sprite(t.glow);
    this.core = new Sprite(t.core);
    for (const s of [this.glow, this.core]) {
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.root.addChild(s);
    }
    this.glow.scale.set(size);
    this.core.scale.set(size * 0.3);
  }

  follow(dt: number, tx: number, ty: number, sharp = 2) {
    this.time += dt;
    const k = 1 - Math.exp(-dt * sharp);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.root.position.set(this.x, this.y + Math.sin(this.time * 2) * 3);
    this.glow.tint = this.color;
    this.core.tint = mixColor(this.color, 0xffffff, 0.5);
    this.root.alpha = this.alpha;
  }

  set size(s: number) {
    this.glow.scale.set(s);
    this.core.scale.set(s * 0.3);
  }
}

export class EmmausEncounter extends EncounterScene {
  private dusk!: DriftField;
  private road = new Graphics();
  private stream!: Stream;
  private lines = new Graphics();
  private friend = new Companion(0xffd2b8, 0.42);
  private stranger = new Companion(0x9aa3b8, 0.5);
  private village = new Companion(0xffc070, 1.1);
  private fragments: { at: number; verses: [number, number]; beacon: Beacon }[] = [];
  private scripture: Scripture[] = [];
  private scriptureReady: Promise<void> = Promise.resolve();
  private progress = 0;
  private strangerShown = false;
  private rest = 0;
  private recognised = 0;
  private steps = new Set<string>();
  private dawn = 0;

  constructor(api: EncounterApi) {
    super(api);
    this.bounds = { x: -700, y: -1200, w: 4300, h: 1900 };
    this.cameraZoom = 0.85;
  }

  protected start() {
    const q = this.game.quality.particles;
    this.game.nebulaColors = [0x2a1d3c, 0x1a1530, 0x3a2030];
    this.game.nebulaStrength = 0.35;
    this.dusk = new DriftField({ count: Math.round(420 * q), colors: [0x8a7aa8, 0xffb08a, 0x5a6a9a], scale: [0.3, 0.9], alpha: [0.1, 0.4], speed: 10, eddy: 320 });
    this.dusk.scatter(this.bounds);
    this.road.blendMode = 'add';
    this.lines.blendMode = 'add';
    this.stream = new Stream(PATH, Math.round(70 * q), 0xffd2b8, 18, 40, 0.5);
    this.stream.alpha = 0.35;
    this.back.addChild(this.dusk.root, this.road, this.stream.root, this.lines);
    const end = PATH[PATH.length - 1];
    this.village.x = end.x + 80;
    this.village.y = end.y - 40;
    this.village.alpha = 0.6;
    this.stranger.alpha = 0;
    this.front.addChild(this.village.root, this.friend.root, this.stranger.root);

    const beats: [number, number, number][] = [
      [0.08, 14, 14],
      [0.17, 15, 15],
      [0.26, 16, 16],
      [0.35, 17, 17],
      [0.45, 19, 20],
      [0.55, 21, 21],
    ];
    for (const [at, a, z] of beats) {
      const p = this.pointAt(at);
      const side = (Math.round(at * 100) % 2 ? 1 : -1) * 90;
      const b = new Beacon(p.x, p.y + side, 0xffd2b8, 95);
      this.fragments.push({ at, verses: [a, z], beacon: b });
      this.front.addChild(b.root);
    }

    this.org.place(40, 30);
    this.org.color = 0xffd2b8;
    this.org.accent = 0xffffff;
    this.org.vitality = 0.85;
    this.friend.x = 0;
    this.friend.y = 60;
    audio.setMood('path', 2);
    this.say(13);
    this.hint('Geh den Weg nach Emmaus. Am Rand liegen Bruchstücke der Geschichte.');
    this.scriptureReady = this.loadScripture();
  }

  /** The dataset's cross-references from Lk 24,27 into the Old Testament. */
  private async loadScripture() {
    const { bible, xrefs } = this.api;
    const from = bible.range('LUK 24:27');
    const links = (await xrefs.from(from, 4)).filter((l) => BOOKS[bible.ref(l.start).b].t === 'OT').slice(0, 8);
    const ahead = [0.66, 0.7, 0.74, 0.78, 0.82, 0.86, 0.9, 0.94];
    for (const [i, l] of links.entries()) {
      const range = { start: l.start, end: l.end };
      const book = BOOKS[bible.ref(l.start).b];
      const group = book.group === 'law' ? 'Mose' : book.group === 'prophets' ? 'Propheten' : 'Schriften';
      const text = await bible.text({ start: l.start, end: Math.min(l.end, l.start + 1) });
      const p = this.pointAt(ahead[i % ahead.length]);
      const side = (i % 2 ? 1 : -1) * (110 + (i % 3) * 30);
      const light = new Beacon(p.x, p.y + side, 0xffe2a8, 85);
      light.active = false;
      const tag = new Text({
        text: bible.format(range, 'short'),
        style: { fontFamily: 'Albert Sans, sans-serif', fontSize: 15, fill: 0xffe2a8, dropShadow: { color: 0x000000, alpha: 0.8, blur: 4, distance: 0 } },
        resolution: 2,
      });
      tag.anchor.set(0.5, 0);
      tag.alpha = 0;
      this.front.addChild(light.root, tag);
      this.scripture.push({ ref: bible.format(range), label: group, text, votes: l.votes, group, light, tag, attached: false, angle: (i / links.length) * Math.PI * 2 });
    }
  }

  private pointAt(k: number) {
    const i = Math.min(PATH.length - 1, Math.max(0, Math.round(k * (PATH.length - 1))));
    return PATH[i];
  }

  /** How far along the road the organism is, 0–1. */
  private measure() {
    let best = 0;
    let bestD = Infinity;
    PATH.forEach((p, i) => {
      const d = Math.hypot(p.x - this.org.x, p.y - this.org.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best / (PATH.length - 1);
  }

  objective() {
    if (this.phase === 0) {
      const f = this.fragments.find((x) => !x.beacon.revealed);
      return f ? { x: f.beacon.x, y: f.beacon.y } : this.pointAt(0.66);
    }
    if (this.phase === 1) {
      const s = this.scripture.find((x) => !x.attached && x.light.active);
      if (s && this.scripture.filter((x) => x.attached).length < 4) return { x: s.light.x, y: s.light.y };
      return this.pointAt(0.99);
    }
    if (this.phase === 2) return { x: this.village.x, y: this.village.y };
    if (this.phase === 3) return this.pointAt(0.02);
    return null;
  }

  private once(name: string, run: () => void) {
    if (this.steps.has(name)) return;
    this.steps.add(name);
    run();
  }

  protected current(x: number, y: number) {
    if (this.phase !== 3) return { x: 0, y: 0 };
    // on the way back the road itself carries you
    let best = PATH[0];
    let idx = 0;
    let bestD = Infinity;
    PATH.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
        idx = i;
      }
    });
    const prev = PATH[Math.max(0, idx - 3)];
    const dx = prev.x - best.x;
    const dy = prev.y - best.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: (dx / l) * 120, y: (dy / l) * 120 };
  }

  protected step(dt: number) {
    this.progress = this.measure();
    this.dusk.update(dt, this.bounds);
    this.stream.update(dt, this.t);
    this.drawRoad();
    // the friend walks beside you, the stranger a little ahead
    this.friend.follow(dt, this.org.x - 30, this.org.y + 50, 1.6);
    if (this.strangerShown && this.recognised < 1) {
      this.stranger.alpha = Math.min(0.85, this.stranger.alpha + dt * 0.3);
      const ahead = this.pointAt(Math.min(1, this.progress + 0.025));
      this.stranger.follow(dt, (ahead.x + this.org.x) / 2 + 20, (ahead.y + this.org.y) / 2 - 50, 1.3);
    } else if (this.recognised >= 1) {
      this.stranger.follow(dt, this.stranger.x, this.stranger.y);
    }
    this.village.follow(dt, this.village.x, this.village.y);

    if (this.phase === 0) {
      for (const f of this.fragments) {
        if (f.beacon.update(dt, this.org.x, this.org.y)) {
          this.say(f.verses[0], f.verses[1]);
          if (f.verses[0] === 15) this.strangerShown = true;
        }
      }
      if (this.progress > 0.6) this.once('B', () => this.understand());
    } else if (this.phase === 1) {
      for (const f of this.fragments) f.beacon.update(dt, this.org.x, this.org.y);
      this.updateScripture(dt);
      const gathered = this.scripture.filter((s) => s.attached).length;
      if (this.progress > 0.96 && (gathered >= Math.min(4, this.scripture.length) || this.phaseTime > 90)) this.once('C', () => this.arrive());
    } else if (this.phase === 2) {
      this.updateScripture(dt);
      const d = Math.hypot(this.org.x - this.village.x, this.org.y - this.village.y);
      if (d < 220) this.rest += dt;
      if (this.rest > 2.5) this.once('bread', () => this.breakBread());
      if (this.recognised > 0) {
        this.recognised = Math.min(2, this.recognised + dt / 3);
        this.dawn = clamp01(this.dawn + dt / 4);
        this.stranger.color = mixColor(0x9aa3b8, 0xfff1c9, clamp01(this.recognised));
        this.stranger.size = lerp(0.5, 1.4, clamp01(this.recognised));
        if (this.recognised > 1.3) this.stranger.alpha = Math.max(0, this.stranger.alpha - dt * 0.8);
      }
    } else if (this.phase === 3) {
      this.updateScripture(dt);
      if (this.progress < 0.04) this.once('end', () => {
        this.say(34, 35);
        this.hint(null);
        this.later(9, () => this.complete());
      });
    }
    this.game.nebulaStrength = lerp(0.3, 0.6, this.dawn);
    this.stream.alpha = lerp(0.35, 0.9, this.dawn);
  }

  private async understand() {
    this.setPhase(1);
    this.say(25, 26);
    this.later(6, () => {
      this.say(27);
      this.hint('Lichter der Schrift erscheinen. Lukas nennt keine einzelnen Stellen – diese stammen aus dem Querverweis-Datensatz.');
    });
    await this.scriptureReady;
    this.later(6.5, () => this.scripture.forEach((s) => (s.light.active = true)));
  }

  private updateScripture(dt: number) {
    const attached = this.scripture.filter((s) => s.attached);
    const centre = this.recognised > 0 ? { x: this.village.x, y: this.village.y - 40 } : { x: this.stranger.x, y: this.stranger.y };
    for (const s of this.scripture) {
      if (!s.attached && s.light.active && s.light.update(dt, this.org.x, this.org.y)) {
        s.attached = true;
        audio.chime('thread');
        this.pushBeat({
          ref: s.ref,
          label: `${s.ref} · ${s.group} · Querverweis zu Lukas 24,27 (${XREF_SOURCE.name}, ${s.votes} Stimmen)`,
          text: s.text,
          kind: 'datensatz',
        });
      } else if (!s.attached) s.light.update(dt, -1e9, -1e9);
      if (s.attached) {
        // gathered lights circle the stranger, and later the table at Emmaus
        s.angle += dt * 0.3;
        const r = this.recognised > 0 ? 260 : 120;
        const tx = centre.x + Math.cos(s.angle) * r;
        const ty = centre.y + Math.sin(s.angle) * r * 0.75;
        s.light.x = lerp(s.light.x, tx, dt * 1.5);
        s.light.y = lerp(s.light.y, ty, dt * 1.5);
        s.light.root.alpha = Math.max(s.light.root.alpha, 0.8);
      }
      s.tag.position.set(s.light.x, s.light.y + 26);
      s.tag.alpha = lerp(s.tag.alpha, s.light.active ? (s.attached ? 0.8 : 1) : 0, dt * 2);
    }
    const g = this.lines;
    g.clear();
    if (attached.length < 2) return;
    const full = this.recognised > 0.3;
    attached.forEach((a, i) => {
      const next = attached[(i + 1) % attached.length];
      g.moveTo(a.light.x, a.light.y).lineTo(next.light.x, next.light.y);
      if (full) {
        for (const b of attached) if (b !== a) g.moveTo(a.light.x, a.light.y).lineTo(b.light.x, b.light.y);
      }
    });
    g.stroke({ width: full ? 1.6 : 1.2, color: 0xffe2a8, alpha: full ? 0.35 + 0.2 * this.dawn : 0.25 });
  }

  private arrive() {
    this.setPhase(2);
    this.say(28, 29);
    this.hint('Bleib bei ihnen.');
    audio.setMood('home', 4);
  }

  private breakBread() {
    this.say(30);
    this.hint(null);
    this.steeringLocked = true;
    this.later(4, () => {
      this.recognised = 0.01;
      audio.setMood('reveal', 3);
      audio.chime('reveal');
      this.say(31);
    });
    this.later(11, () => this.say(32));
    this.later(17, () => {
      this.steeringLocked = false;
      this.setPhase(3);
      this.say(33);
      this.hint('Der Weg zurück nach Jerusalem leuchtet.');
    });
  }

  private drawRoad() {
    const g = this.road;
    g.clear();
    const color = this.phase === 3 ? 0xffd98a : 0xbfa8d8;
    const alpha = this.phase === 3 ? 0.35 : 0.12;
    g.moveTo(PATH[0].x, PATH[0].y);
    for (const p of PATH) g.lineTo(p.x, p.y);
    g.stroke({ width: 26, color, alpha: alpha * 0.4, cap: 'round', join: 'round' });
    g.moveTo(PATH[0].x, PATH[0].y);
    for (const p of PATH) g.lineTo(p.x, p.y);
    g.stroke({ width: 3, color, alpha, cap: 'round', join: 'round' });
  }
}
