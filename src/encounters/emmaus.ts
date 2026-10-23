// Begegnung 3: Die Emmausjünger (Lukas 24,13–35)
//
// A: Jerusalem's lights behind you, a dark, winding road ahead. Two of them talk as they walk;
// a stranger joins them, veiled to their eyes. Fragments of the story lie at the road's edge,
// and what the two tell him rises beside the road as faint images: the prophet among the
// people, the three days, the empty tomb. B: "Und fing an von Mose und allen Propheten" –
// scattered lights of scripture appear. Luke names no single passage, so these are the
// dataset's cross-references for Lk 24,27, labelled as such. Gathered, they begin to connect.
// C: evening at Emmaus; the windows light up. He makes as if to go on; you ask him to stay. At
// the table he takes the bread, gives thanks, breaks it – the light changes, the fragments
// become one constellation, he is gone, and their hearts burn. D: back to Jerusalem by night,
// where the eleven are gathered.

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { audio } from '../audio/audio';
import { BOOKS } from '../bible/books';
import { DriftField, Stream } from '../engine/particles';
import { mixColor } from '../engine/organism';
import { textures } from '../engine/textures';
import { XREF_SOURCE } from '../xref/crossrefs';
import { Beacon, EncounterScene, clamp01, lerp, type EncounterApi } from './kit';
import { Flames, Loaf, Swarm, Town, Vision, ease, light } from './props';

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
  private jerusalem = new Town(-330, -40, 360, 80);
  private emmaus!: Town;
  private eleven = new Swarm(14, [0xfff1c9, 0xffe2a8, 0xffd2b8], 0.36, 85);
  private veil!: Sprite;
  private visions: Vision[] = [];
  private shownVisions = 0;
  private talk: Sprite[] = [];
  private talking = 0;
  private sorrow = 0;
  private invited = false;
  private table = new Graphics();
  private loaf: Loaf | null = null;
  private hearts = new Flames(70);
  private evening = 0;

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
      [0.07, 14, 14],
      [0.15, 15, 15],
      [0.23, 16, 16],
      [0.31, 17, 17],
      [0.4, 19, 20],
      [0.49, 21, 21],
      [0.57, 22, 24],
    ];
    for (const [at, a, z] of beats) {
      const p = this.pointAt(at);
      const side = (Math.round(at * 100) % 2 ? 1 : -1) * 90;
      const b = new Beacon(p.x, p.y + side, 0xffd2b8, 95);
      this.fragments.push({ at, verses: [a, z], beacon: b });
      this.front.addChild(b.root);
    }

    // Jerusalem behind them; at Emmaus, a few windows; the eleven, later, back in Jerusalem
    this.emmaus = new Town(end.x + 80, end.y - 10, 220, 26, 0xffc070);
    this.emmaus.shown = 0;
    this.eleven.place(-210, 40);
    this.eleven.shown = 0;
    const t = textures();
    // "ihre Augen wurden gehalten": a grey haze about the stranger
    this.veil = light(t.glow, 1.3, 0x9aa3b8, 0, this.front);
    for (let i = 0; i < 6; i++) this.talk.push(light(t.dot, 0.5, i % 2 ? 0xffd2b8 : 0xfff1c9, 0, this.front));
    this.table.blendMode = 'add';
    this.back.addChild(this.jerusalem.root, this.emmaus.root, this.table);
    this.front.addChild(this.eleven.root, this.hearts.root);
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
    if (this.phase === 2) return this.invited || !this.heard(28) ? { x: this.village.x, y: this.village.y } : { x: this.stranger.x, y: this.stranger.y };
    if (this.phase === 3) return this.pointAt(0.02);
    return null;
  }

  detail() {
    return {
      visions: this.shownVisions,
      invited: this.invited ? 1 : 0,
      broken: this.loaf?.broken ?? 0,
      recognised: Math.min(1, this.recognised),
      burning: this.hearts.intensity,
      eleven: this.eleven.shown,
    };
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
    if (this.strangerShown && this.recognised < 1 && !(this.phase === 2 && this.heard(28))) {
      this.stranger.alpha = Math.min(0.85, this.stranger.alpha + dt * 0.3);
      const ahead = this.pointAt(Math.min(1, this.progress + 0.025));
      this.stranger.follow(dt, (ahead.x + this.org.x) / 2 + 20, (ahead.y + this.org.y) / 2 - 50, 1.3);
    } else if (this.recognised >= 1) {
      this.stranger.follow(dt, this.stranger.x, this.stranger.y);
    }
    this.village.follow(dt, this.village.x, this.village.y);

    this.updateScenery(dt);
    if (this.phase === 0) {
      for (const f of this.fragments) {
        if (f.beacon.update(dt, this.org.x, this.org.y)) {
          this.say(f.verses[0], f.verses[1]);
          if (f.verses[0] === 15) this.strangerShown = true;
        }
      }
      // what they tell rises beside the road while it is shown
      if (this.heard(14)) this.once('talk', () => (this.talking = 10));
      if (this.heard(17)) this.once('sad', () => (this.sorrow = 0.01));
      if (this.heard(19)) this.once('prophet', () => this.addVision(this.prophetVision()));
      if (this.heard(21)) this.once('days', () => this.addVision(this.daysVision()));
      if (this.heard(22)) this.once('tomb', () => this.addVision(this.tombVision()));
      if (this.progress > 0.62 && this.settled) this.once('B', () => this.understand());
    } else if (this.phase === 1) {
      for (const f of this.fragments) f.beacon.update(dt, this.org.x, this.org.y);
      this.updateScripture(dt);
      const gathered = this.scripture.filter((s) => s.attached).length;
      if (this.progress > 0.96 && this.settled && (gathered >= Math.min(4, this.scripture.length) || this.phaseTime > 90)) this.once('C', () => this.arrive());
    } else if (this.phase === 2) {
      this.updateScripture(dt);
      // "er stellte sich, als wollte er weiter gehen" – until you ask him to stay
      if (this.heard(28) && !this.invited) {
        const away = this.pointAt(1);
        this.stranger.follow(dt, away.x + 260, away.y - 120, 0.5);
        if (Math.hypot(this.org.x - this.stranger.x, this.org.y - this.stranger.y) < 110) {
          this.invited = true;
          this.say(29);
          this.hint('Er bleibt bei ihnen.');
        }
      } else if (this.invited && this.recognised === 0) this.stranger.follow(dt, this.village.x - 60, this.village.y + 10, 1.2);
      const d = Math.hypot(this.org.x - this.village.x, this.org.y - this.village.y);
      if (this.invited && this.heard(29) && d < 220) this.rest += dt;
      if (this.rest > 2.5 && this.settled) this.once('bread', () => this.breakBread());
      // Lk 24,30–32: he takes the bread, gives thanks, breaks it, gives it to them
      if (this.heard(30)) this.once('bless', () => {
        this.loaf?.bless();
        this.later(2, () => this.loaf?.break());
        this.later(4, () => {
          if (this.loaf) this.loaf.givenTo = [this.friend, this.org];
        });
      });
      if (this.heard(32)) this.hearts.intensity = Math.max(this.hearts.intensity, 1);
      if (this.recognised > 0) {
        this.recognised = Math.min(2, this.recognised + dt / 3);
        this.dawn = clamp01(this.dawn + dt / 4);
        this.stranger.color = mixColor(0x9aa3b8, 0xfff1c9, clamp01(this.recognised));
        this.stranger.size = lerp(0.5, 1.4, clamp01(this.recognised));
        if (this.recognised > 1.3) this.stranger.alpha = Math.max(0, this.stranger.alpha - dt * 0.8);
      }
    } else if (this.phase === 3) {
      this.updateScripture(dt);
      // Jerusalem by night: the eleven are gathered, and those with them
      this.eleven.shown = 1;
      if (this.progress < 0.04) this.once('end', () => {
        this.say(34, 35);
        this.hint(null);
      });
      if (this.heard(34)) this.eleven.glee = 1;
      if (this.heard(34) && this.settled) this.once('done', () => this.later(4, () => this.complete()));
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
    this.say(28);
    this.hint('Er stellt sich, als wolle er weitergehen. Bitte ihn zu bleiben: Geh zu ihm.');
    audio.setMood('home', 4);
  }

  private breakBread() {
    this.say(30);
    this.hint(null);
    this.steeringLocked = true;
    // the table in the house, and the bread on it
    const v = this.village;
    this.table.clear();
    this.table.roundRect(v.x - 120, v.y + 40, 240, 26, 13).fill({ color: 0xffb35a, alpha: 0.12 }).stroke({ width: 2, color: 0xffc070, alpha: 0.35 });
    this.loaf = new Loaf(v.x, v.y + 30);
    this.front.addChild(this.loaf.root);
    this.later(9, () => {
      this.recognised = 0.01;
      audio.setMood('reveal', 3);
      audio.chime('reveal');
      this.say(31);
    });
    this.later(16, () => this.say(32));
    this.later(24, () => {
      this.steeringLocked = false;
      this.setPhase(3);
      this.say(33);
      this.hint('Der Weg zurück nach Jerusalem leuchtet.');
    });
  }

  // ── what the road shows ─────────────────────────────────────────────

  private updateScenery(dt: number) {
    this.jerusalem.update(dt);
    this.emmaus.update(dt);
    this.eleven.x = -210;
    this.eleven.update(dt);
    // the evening comes as they near Emmaus; the windows light up
    this.evening = ease(this.evening, this.phase >= 2 ? 1 : this.progress > 0.8 ? 0.5 : 0, 0.3, dt);
    this.emmaus.shown = this.phase >= 2 ? 1 : this.progress > 0.75 ? 0.4 : 0;
    // Jerusalem stays behind, then lights the way home at night
    this.jerusalem.shown = this.phase === 3 ? 1 : lerp(0.9, 0.35, clamp01(this.progress * 3));
    // the two talk as they walk: small lights pass between them
    this.talking = Math.max(0, this.talking - dt);
    this.talk.forEach((s, i) => {
      const k = (this.t * 0.6 + i / this.talk.length) % 1;
      const dir = i % 2 ? k : 1 - k;
      s.position.set(lerp(this.org.x, this.friend.x, dir), lerp(this.org.y, this.friend.y, dir) - Math.sin(dir * Math.PI) * 18);
      s.alpha = Math.min(1, this.talking / 2) * 0.8 * Math.sin(dir * Math.PI);
    });
    // "und seid traurig": their light dims until the scriptures are opened to them
    if (this.sorrow > 0 && this.phase === 0) this.sorrow = Math.min(1, this.sorrow + dt / 3);
    if (this.phase >= 1) this.sorrow = Math.max(0, this.sorrow - dt / 20);
    this.org.vitality = (0.85 - 0.25 * this.sorrow) * (1 + 0.25 * this.hearts.intensity);
    this.friend.color = mixColor(0xffd2b8, 0x8f9dc0, this.sorrow * 0.6);
    // the haze over the stranger lifts when they recognise him
    this.veil.position.set(this.stranger.x, this.stranger.y);
    this.veil.alpha = this.stranger.alpha * 0.28 * (1 - clamp01(this.recognised * 2));
    this.veil.scale.set(1.3 + Math.sin(this.t * 0.7) * 0.08);
    // burning hearts
    if (this.hearts.intensity > 0 && this.phase >= 2) this.hearts.intensity = Math.max(0, this.hearts.intensity - dt / 14);
    this.hearts.update(dt, [
      { x: this.org.x, y: this.org.y - 6 },
      { x: this.friend.x, y: this.friend.y - 6 },
    ]);
    this.loaf?.update(dt);
    this.table.alpha = ease(this.table.alpha, this.phase === 2 ? 1 : 0, 1, dt);
    this.visions = this.visions.filter((v) => {
      if (v.update(dt)) return true;
      v.root.destroy({ children: true });
      return false;
    });
  }

  private addVision(v: Vision) {
    this.visions.push(v);
    this.shownVisions++;
    this.back.addChild(v.root);
  }

  /** Where an image of what they tell can rise: beside the road, a little ahead. */
  private visionSpot() {
    // ahead, below the road, where the way is free of the verse beside you
    const p = this.pointAt(Math.min(1, this.progress + 0.045));
    return { x: p.x + 60, y: p.y + 200 };
  }

  /** Lk 24,19–20: a prophet mighty in deed and word before all the people – then delivered up. */
  private prophetVision() {
    const at = this.visionSpot();
    const v = new Vision(at.x, at.y, 11, 1);
    const t = textures();
    const centre = light(t.glow, 0.7, 0xfff1c9, 0.9, v.root);
    const people = new Swarm(16, [0xffd2b8, 0xffe2a8, 0xcfd6ff], 0.28, 120);
    people.place(0, 30);
    v.root.addChild(people.root);
    v.animate = (age, dt) => {
      people.update(dt);
      // the people scatter, the light goes faint, and a cross is left
      if (age > 5) {
        people.mode = 'scatter';
        people.shown = 0;
        centre.alpha = Math.max(0.15, centre.alpha - dt * 0.4);
      }
      const k = clamp01((age - 6) / 2);
      v.g.clear();
      if (k > 0) {
        v.g.moveTo(0, -70).lineTo(0, 70).stroke({ width: 3, color: 0xcfd6ff, alpha: 0.4 * k });
        v.g.moveTo(-38, -30).lineTo(38, -30).stroke({ width: 3, color: 0xcfd6ff, alpha: 0.4 * k });
      }
    };
    return v;
  }

  /** Lk 24,21: "heute der dritte Tag". */
  private daysVision() {
    const at = this.visionSpot();
    const v = new Vision(at.x, at.y, 9, 1);
    const t = textures();
    const days = [0, 1, 2].map((i) => {
      const s = light(t.core, 0.3, i === 2 ? 0xffe2a8 : 0x9aa3b8, 0.6, v.root);
      s.position.set(-90 + i * 90, 0);
      return s;
    });
    v.animate = (age) => {
      const third = days[2];
      third.scale.set(0.3 + 0.12 * clamp01((age - 3) / 4) * (1 + 0.15 * Math.sin(age * 3)));
      third.alpha = 0.6 + 0.4 * clamp01((age - 3) / 4);
    };
    return v;
  }

  /** Lk 24,22–24: the women early at the tomb; they did not find his body; "er lebe". */
  private tombVision() {
    const at = this.visionSpot();
    const v = new Vision(at.x, at.y, 12, 1);
    const t = textures();
    // the opening of the tomb, the stone rolled aside, light within
    v.g.moveTo(-60, 40).lineTo(-60, -10).arc(0, -10, 60, Math.PI, 0).lineTo(60, 40).stroke({ width: 3, color: 0xcfd6ff, alpha: 0.35 });
    const inside = light(t.glow, 0.7, 0xfff1c9, 0.5, v.root);
    inside.position.set(0, 8);
    const stone = light(t.ring, 0.42, 0xcfd6ff, 0.55, v.root);
    stone.position.set(105, 16);
    const women = new Swarm(4, [0xffd2b8, 0xffe2a8], 0.3, 40);
    women.place(-150, 30);
    v.root.addChild(women.root);
    v.animate = (age, dt) => {
      // they come early, find it empty, and go to tell the others
      women.x = age < 5 ? lerp(-150, -95, clamp01(age / 4)) : lerp(-95, -230, clamp01((age - 6) / 4));
      women.update(dt);
      inside.alpha = 0.4 + 0.2 * Math.sin(age * 1.4);
    };
    return v;
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
