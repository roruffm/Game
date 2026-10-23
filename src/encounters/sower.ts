// Begegnung: Vom Sämann (Lukas 8,4–15) – a dive, in the manner of flOw.
//
// The parable is a stack of layers, one beneath the other; the next one always shimmers below
// you. A warm light leads down, a cool light back up, and you go when you choose. Each layer
// is one of the grounds the seed falls on, and its rule is what the parable says of it:
//
//   0  Das Volk       the crowd gathers; above, a sower walks and casts his seed into the depth
//   1  Der Weg        seeds lie on the path; birds come down for them (and for what you carry)
//   2  Der Fels       seeds spring up at once and wither as quickly: catch them while they last
//   3  Die Dornen     thorns grow up round each seed and close in: slip through their gaps;
//                     a thorn that catches you costs a seed you carry, or carries you up a layer
//   4  Gutes Land     what falls here, and what you sow by gliding slowly, grows and bears
//                     fruit a hundredfold – the fruit is food
//   5  Der Grund      "Der Same ist das Wort Gottes": the grounds light up as Jesus explains
//                     them; then the last verse returns with gaps, and you find its words
//
// The seeds are the meaningful words of the verses (keyWords); catching one takes it in, like
// the words of a thought. Nothing is lost for good, and nothing is counted on screen.

import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { audio } from '../audio/audio';
import { mixColor } from '../engine/organism';
import { DriftField } from '../engine/particles';
import { textures } from '../engine/textures';
import { keyWords } from '../state/reading';
import { EncounterScene, Shockwave, clamp01, lerp, type EncounterApi } from './kit';
import { Bird, DepthLight, Swarm, ease, light } from './props';

const B = { x: -1100, y: -700, w: 2200, h: 1400 };
const GOLD = 0xffe2a8;
const SEED = 0xfff1c9;

/** How each layer looks, and the verse it begins with. */
const LAYERS = [
  { verse: 4, nebula: [0x1b3a5a, 0x3a2a4a, 0x2a4a4a], ground: 0xffd2a0 },
  { verse: 5, nebula: [0x4a3a1a, 0x3a2a1a, 0x2a2a3a], ground: 0xd9b98a },
  { verse: 6, nebula: [0x24324a, 0x1a2a3a, 0x2a3040], ground: 0x9fb0c8 },
  { verse: 7, nebula: [0x2a1a3a, 0x1a1028, 0x301a30], ground: 0x8a5a9a },
  { verse: 8, nebula: [0x3a2410, 0x2a1a0a, 0x34280e], ground: 0xc08a4a },
  { verse: 9, nebula: [0x0d0a2a, 0x14103a, 0x1a1030], ground: 0xffd98a },
] as const;

/** How many seeds (or fruits) a layer asks for before its warm light appears; after a while it appears anyway. */
const GOALS = [0, 5, 5, 3, 30, 0];
const PATIENCE = 45;

/** Lk 8,15 – the words that are missing when the verse returns, and words that do not belong. */
const GAPS = ['Wort', 'hören', 'behalten', 'Herzen', 'Frucht', 'Geduld'];
const DECOYS = ['Vögel', 'Fels', 'Dornen', 'Sorgen', 'Reichtum', 'Wurzel'];

const seedFont = {
  fontFamily: '"Source Serif 4", Georgia, serif',
  fontSize: 19,
  fill: SEED,
  dropShadow: { color: 0x02040c, alpha: 0.9, blur: 6, distance: 0 },
  padding: 8,
};
const seedStyle = new TextStyle(seedFont);

type SeedState = 'falling' | 'lying' | 'trodden' | 'taken' | 'withered' | 'choked' | 'caught' | 'growing';

class Seed {
  readonly root = new Container();
  readonly text: Text;
  readonly glow: Sprite;
  state: SeedState = 'falling';
  /** Seconds in the current state. */
  t = 0;
  private fall = 0;

  constructor(
    readonly word: string,
    public x: number,
    public y: number,
  ) {
    this.glow = light(textures().core, 0.16, GOLD, 0.95, this.root);
    this.text = new Text({ text: word, style: seedStyle, resolution: 2 });
    this.text.anchor.set(0.5, 1);
    this.text.y = -10;
    this.root.addChild(this.text);
    this.root.position.set(x, y);
    this.root.alpha = 0;
  }

  set(state: SeedState) {
    this.state = state;
    this.t = 0;
  }

  /** It falls from the layer above: large and faint at first, settling where it lands. */
  update(dt: number) {
    this.t += dt;
    if (this.state === 'falling') {
      this.fall = Math.min(1, this.fall + dt / 1.1);
      const k = 1 - Math.pow(1 - this.fall, 3);
      this.root.scale.set(1.9 - 0.9 * k);
      this.root.alpha = k;
      if (this.fall >= 1) this.set('lying');
    }
    this.root.position.set(this.x, this.y);
  }

  get catchable() {
    return this.state === 'lying' || (this.state === 'growing' && this.t < 3);
  }
}

class Layer {
  readonly root = new Container();
  readonly ground = new Graphics();
  readonly items = new Container();
  seeds: Seed[] = [];
  caught = 0;
  sowTime = 0;
  sowClock = 0;
  sowing = false;
  visited = false;
  down: DepthLight | null = null;
  up: DepthLight | null = null;

  constructor(readonly index: number) {
    this.ground.blendMode = 'add';
    this.root.addChild(this.ground, this.items);
  }
}

/** A thorn bush: a ring of thorns that grows up round a seed and closes in on it. */
interface Thorns {
  x: number;
  y: number;
  g: Graphics;
  seed: Seed | null;
  /** 0 open … 1 closed; the gaps turn slowly. */
  grow: number;
  turn: number;
  wait: number;
}

/** A stalk on good ground: it grows, ripens and bursts into fruit. */
interface Stalk {
  x: number;
  y: number;
  g: Graphics;
  ear: Sprite;
  t: number;
  burst: boolean;
}

interface Fruit {
  s: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
}

/** A word floating near the last verse, to be put back in its place (or not: a decoy). */
interface Candidate {
  word: string;
  text: Text;
  glow: Sprite;
  x: number;
  y: number;
  a: number;
  r: number;
  right: boolean;
  bounce: number;
  placed: boolean;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class SowerEncounter extends EncounterScene {
  private layers = LAYERS.map((_, i) => new Layer(i));
  private cur = 0;
  private deepest = 0;
  private dive: { from: number; to: number; t: number } | null = null;
  private motes!: DriftField;
  private steps = new Set<string>();
  private grains: { s: Sprite; phase: number }[] = [];
  // 0: the crowd and the sower
  private crowd = new Swarm(26, [0xffe2a8, 0xffd2b8, 0xfff1c9, 0xcfe6ff], 0.3, 170);
  private teacher!: Sprite;
  private sower = { x: -700, dir: 1, root: new Container(), arm: null as Sprite | null, clock: 0 };
  private falling: { s: Sprite; x: number; y: number; vx: number; vy: number; t: number }[] = [];
  // 1: the path
  private birds: Bird[] = [];
  private walker = { x: -900, dir: 1, s: null as Sprite | null };
  private swoopClock = 6;
  // 3: thorns
  private thorns: Thorns[] = [];
  private stungAt = -10;
  // 4: good ground
  private stalks: Stalk[] = [];
  private fruits: Fruit[] = [];
  private sowClock = 0;
  // 5: the ground of the parable
  private minis: Container[] = [];
  private groundCentre = new Container();
  private slots: { word: string; text: Text; mark: Graphics; filled: boolean }[] = [];
  private candidates: Candidate[] = [];
  private recallTime = 0;
  private recalling = false;
  /** Where the words of the last verse float, round the spot where it returned. */
  private recallAt = { x: 0, y: 0 };
  private shock: Shockwave | null = null;
  private stats = { caught: 0, stolen: 0, withered: 0, choked: 0, stings: 0, carriedUp: 0, sown: 0, fruit: 0, recalled: 0 };

  constructor(api: EncounterApi) {
    super(api);
    this.bounds = B;
    this.cameraZoom = 0.85;
  }

  protected start() {
    const q = this.game.quality.particles;
    this.motes = new DriftField({ count: Math.round(420 * q), colors: [0xffe2a8, 0xcfe6ff, 0xb8e07a], scale: [0.3, 0.9], alpha: [0.1, 0.4], speed: 10, eddy: 320 });
    this.motes.scatter(B);
    this.back.addChild(this.motes.root);
    // deepest first, so the layers above are drawn over the ones below
    for (const l of [...this.layers].reverse()) this.back.addChild(l.root);
    this.buildCrowd();
    this.buildPath();
    this.buildRock();
    this.buildThorns();
    this.buildLand();
    this.buildGround();
    this.org.place(80, 180);
    this.org.color = 0xb8e07a;
    this.org.accent = 0xffffff;
    this.org.vitality = 1;
    audio.setMood('path', 2);
    this.enterLayer(0);
  }

  objective() {
    if (this.dive) return null;
    const l = this.layers[this.cur];
    if (l.down) return { x: l.down.x, y: l.down.y };
    if (this.cur >= 1 && this.cur <= 3) {
      const s = this.nearestSeed(l);
      if (!s) return null;
      // into a thorn ring through one of its gaps
      const th = this.thorns.find((x) => x.seed === s);
      if (this.cur === 3 && th && th.grow > 0.3) {
        const r = this.ringRadius(th);
        const a = Math.atan2(this.org.y - th.y, this.org.x - th.x);
        const gaps = [th.turn, th.turn + Math.PI];
        const gap = gaps.reduce((g, b) => (angleTo(a, b) < angleTo(a, g) ? b : g));
        if (this.dist(th) > r && angleTo(a, gap) > 0.25) return { x: th.x + Math.cos(gap) * (r + 60), y: th.y + Math.sin(gap) * (r + 60) };
      }
      return { x: s.x, y: s.y };
    }
    if (this.cur === 4) {
      const f = this.fruits.reduce<Fruit | null>((a, b) => (!a || this.dist(b) < this.dist(a) ? b : a), null);
      if (f) return { x: f.x, y: f.y };
      const s = this.stalks.find((x) => !x.burst);
      return s ? { x: s.x, y: s.y } : null;
    }
    if (this.cur === 5 && this.recalling) {
      const c = this.candidates.filter((x) => x.right && !x.placed).sort((a, b) => this.dist(a) - this.dist(b))[0];
      return c ? { x: c.x, y: c.y } : null;
    }
    return null;
  }

  detail() {
    return { layer: this.cur, deepest: this.deepest, ...this.stats };
  }

  private dist(p: { x: number; y: number }) {
    return Math.hypot(p.x - this.org.x, p.y - this.org.y);
  }

  private once(name: string, run: () => void) {
    if (this.steps.has(name)) return;
    this.steps.add(name);
    run();
  }

  // ── the dive ─────────────────────────────────────────────────────────

  private enterLayer(i: number) {
    const l = this.layers[i];
    this.game.nebulaColors = [...LAYERS[i].nebula];
    audio.setMood(i >= 5 ? 'calm' : i >= 2 ? 'deep' : 'path', 2.5);
    if (i > 0 && !l.up) {
      // in a corner, out of the way: going up is a choice, not an accident
      l.up = new DepthLight(B.x + 200, B.y + 170, 'up');
      l.root.addChild(l.up.root);
    }
    if (l.visited) return;
    l.visited = true;
    // the grounds of the explanation gather round where you arrive
    if (i === 5) this.groundCentre.position.set(clampX(this.org.x), clampY(this.org.y));
    if (i < 5) this.say(LAYERS[i].verse);
    else this.say(9, 10);
    const hints = [
      'Ein Gleichnis. Das warme Licht führt hinab, in die Tiefe.',
      'Fang die Samen, bevor die Vögel sie holen. Wer auf sie zuschwimmt, verscheucht sie.',
      'Auf dem Fels geht die Saat sofort auf und verdorrt ebenso schnell.',
      'Schlüpf durch die Lücken der Dornen, bevor sie sich schließen.',
      'Gleite langsam über das gute Land: Was du trägst, fällt hinein und trägt Frucht.',
      'Der Grund des Gleichnisses. Hier deutet Jesus es selbst.',
    ];
    this.hint(hints[i]);
    if (i === 1) this.later(4, () => this.once('upHint', () => this.hint('Das kühle Licht führt wieder hinauf, wann immer du willst.')));
  }

  /** Down (+1) or up (−1) one layer. */
  private go(dir: 1 | -1) {
    if (this.dive) return;
    const to = this.cur + dir;
    if (to < 0 || to >= this.layers.length) return;
    this.dive = { from: this.cur, to, t: 0 };
    this.steeringLocked = true;
    this.later(0.8, () => (this.steeringLocked = false));
    audio.chime(dir > 0 ? 'enter' : 'thread');
  }

  /** Where every layer sits: the current one in front, the next shimmering small below, the one above passing overhead. */
  private placeLayers(dt: number) {
    let at = this.cur;
    if (this.dive) {
      this.dive.t = Math.min(1, this.dive.t + dt / 1.8);
      const k = this.dive.t < 0.5 ? 2 * this.dive.t * this.dive.t : 1 - Math.pow(-2 * this.dive.t + 2, 2) / 2;
      at = lerp(this.dive.from, this.dive.to, k);
      if (this.dive.t >= 1) {
        this.cur = this.dive.to;
        this.deepest = Math.max(this.deepest, this.cur);
        this.dive = null;
        this.setPhase(this.cur);
        this.enterLayer(this.cur);
        at = this.cur;
      }
    }
    const cam = this.game.camera;
    for (const l of this.layers) {
      const d = l.index - at;
      const scale = d >= 0 ? Math.pow(0.7, d) : 1 - d * 0.9;
      const alpha = d >= 0 ? (d <= 1 ? 1 - 0.72 * d : Math.max(0, 0.28 - 0.2 * (d - 1))) : Math.max(0, 1 + d * 1.6);
      l.root.visible = alpha > 0.01;
      l.root.alpha = alpha;
      l.root.scale.set(scale);
      l.root.position.set(cam.x * (1 - scale), cam.y * (1 - scale));
    }
    // a plunge: the view widens while passing between layers
    this.closeUp(this.dive ? 0.82 : this.cur === 5 ? 0.9 : 1, dt);
  }

  // ── every frame ─────────────────────────────────────────────────────

  protected step(dt: number) {
    this.motes.update(dt, B);
    this.placeLayers(dt);
    this.updateGrains(dt);
    if (this.shock && !this.shock.update(dt)) this.shock = null;
    const l = this.layers[this.cur];
    for (const light of [l.down, l.up]) light?.update(dt);
    if (!this.dive) {
      if (l.down?.touches(this.org.x, this.org.y)) this.go(1);
      else if (l.up?.touches(this.org.x, this.org.y)) this.go(-1);
    }
    // read first, then the seed falls
    if (!l.sowing && l.visited && this.settled && (this.cur === 0 || this.heard(LAYERS[this.cur].verse))) l.sowing = true;
    if (l.sowing) l.sowTime += dt;
    [this.stepCrowd, this.stepPath, this.stepRock, this.stepThorns, this.stepLand, this.stepGround][this.cur].call(this, dt, l);
    for (const s of l.seeds) s.update(dt);
    this.catchSeeds(l, dt);
    // the warm light appears once the layer has given what it has, or after a while
    const goal = GOALS[this.cur];
    const done = this.cur === 4 ? this.stats.fruit >= goal : l.caught >= goal;
    if (this.cur < 5 && !l.down && l.sowing && (done || l.sowTime > PATIENCE) && (this.cur > 0 || l.sowTime > 3)) {
      const a = Math.atan2(this.org.vy, this.org.vx) || 0;
      l.down = new DepthLight(clampX(this.org.x + Math.cos(a) * 260), clampY(this.org.y + Math.sin(a) * 200 + 60), 'down');
      l.root.addChild(l.down.root);
      if (this.cur > 0) audio.chime('discover');
    }
  }

  private nearestSeed(l: Layer) {
    let best: Seed | null = null;
    let bestD = Infinity;
    for (const s of l.seeds) {
      if (!s.catchable) continue;
      if (this.cur === 3 && !this.reachable(s)) continue;
      const d = this.dist(s);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** Taking a seed in: it goes into the organism like the words of a thought, and is carried as a grain. */
  private catchSeeds(l: Layer, dt: number) {
    const r = 30 + 10 * this.org.size;
    for (const s of l.seeds) {
      if (!s.catchable || this.dist(s) > r) continue;
      if (this.cur === 3 && !this.reachable(s)) continue;
      s.set('caught');
      l.caught++;
      this.stats.caught++;
      this.game.food.onEat({ word: s.word, color: GOLD });
      this.addGrain();
    }
    l.seeds = l.seeds.filter((s) => {
      if (s.state !== 'caught' && s.state !== 'taken' && !(s.state === 'withered' && s.t > 2.5) && !(s.state === 'choked' && s.t > 2) && !(s.state === 'trodden' && s.t > 4)) return true;
      if (s.state === 'caught') {
        // drawn into the mouth
        s.x = ease(s.x, this.org.x, 14, dt);
        s.y = ease(s.y, this.org.y, 14, dt);
        s.root.alpha -= dt * 6;
        s.root.position.set(s.x, s.y);
        if (s.root.alpha > 0) return true;
      }
      s.root.destroy({ children: true });
      return false;
    });
  }

  /** Seeds the sower casts into this layer: the words of its verse, falling from above. */
  private sow(l: Layer, every: number, dt: number, where: () => { x: number; y: number }) {
    if (!l.sowing) return null;
    l.sowClock -= dt;
    if (l.sowClock > 0 || l.seeds.filter((s) => s.state !== 'caught').length > 9) return null;
    l.sowClock = every;
    const words = keyWords(this.api.verse(LAYERS[l.index].verse));
    const word = words[Math.floor(Math.random() * words.length)] ?? 'Wort';
    const p = where();
    const seed = new Seed(word, p.x, p.y);
    l.items.addChild(seed.root);
    l.seeds.push(seed);
    return seed;
  }

  /** A spot within reach, so the seed falls where the player is. */
  private near(spread = 420) {
    return { x: clampX(this.org.x + rnd(-spread, spread)), y: clampY(this.org.y + rnd(-spread * 0.6, spread * 0.6)) };
  }

  // ── grains carried ──────────────────────────────────────────────────

  private addGrain() {
    if (this.grains.length >= 24) return;
    this.grains.push({ s: light(textures().core, 0.08, GOLD, 0.9, this.front), phase: Math.random() * 7 });
  }

  /** One grain lost (to a bird or a thorn): it flies off towards `to` and fades. */
  private loseGrain(to: { x: number; y: number }) {
    const g = this.grains.pop();
    if (!g) return false;
    const s = g.s;
    const from = { x: s.x, y: s.y };
    let k = 0;
    const fly = () => {
      k += 0.05;
      s.position.set(lerp(from.x, to.x, k), lerp(from.y, to.y, k));
      s.alpha = 1 - k;
      if (k < 1) requestAnimationFrame(fly);
      else s.destroy();
    };
    fly();
    return true;
  }

  private updateGrains(dt: number) {
    this.grains.forEach((g, i) => {
      g.phase += dt * 1.4;
      const r = 20 + (i % 4) * 4;
      g.s.position.set(ease(g.s.x, this.org.x + Math.cos(g.phase) * r, 5, dt), ease(g.s.y, this.org.y + Math.sin(g.phase) * r * 0.8, 5, dt));
    });
  }

  // ── 0: the crowd, and a sower casting seed into the depth ───────────

  private buildCrowd() {
    const l = this.layers[0];
    const t = textures();
    this.teacher = light(t.glow, 0.8, 0xfff1c9, 0.9, l.items);
    this.teacher.position.set(-300, 20);
    this.crowd.place(-300, 40);
    l.items.addChild(this.crowd.root);
    // the field of the parable, above: a long furrowed slope
    for (let i = 0; i < 6; i++) {
      l.ground.moveTo(-900, -220 - i * 26);
      for (let x = -900; x <= 900; x += 60) l.ground.lineTo(x, -220 - i * 26 + Math.sin(x / 160 + i) * 8);
      l.ground.stroke({ width: 2, color: 0xffd2a0, alpha: 0.12 });
    }
    // the sower: a tall figure walking along it, his arm swinging
    const s = this.sower;
    const body = light(t.glow, 0.5, 0xffe2a8, 0.75, s.root);
    body.scale.set(0.3, 0.6);
    const head = light(t.core, 0.18, 0xfff1c9, 0.95, s.root);
    head.y = -34;
    s.arm = light(t.leaf, 0.2, 0xffe2a8, 0.8, s.root);
    s.arm.anchor.set(0.04, 0.5);
    s.arm.y = -14;
    l.items.addChild(s.root);
  }

  private stepCrowd(dt: number, l: Layer) {
    this.crowd.update(dt);
    this.teacher.alpha = 0.75 + 0.2 * Math.sin(this.t * 1.3);
    const s = this.sower;
    s.x += s.dir * 55 * dt;
    if (Math.abs(s.x) > 760) s.dir = -s.dir as 1 | -1;
    s.root.position.set(s.x, -290 + Math.sin(this.t * 3) * 3);
    s.arm!.rotation = -Math.PI / 2 + s.dir * (0.6 + Math.sin(this.t * 2.2) * 0.8);
    // with every swing, seed flies out and falls away into the depth below
    s.clock -= dt;
    if (s.clock <= 0 && l.sowing) {
      s.clock = 0.7;
      const seed = light(textures().core, 0.12, GOLD, 0.95, l.items);
      this.falling.push({ s: seed, x: s.x + s.dir * 20, y: -310, vx: s.dir * rnd(40, 140), vy: rnd(-120, -40), t: 0 });
    }
    this.falling = this.falling.filter((f) => {
      f.t += dt;
      f.vy += 160 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.s.position.set(f.x, f.y);
      // falling into the depth: smaller and fainter
      f.s.scale.set(0.12 * Math.max(0.2, 1 - f.t / 3));
      f.s.alpha = Math.max(0, 1 - f.t / 3);
      if (f.t < 3) return true;
      f.s.destroy();
      return false;
    });
  }

  // ── 1: the path, and the birds ──────────────────────────────────────

  private pathY(x: number) {
    return Math.sin(x / 420) * 160 + 40;
  }

  private buildPath() {
    const l = this.layers[1];
    const g = l.ground;
    for (const [w, a] of [
      [150, 0.05],
      [90, 0.07],
      [40, 0.08],
    ] as const) {
      g.moveTo(B.x, this.pathY(B.x));
      for (let x = B.x; x <= B.x + B.w; x += 40) g.lineTo(x, this.pathY(x));
      g.stroke({ width: w, color: LAYERS[1].ground, alpha: a, cap: 'round' });
    }
    // footprints along it
    for (let x = B.x + 30; x < B.x + B.w; x += 46) g.circle(x, this.pathY(x) + (Math.round(x / 46) % 2 ? 9 : -9), 2.5).fill({ color: LAYERS[1].ground, alpha: 0.25 });
    for (let i = 0; i < 7; i++) {
      const b = new Bird(-800 + i * 260, -380 + (i % 2) * 60);
      this.birds.push(b);
      l.items.addChild(b.root);
    }
    // someone walking the path, treading on what lies there
    this.walker.s = light(textures().glow, 0.4, 0xffd2b8, 0.6, l.items);
  }

  private stepPath(dt: number, l: Layer) {
    this.sow(l, 1.1, dt, () => {
      const x = clampX(this.org.x + rnd(-480, 480));
      return { x, y: this.pathY(x) + rnd(-30, 30) };
    });
    // "und ward zertreten"
    const w = this.walker;
    w.x += w.dir * 70 * dt;
    if (Math.abs(w.x) > 1000) w.dir = -w.dir as 1 | -1;
    w.s!.position.set(w.x, this.pathY(w.x) - 10 + Math.abs(Math.sin(this.t * 6)) * -4);
    for (const s of l.seeds) {
      if (s.state === 'lying' && Math.abs(s.x - w.x) < 26 && Math.abs(s.y - this.pathY(s.x)) < 40) s.set('trodden');
      if (s.state === 'trodden') {
        s.root.scale.set(1, Math.max(0.3, 1 - s.t));
        s.root.alpha = Math.max(0, 1 - s.t / 4);
      }
    }
    // the birds: rushing at them scares them off
    const charging = this.org.speed > 90;
    const flee = charging ? { x: this.org.x, y: this.org.y, r: 170 } : null;
    this.swoopClock -= dt;
    for (const b of this.birds) {
      const target = b.target as (Seed | { x: number; y: number; grain: true }) | null;
      if (target instanceof Seed) {
        if (target.state !== 'lying') b.target = null;
        else if (Math.hypot(b.x - target.x, b.y - target.y) < 16) {
          // "und die Vögel unter dem Himmel fraßen's auf"
          target.set('taken');
          this.stats.stolen++;
          b.target = null;
        }
      } else if (target && 'grain' in target) {
        target.x = this.org.x;
        target.y = this.org.y;
        if (Math.hypot(b.x - this.org.x, b.y - this.org.y) < 26) {
          if (this.loseGrain({ x: b.x, y: b.y - 200 })) this.stats.stolen++;
          b.target = null;
        }
      }
      if (flee && Math.hypot(b.x - flee.x, b.y - flee.y) < flee.r) b.target = null;
      b.update(dt, flee);
    }
    // an idle bird goes for a seed lying on the path, now and then for what you carry
    if (l.sowing && Math.random() < dt * 0.9) {
      const idle = this.birds.find((b) => !b.target);
      const free = l.seeds.filter((s) => s.state === 'lying' && !this.birds.some((b) => b.target === s));
      if (idle && free.length) idle.target = free[Math.floor(Math.random() * free.length)];
    }
    if (this.swoopClock <= 0 && this.grains.length) {
      this.swoopClock = rnd(6, 10);
      const idle = this.birds.find((b) => !b.target);
      if (idle) idle.target = { x: this.org.x, y: this.org.y, grain: true } as { x: number; y: number };
    }
  }

  // ── 2: rock ─────────────────────────────────────────────────────────

  private rocks: { x: number; y: number; r: number }[] = [];
  private sprouts = new Map<Seed, { g: Graphics }>();

  private buildRock() {
    const l = this.layers[2];
    const g = l.ground;
    for (let i = 0; i < 14; i++) {
      const x = B.x + 120 + (i % 5) * 470 + rnd(-60, 60);
      const y = B.y + 160 + Math.floor(i / 5) * 420 + rnd(-60, 60);
      const r = rnd(110, 190);
      this.rocks.push({ x, y, r });
      const pts: number[] = [];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const rr = r * rnd(0.75, 1.05);
        pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
      }
      g.poly(pts).fill({ color: LAYERS[2].ground, alpha: 0.07 }).stroke({ width: 2, color: LAYERS[2].ground, alpha: 0.22 });
      // a crack
      g.moveTo(x - r * 0.4, y - r * 0.1).lineTo(x, y + r * 0.1).lineTo(x + r * 0.3, y - r * 0.05).stroke({ width: 1.5, color: LAYERS[2].ground, alpha: 0.2 });
    }
  }

  private stepRock(dt: number, l: Layer) {
    const seed = this.sow(l, 0.85, dt, () => {
      // onto the rock nearest a spot within reach
      const p = this.near(460);
      const rock = this.rocks.reduce((a, b) => (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a));
      return { x: rock.x + rnd(-rock.r, rock.r) * 0.5, y: rock.y + rnd(-rock.r, rock.r) * 0.3 };
    });
    if (seed) {
      const g = new Graphics();
      g.blendMode = 'add';
      seed.root.addChildAt(g, 0);
      this.sprouts.set(seed, { g });
    }
    for (const s of l.seeds) {
      // "und da es aufging, verdorrte es, darum daß es nicht Saft hatte"
      if (s.state === 'lying') s.set('growing');
      const sp = this.sprouts.get(s);
      if (!sp) continue;
      const grow = clamp01(s.t / 1.2);
      const wither = s.state === 'withered' ? 1 : clamp01((s.t - 1.4) / 1.8);
      if (s.state === 'growing' && s.t > 3.2) {
        s.set('withered');
        this.stats.withered++;
      }
      const color = mixColor(0xb8e07a, 0x8a7a5a, wither);
      const h = 26 * grow * (1 - 0.4 * wither);
      const droop = wither * 0.9;
      sp.g.clear();
      sp.g.moveTo(0, 0).lineTo(Math.sin(droop) * h, -Math.cos(droop) * h).stroke({ width: 2, color, alpha: 0.8 });
      for (const side of [-1, 1]) {
        const lx = Math.sin(droop) * h * 0.7;
        const ly = -Math.cos(droop) * h * 0.7;
        sp.g.moveTo(lx, ly).quadraticCurveTo(lx + side * 10 * grow, ly - 6 + droop * 10, lx + side * 16 * grow, ly + droop * 14).stroke({ width: 2, color, alpha: 0.8 });
      }
      s.glow.tint = color;
      s.text.alpha = 1 - 0.7 * wither;
      if (s.state === 'withered') s.root.alpha = Math.max(0, 1 - s.t / 2.5);
    }
  }

  // ── 3: thorns ───────────────────────────────────────────────────────

  private buildThorns() {
    const l = this.layers[3];
    const g = l.ground;
    // tangled stems in the dark ground
    for (let i = 0; i < 26; i++) {
      const x = rnd(B.x, B.x + B.w);
      const y = rnd(B.y, B.y + B.h);
      g.moveTo(x, y).bezierCurveTo(x + rnd(-80, 80), y - 60, x + rnd(-80, 80), y - 120, x + rnd(-60, 60), y - rnd(140, 200));
      g.stroke({ width: 2, color: LAYERS[3].ground, alpha: 0.12 });
    }
    for (let i = 0; i < 8; i++) {
      const tg = new Graphics();
      tg.blendMode = 'add';
      l.items.addChild(tg);
      this.thorns.push({ x: B.x + 300 + (i % 4) * 530, y: B.y + 380 + Math.floor(i / 4) * 620, g: tg, seed: null, grow: 0, turn: rnd(0, 7), wait: i * 1.3 });
    }
  }

  /** Thorns ring a seed; it can be reached through a gap, or before they close. */
  private ringRadius(th: Thorns) {
    return lerp(140, 24, th.grow);
  }

  private reachable(s: Seed) {
    const th = this.thorns.find((x) => x.seed === s);
    return !th || th.grow < 0.85;
  }

  private stepThorns(dt: number, l: Layer) {
    const SPIKES = 18;
    for (const th of this.thorns) {
      th.turn += dt * 0.25;
      // a seed falls "mitten unter die Dornen", the thorns grow up with it and choke it
      if (!th.seed) {
        th.grow = Math.max(0, th.grow - dt / 2.5);
        th.wait -= dt;
        if (th.wait <= 0 && l.sowing && th.grow === 0) {
          const words = keyWords(this.api.verse(7));
          const seed = new Seed(words[Math.floor(Math.random() * words.length)] ?? 'Wort', th.x, th.y);
          l.items.addChild(seed.root);
          l.seeds.push(seed);
          th.seed = seed;
        }
      } else {
        if (th.seed.state === 'lying') th.grow = Math.min(1, th.grow + dt / 10);
        if (th.grow >= 1 && th.seed.state === 'lying') {
          th.seed.set('choked');
          this.stats.choked++;
        }
        if (th.seed.state === 'choked') {
          th.seed.root.alpha = Math.max(0, 1 - th.seed.t / 2);
          th.seed.glow.tint = 0x6a4a7a;
        }
        if (th.seed.state !== 'lying' && th.seed.state !== 'falling') {
          if (th.seed.state === 'caught' || th.seed.t > 2) {
            th.seed = null;
            th.wait = rnd(2, 5);
          }
        }
      }
      // draw the ring: spikes pointing inwards, with two gaps that turn slowly
      const r = this.ringRadius(th);
      th.g.clear();
      if (th.grow <= 0.01) continue;
      for (let k = 0; k < SPIKES; k++) {
        if (this.inGap(th, k, SPIKES)) continue;
        const a = (k / SPIKES) * Math.PI * 2 + th.turn;
        const len = 18 * th.grow + 6;
        const ox = th.x + Math.cos(a) * (r + len);
        const oy = th.y + Math.sin(a) * (r + len);
        th.g.moveTo(ox, oy).lineTo(th.x + Math.cos(a) * r, th.y + Math.sin(a) * r).stroke({ width: 3, color: 0xb07ac0, alpha: 0.35 + 0.4 * th.grow });
        th.g.circle(ox, oy, 3).fill({ color: 0x8a5a9a, alpha: 0.5 });
      }
      // touching the thorns stings
      const d = Math.hypot(this.org.x - th.x, this.org.y - th.y);
      const k = Math.round(((Math.atan2(this.org.y - th.y, this.org.x - th.x) - th.turn) / (Math.PI * 2)) * SPIKES);
      const onRing = Math.abs(d - (r + 10)) < 14 && th.grow > 0.4 && !this.inGap(th, ((k % SPIKES) + SPIKES) % SPIKES, SPIKES);
      if (onRing && this.t - this.stungAt > 1) this.sting(th);
    }
  }

  private inGap(th: Thorns, k: number, n: number) {
    // two gaps, opposite each other; they narrow as the thorns grow
    const width = th.grow > 0.7 ? 2 : 3;
    const g1 = 0;
    const g2 = n / 2;
    return Math.abs(k - g1) < width || Math.abs(k - g2) < width || Math.abs(k - n) < width;
  }

  /** A thorn: you are pushed back and a grain falls; with none left, you are carried up (as in flOw). */
  private sting(th: Thorns) {
    this.stungAt = this.t;
    this.stats.stings++;
    const dx = this.org.x - th.x;
    const dy = this.org.y - th.y;
    const d = Math.hypot(dx, dy) || 1;
    this.org.vx = (dx / d) * 240;
    this.org.vy = (dy / d) * 240;
    audio.chime('near');
    if (!this.loseGrain({ x: th.x, y: th.y })) {
      this.stats.carriedUp++;
      this.hint('Die Dornen haben dich hinaufgedrängt. Das warme Licht führt wieder hinab.');
      this.go(-1);
    }
  }

  // ── 4: good ground ──────────────────────────────────────────────────

  private buildLand() {
    const l = this.layers[4];
    const g = l.ground;
    const soft = light(textures().glow, 1, 0x7a4a2a, 0.22, l.root);
    soft.scale.set(16, 10);
    l.root.setChildIndex(soft, 0);
    for (let row = -12; row <= 12; row++) {
      const y = row * 52;
      g.moveTo(B.x, y);
      for (let x = B.x; x <= B.x + B.w; x += 50) g.lineTo(x, y + Math.sin(x / 120 + row) * 5);
      g.stroke({ width: 2, color: LAYERS[4].ground, alpha: 0.13 });
    }
  }

  private plant(x: number, y: number) {
    const l = this.layers[4];
    const g = new Graphics();
    g.blendMode = 'add';
    l.items.addChild(g);
    const ear = light(textures().core, 0.1, 0xffe08a, 0, l.items);
    this.stalks.push({ x, y, g, ear, t: 0, burst: false });
  }

  private stepLand(dt: number, l: Layer) {
    // what falls here goes up and bears fruit
    const seed = this.sow(l, 1.6, dt, () => this.near(380));
    if (seed) seed.set('growing');
    for (const s of l.seeds) {
      if (s.state === 'growing' && s.t > 1.2) {
        this.plant(s.x, s.y);
        s.set('withered');
        s.root.visible = false;
      }
    }
    // what you carry, you sow when you glide slowly
    this.sowClock -= dt;
    if (l.sowing && this.grains.length && this.org.speed < 90 && this.sowClock <= 0) {
      this.sowClock = 0.5;
      this.grains.pop()!.s.destroy();
      this.plant(this.org.x + rnd(-20, 20), this.org.y + rnd(-10, 20));
      this.stats.sown++;
    }
    for (const st of this.stalks) {
      st.t += dt;
      const grow = clamp01(st.t / 3.5);
      const h = 80 * grow;
      const sway = Math.sin(this.t * 1.4 + st.x * 0.01) * 4 * grow;
      st.g.clear();
      st.g.moveTo(st.x, st.y).quadraticCurveTo(st.x + sway * 0.5, st.y - h * 0.5, st.x + sway, st.y - h).stroke({ width: 2.5, color: mixColor(0x9fd07a, 0xffd98a, clamp01((st.t - 3) / 2)), alpha: 0.75 });
      for (const side of [-1, 1]) st.g.moveTo(st.x, st.y - h * 0.35).quadraticCurveTo(st.x + side * 14, st.y - h * 0.45, st.x + side * 20, st.y - h * 0.3).stroke({ width: 2, color: 0x9fd07a, alpha: 0.5 * grow });
      st.ear.position.set(st.x + sway, st.y - h - 6);
      st.ear.alpha = clamp01((st.t - 2.5) / 1.5) * (st.burst ? 0.4 : 1);
      st.ear.scale.set(0.1, 0.18);
      // "und trug hundertfältige Frucht"
      if (!st.burst && st.t > 4.5) {
        st.burst = true;
        for (let i = 0; i < 8; i++) {
          const a = rnd(0, Math.PI * 2);
          const s = light(textures().core, 0.08, i % 3 ? 0xffe2a8 : 0xfff1c9, 1, l.items);
          this.fruits.push({ s, x: st.x + sway, y: st.y - h, vx: Math.cos(a) * rnd(30, 90), vy: Math.sin(a) * rnd(30, 90) - 40, age: 0 });
        }
        audio.chime('beat');
      }
    }
    // the fruit drifts, is drawn to you, and is taken in
    const mouth = 26 + 10 * this.org.size;
    this.fruits = this.fruits.filter((f) => {
      f.age += dt;
      const dx = this.org.x - f.x;
      const dy = this.org.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      const pull = f.age > 0.8 && d < 320 ? 420 * (1 - d / 320) : 0;
      f.vx += ((dx / d) * pull - f.vx * 0.9) * dt;
      f.vy += ((dy / d) * pull - f.vy * 0.9) * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.s.position.set(f.x, f.y);
      f.s.alpha = 0.7 + 0.3 * Math.sin(this.t * 3 + f.age);
      if (f.age > 0.6 && d < mouth) {
        this.stats.fruit++;
        this.game.food.onEat({ word: 'Frucht', color: GOLD });
        f.s.destroy();
        return false;
      }
      if (f.age > 40) {
        f.s.destroy();
        return false;
      }
      return true;
    });
  }

  // ── 5: the ground of the parable ────────────────────────────────────

  private buildGround() {
    const l = this.layers[5];
    const t = textures();
    const deep = light(t.glow, 6, 0x2a1d5c, 0.25, l.root);
    l.root.setChildIndex(deep, 0);
    // the four grounds, small, round the centre: each lights up as Jesus explains it
    const spots = [
      { x: -330, y: -170 },
      { x: 330, y: -170 },
      { x: -330, y: 210 },
      { x: 330, y: 210 },
    ];
    l.items.addChild(this.groundCentre);
    spots.forEach((p, i) => {
      const c = new Container();
      const g = new Graphics();
      g.blendMode = 'add';
      c.addChild(g);
      c.position.set(p.x, p.y);
      c.alpha = 0.35;
      const color = LAYERS[i + 1].ground;
      if (i === 0) {
        g.moveTo(-90, 10).quadraticCurveTo(0, -30, 90, 10).stroke({ width: 26, color, alpha: 0.18, cap: 'round' });
        for (let k = 0; k < 3; k++) {
          const b = light(t.leaf, 0.1, 0xe8f1ff, 0.7, c);
          b.position.set(-40 + k * 40, -50 - (k % 2) * 14);
          b.rotation = -0.5;
        }
      } else if (i === 1) {
        for (let k = 0; k < 3; k++) g.ellipse(-50 + k * 50, (k % 2) * 16, 34, 20).fill({ color, alpha: 0.1 }).stroke({ width: 2, color, alpha: 0.3 });
      } else if (i === 2) {
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          g.moveTo(Math.cos(a) * 56, Math.sin(a) * 40).lineTo(Math.cos(a) * 36, Math.sin(a) * 26).stroke({ width: 2.5, color: 0xb07ac0, alpha: 0.6 });
        }
      } else {
        for (let k = 0; k < 5; k++) {
          const x = -60 + k * 30;
          g.moveTo(x, 30).lineTo(x + 3, -30).stroke({ width: 2, color: 0xd8e08a, alpha: 0.6 });
          g.circle(x + 3, -36, 4).fill({ color: 0xffe2a8, alpha: 0.8 });
        }
      }
      this.groundCentre.addChild(c);
      this.minis.push(c);
    });
  }

  private stepGround(dt: number) {
    // the verses of the explanation, one after another
    if (this.heard(9) && this.settled) this.once('v11', () => this.say(11));
    if (this.heard(11) && this.settled) this.once('v12', () => this.say(12));
    if (this.heard(12) && this.settled) this.once('v13', () => this.say(13));
    if (this.heard(13) && this.settled) this.once('v14', () => this.say(14));
    if (this.heard(14) && this.settled) this.once('recall', () => this.beginRecall());
    const lit = [12, 13, 14, 15].map((v) => this.heard(v) || (v === 15 && this.recalling));
    this.minis.forEach((m, i) => {
      const now = lit[i] && !lit[i + 1];
      m.alpha = ease(m.alpha, now ? 1 : lit[i] ? 0.6 : 0.35, 1.5, dt);
      m.scale.set(ease(m.scale.x, now ? 1.9 : 1.4, 1.5, dt));
    });
    if (this.recalling) this.stepRecall(dt);
  }

  /** Lk 8,15 returns with gaps; its missing words float round you among others. */
  private beginRecall() {
    this.recalling = true;
    this.hush();
    this.hint('Welche Worte gehören in den Vers? Fang sie ein.');
    const l = this.layers[5];
    const text = this.api.verse(15);
    const style = new TextStyle({ ...seedFont, fontSize: 22, fill: 0xf4ecdc });
    // above you, wherever you are when it returns
    const cx = clampX(this.org.x);
    const cy = clampY(this.org.y - 300);
    this.recallAt = { x: cx, y: cy + 330 };
    // the verse laid out in lines above the centre, its gaps marked
    const words = text.split(/\s+/);
    const lines: string[][] = [[]];
    for (const w of words) {
      const line = lines[lines.length - 1];
      if (line.join(' ').length + w.length > 40) lines.push([w]);
      else line.push(w);
    }
    lines.forEach((line, row) => {
      const parts = line.map((w) => {
        const bare = w.replace(/[^\p{L}]/gu, '');
        const gap = GAPS.includes(bare) && !this.slots.some((s) => s.word === bare);
        const tx = new Text({ text: w, style, resolution: 2 });
        tx.anchor.set(0, 0.5);
        return { tx, gap, bare };
      });
      const space = 8;
      const width = parts.reduce((s, p) => s + p.tx.width + space, -space);
      let x = -width / 2;
      for (const p of parts) {
        p.tx.position.set(cx + x, cy + row * 36);
        l.items.addChild(p.tx);
        if (p.gap) {
          const mark = new Graphics();
          mark.moveTo(cx + x, cy + 12 + row * 36).lineTo(cx + x + p.tx.width, cy + 12 + row * 36).stroke({ width: 2, color: GOLD, alpha: 0.8 });
          l.items.addChild(mark);
          p.tx.alpha = 0;
          this.slots.push({ word: p.bare, text: p.tx, mark, filled: false });
        }
        x += p.tx.width + space;
      }
    });
    [...GAPS, ...DECOYS].forEach((word, i) => {
      const text = new Text({ text: word, style: seedStyle, resolution: 2 });
      text.anchor.set(0.5, 1);
      const glow = light(textures().core, 0.16, GOLD, 0.9, l.items);
      l.items.addChild(text);
      const a = (i / 12) * Math.PI * 2;
      const r = rnd(190, 340);
      this.candidates.push({ word, text, glow, x: this.recallAt.x + Math.cos(a) * r, y: this.recallAt.y + Math.sin(a) * r * 0.6, a, r, right: GAPS.includes(word), bounce: 0, placed: false });
    });
  }

  private recallAge = 0;

  private stepRecall(dt: number) {
    this.recallTime += dt;
    this.recallAge += dt;
    const hinting = this.recallTime > 12;
    for (const c of this.candidates) {
      if (c.placed) continue;
      // they drift slowly round the spot where the verse returned; you swim to them
      c.a += dt * (0.08 + (c.r % 7) * 0.006);
      c.bounce = Math.max(0, c.bounce - dt);
      const tx = this.recallAt.x + Math.cos(c.a) * c.r * (1 + c.bounce * 0.6);
      const ty = this.recallAt.y + Math.sin(c.a) * c.r * 0.6 * (1 + c.bounce * 0.6);
      c.x = ease(c.x, tx, 1.2, dt);
      c.y = ease(c.y, ty, 1.2, dt);
      c.glow.position.set(c.x, c.y);
      c.text.position.set(c.x, c.y - 10);
      const glowUp = hinting && c.right ? 0.3 + 0.3 * Math.sin(this.t * 4) : 0;
      c.glow.scale.set(0.16 + glowUp * 0.15);
      c.text.alpha = c.bounce > 0 ? 0.4 : 1;
      if (c.bounce > 0 || this.recallAge < 1.5 || this.dist(c) > 34 + 10 * this.org.size) continue;
      if (c.right) {
        // remembered: the word goes back to its place in the verse
        const slot = this.slots.find((s) => s.word === c.word && !s.filled)!;
        slot.filled = true;
        c.placed = true;
        c.text.visible = false;
        c.glow.visible = false;
        slot.text.alpha = 1;
        slot.text.style = new TextStyle({ ...seedFont, fontSize: 22, fill: GOLD });
        slot.mark.alpha = 0;
        this.stats.recalled++;
        this.recallTime = 0;
        audio.pluck(this.stats.recalled);
        this.game.organism.feed(GOLD);
      } else {
        // not this one: it drifts away and comes back later
        c.bounce = 2.5;
        audio.chime('near');
      }
    }
    if (this.slots.length && this.slots.every((s) => s.filled)) this.once('kept', () => this.kept());
  }

  /** The verse is whole again: "die das Wort hören und behalten in einem feinen, guten Herzen". */
  private kept() {
    this.hint(null);
    this.shock = new Shockwave(this.org.x, this.org.y, GOLD, 3, 900);
    this.layers[5].items.addChild(this.shock.g);
    audio.chime('reveal');
    audio.setMood('reveal', 2);
    for (let i = 0; i < 6; i++) this.later(i * 0.25, () => this.game.organism.feed(GOLD));
    for (const c of this.candidates) {
      c.text.visible = false;
      c.glow.visible = false;
    }
    this.say(15);
    this.later(2, () => this.complete());
  }
}

/** The smaller angle between two directions. */
const angleTo = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

const clampX = (x: number) => Math.max(B.x + 120, Math.min(B.x + B.w - 120, x));
const clampY = (y: number) => Math.max(B.y + 120, Math.min(B.y + B.h - 120, y));
