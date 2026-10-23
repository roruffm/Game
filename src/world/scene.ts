// The Wortstrom: the open world. Chapters drift as faint dust, the books of the New Testament
// flow as streams, discovered passages glow as nodes, and threads of light show real
// cross-references between them.

import { Container, Graphics, Particle, ParticleContainer, Sprite, Text } from 'pixi.js';
import { audio } from '../audio/audio';
import { BOOKS, GROUPS } from '../bible/books';
import { ENCOUNTERS } from '../content/encounters';
import type { Game, Scene } from '../engine/game';
import { mixColor } from '../engine/organism';
import { DriftField, Stream } from '../engine/particles';
import { textures } from '../engine/textures';
import { focusAnchor, organismAnchor, store, type Focus } from '../state/store';
import type { Thread, WorldModel, WorldNode } from './model';
import { bezier, catchCurrent, Current, hash, placeWords, rideSpeed, threadCurve, ThreadPath, type RideInfo } from './ride';
import { RideView } from './rideView';
import { ResonanceView, type ResonanceMark } from './resonanceView';

export interface WorldHooks {
  activate(chapter: number): void;
  openThread(thread: Thread): void;
  arrived(chapter: number): void;
  /** The cross-reference and verse a ride leads to. */
  rideInfo(thread: Thread, from: number, to: number): Promise<RideInfo>;
  rideStarted(): void;
  rideArrived(ride: { thread: Thread; from: number; to: number; info: RideInfo | null; caught: number[] }): void;
}

interface Ride {
  key: string;
  thread: Thread;
  from: number;
  to: number;
  current: Current;
  view: RideView;
  info: RideInfo | null;
  caught: number[];
  /** Started by a tap or a journey, not by gliding into the thread. */
  auto: boolean;
  zoomBefore: number;
}

/** A journey to a node that rides a thread for most of the way. */
interface RidePlan {
  thread: Thread;
  from: number;
  s: number;
}

interface NodeView {
  root: Container;
  halo: Sprite;
  core: Sprite;
  ring: Sprite;
  orbit: Sprite[];
  flare: Sprite;
  seed: number;
}

const OT_THREAD = 0xf0b45e;
const ENCOUNTER_RANGES = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, e.range])) as Record<string, string>;
const ENCOUNTER_RADIUS = 110;
const NODE_RADIUS = 70;

export class WorldScene implements Scene {
  readonly root = new Container();
  readonly overlay = new Container();
  private dust: ParticleContainer;
  private dustBits: { p: Particle; base: number; chapter: number; phase: number }[] = [];
  private streams: { s: Stream; box: { x0: number; y0: number; x1: number; y1: number } }[] = [];
  private motes: DriftField;
  private threadsGfx = new Graphics();
  private themeGfx = new Graphics();
  private pulses: ParticleContainer;
  private pulseBits: Particle[] = [];
  private nodeLayer = new Container();
  private views = new Map<number, NodeView>();
  private labels = new Map<number, Text>();
  private indicators: Sprite[] = [];
  private joystick = new Graphics();
  private hovered: Thread | null = null;
  private focusChapter: number | null = null;
  private autopilot: { chapter: number; x: number; y: number; ride?: RidePlan } | null = null;
  private ride: Ride | null = null;
  /** Ride views fading out after a ride ended. */
  private fadingRides: RideView[] = [];
  private resonances: ResonanceView[] = [];
  private paths = new Map<string, ThreadPath>();
  /** Brief pause after leaving a current, so it does not catch the organism again at once. */
  private rideCooldown = 0;
  private scanFrame = 0;
  /** Seconds of gentle braking after the autopilot arrived, so the organism settles at the node. */
  private docking = 0;
  private time = 0;
  private richness = 0;
  themeChapters: Set<number> = new Set();
  themeColor = 0xffffff;
  reducedView = false;

  constructor(
    private readonly game: Game,
    private readonly model: WorldModel,
    private readonly hooks: WorldHooks,
  ) {
    const t = textures();
    const q = game.quality.particles * (game.quality.reducedMotion ? 0.6 : 1);

    // every chapter as faint dust: the shape of the whole Bible from the start
    this.dust = new ParticleContainer({ texture: t.dot, dynamicProperties: { position: false, color: true } });
    this.dust.blendMode = 'add';
    model.graph.chapters.forEach((c, chapter) => {
      const book = BOOKS[c[0]];
      const nt = book.t === 'NT';
      const p = new Particle({
        texture: t.dot,
        x: c[3],
        y: c[4],
        anchorX: 0.5,
        anchorY: 0.5,
        tint: GROUPS[book.group].color,
        scaleX: nt ? 1.3 : 1,
        scaleY: nt ? 1.3 : 1,
      });
      this.dust.addParticle(p);
      this.dustBits.push({ p, base: nt ? 0.32 : 0.16, chapter, phase: hash(chapter) * 7 });
    });

    // the New Testament books as streams of light flowing chapter to chapter
    BOOKS.forEach((book, b) => {
      if (book.t !== 'NT') return;
      const pts = model.graph.chapters.filter((c) => c[0] === b).map((c) => ({ x: c[3], y: c[4] }));
      if (pts.length < 2) return;
      const s = new Stream(pts, Math.round(Math.min(60, pts.length * 4) * q), GROUPS[book.group].color, 10, 34, 0.42);
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      this.streams.push({ s, box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } });
    });

    this.motes = new DriftField({
      count: Math.round(320 * q),
      colors: [0x5ce1e6, 0x3fa9ff],
      scale: [0.35, 1.0],
      alpha: [0.15, 0.55],
      speed: 26,
      eddy: 380,
    });

    this.pulses = new ParticleContainer({ texture: t.glow, dynamicProperties: { position: true, color: true } });
    this.pulses.blendMode = 'add';
    for (let i = 0; i < 60; i++) {
      const p = new Particle({ texture: t.glow, anchorX: 0.5, anchorY: 0.5, scaleX: 0.16, scaleY: 0.16, alpha: 0 });
      this.pulses.addParticle(p);
      this.pulseBits.push(p);
    }
    this.threadsGfx.blendMode = 'add';
    this.themeGfx.blendMode = 'add';

    this.root.addChild(this.dust, ...this.streams.map((s) => s.s.root), this.motes.root, this.themeGfx, this.threadsGfx, this.pulses, this.nodeLayer);
    this.overlay.addChild(this.joystick);
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(t.glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.scale.set(0.4);
      s.visible = false;
      this.indicators.push(s);
      this.overlay.addChild(s);
    }
    this.motes.scatter(game.camera.view(300));
    this.syncNodes();
  }

  enter() {
    this.root.addChild(this.game.organism.trailLayer, this.game.organism.root);
    this.game.screenLayer.addChild(this.overlay);
    this.motes.scatter(this.game.camera.view(300));
  }

  leave() {
    this.root.removeChild(this.game.organism.trailLayer, this.game.organism.root);
    this.game.screenLayer.removeChild(this.overlay);
    this.stopTravel();
    this.endRide(false);
    focusAnchor.visible = false;
    store.set({ focus: null });
  }

  /** Called when the model changed: creates and removes node views. */
  syncNodes() {
    const t = textures();
    for (const [chapter, view] of this.views) {
      if (!this.model.nodes.has(chapter)) {
        view.root.destroy({ children: true });
        this.views.delete(chapter);
      }
    }
    for (const node of this.model.nodes.values()) {
      if (this.views.has(node.chapter)) continue;
      const root = new Container();
      root.position.set(node.x, node.y);
      const mk = (tex: Sprite['texture'], scale: number, alpha: number) => {
        const s = new Sprite(tex);
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.scale.set(scale);
        s.alpha = alpha;
        root.addChild(s);
        return s;
      };
      const halo = mk(t.glow, 1, 0.3);
      const ring = mk(t.ring, 0.5, 0.5);
      const core = mk(t.glow, 0.4, 0.9);
      const flare = mk(t.glow, 2, 0);
      const orbit = node.kind === 'encounter' ? Array.from({ length: 12 }, () => mk(t.dot, 0.7, 0.8)) : [];
      this.nodeLayer.addChild(root);
      this.views.set(node.chapter, { root, halo, core, ring, orbit, flare, seed: hash(node.chapter + 3) * 10 });
    }
    // known nodes are not drawn as dust any more
    for (const d of this.dustBits) d.p.alpha = this.model.nodes.has(d.chapter) && this.model.nodes.get(d.chapter)!.kind !== 'hint' ? 0 : d.base;
    this.richness = this.model.richness();
    this.applyRichness();
  }

  private applyRichness() {
    const r = this.richness;
    const palette = [0x5ce1e6, 0x3fa9ff];
    if (r > 0.12) palette.push(0xffd98a);
    if (r > 0.3) palette.push(0xb48cff);
    if (r > 0.5) palette.push(0xff9fc2, 0xfff1c9);
    this.motes.setColors(palette);
    this.motes.visible = this.reducedView ? 0.3 : 0.45 + 0.55 * r;
    this.game.nebulaStrength = 0.32 + 0.45 * r;
    this.game.nebulaColors = r > 0.3 ? [0x1b3a7a, 0x3a1d6c, 0x0d5a5a, 0x5a3a1a] : [0x14306a, 0x221a50, 0x0b3a4a];
  }

  travelTo(chapter: number) {
    if (this.ride?.to === chapter) return;
    this.endRide(false);
    const node = this.model.nodes.get(chapter);
    const pos = node ?? this.model.position(chapter);
    // where a thread leads to the node, glide to the thread and let it carry you
    const plan = this.planRide(chapter);
    if (plan) {
      const e = this.pathFor(plan.thread, plan.from).at(plan.s);
      this.autopilot = { chapter, x: e.x, y: e.y, ride: plan };
    } else this.autopilot = { chapter, x: pos.x, y: pos.y };
    store.set({ traveling: true });
  }

  stopTravel() {
    if (!this.autopilot) return;
    this.autopilot = null;
    store.set({ traveling: false });
  }

  /** The thread's path, oriented from `from` to the other end. */
  private pathFor(t: Thread, from: number) {
    const key = from === t.a ? `${t.a}>${t.b}` : `${t.a}<${t.b}`;
    let p = this.paths.get(key);
    if (!p) {
      const { a, b, c } = this.curve(t);
      const forward = ThreadPath.fromCurve(a, c, b);
      p = from === t.a ? forward : forward.reversed();
      this.paths.set(key, p);
    }
    return p;
  }

  /** Hint threads flow only towards the unknown; threads between known passages flow both ways. */
  private rideable(t: Thread, from: number) {
    if (this.reducedView && t.kind === 'hint') return false;
    return from === t.a || t.kind === 'known';
  }

  private planRide(chapter: number): RidePlan | null {
    const org = this.game.organism;
    const target = this.model.position(chapter);
    const direct = Math.hypot(target.x - org.x, target.y - org.y);
    if (direct < 260) return null;
    let best: (RidePlan & { cost: number; reach: number }) | null = null;
    for (const t of this.model.threads) {
      const from = t.b === chapter ? t.a : t.a === chapter ? t.b : -1;
      if (from < 0 || !this.rideable(t, from)) continue;
      const path = this.pathFor(t, from);
      if (path.length < 320) continue;
      const s = Math.min(path.project(org.x, org.y).s, path.length - 260);
      const e = path.at(s);
      const reach = Math.hypot(e.x - org.x, e.y - org.y);
      const cost = reach + (path.length - s) * 0.25;
      if (!best || cost < best.cost) best = { thread: t, from, s, cost, reach };
    }
    // only when the thread is on the way, not a detour
    return best && best.reach < direct * 0.8 ? { thread: best.thread, from: best.from, s: best.s } : null;
  }

  private startRide(thread: Thread, from: number, s: number, auto: boolean) {
    this.endRide(false);
    this.stopTravel();
    const to = from === thread.a ? thread.b : thread.a;
    const path = this.pathFor(thread, from);
    const color = thread.ot ? OT_THREAD : 0x9ff0ff;
    const view = new RideView(path, color, this.game.quality.particles, this.game.quality.reducedMotion);
    this.root.addChildAt(view.world, this.root.getChildIndex(this.nodeLayer));
    this.overlay.addChildAt(view.screen, 0);
    const cam = this.game.camera;
    const ride: Ride = {
      key: from === thread.a ? `${thread.a}>${thread.b}` : `${thread.a}<${thread.b}`,
      thread,
      from,
      to,
      current: new Current(path, rideSpeed(thread.votes), s),
      view,
      info: null,
      caught: [],
      auto,
      zoomBefore: cam.targetZoom,
    };
    this.ride = ride;
    this.focusChapter = to;
    cam.targetZoom = cam.targetZoom * 0.85;
    store.set({ traveling: true, reveal: null });
    audio.chime('thread');
    audio.setMood('path', 1.5);
    this.hooks.rideStarted();
    this.hooks
      .rideInfo(thread, from, to)
      .then((info) => {
        if (this.ride !== ride) return;
        ride.info = info;
        // keep the words readable on screen: further apart when zoomed out (phones)
        const gap = Math.max(90, 75 / this.game.camera.targetZoom);
        view.setWords(info.words, placeWords(info.words.length, ride.current.s + 160, path.length - 90, 30, gap));
      })
      .catch(() => undefined);
  }

  private endRide(arrived: boolean) {
    const ride = this.ride;
    if (!ride) return;
    this.ride = null;
    store.set({ traveling: false });
    const cam = this.game.camera;
    // give back the zoom, unless the player changed it on the way
    if (Math.abs(cam.targetZoom - ride.zoomBefore * 0.85) < 0.01) cam.targetZoom = ride.zoomBefore;
    if (arrived) {
      ride.view.gather(this.model.position(ride.to));
      this.docking = 1.5;
      this.hooks.rideArrived({ thread: ride.thread, from: ride.from, to: ride.to, info: ride.info, caught: ride.caught });
    } else {
      ride.view.release();
      this.rideCooldown = 1;
      audio.setMood('world', 2);
    }
    this.fadingRides.push(ride.view);
  }

  /**
   * Sends a wave of light out from the organism. Hidden links within reach glimmer as it passes,
   * lights already in the world answer; `done` runs when the wave has reached its full radius.
   */
  resonate(radius: number, hidden: { chapter: number }[], done: () => void) {
    const org = this.game.organism;
    const marks: (ResonanceMark & { chapter: number })[] = hidden.map((h) => ({ ...this.model.position(h.chapter), glimmer: true, chapter: h.chapter }));
    for (const n of this.model.nodes.values()) {
      if (this.reducedView && n.kind === 'hint') continue;
      if (Math.hypot(n.x - org.x, n.y - org.y) <= radius) marks.push({ x: n.x, y: n.y, glimmer: false, chapter: n.chapter });
    }
    let rung = 0;
    const view = new ResonanceView(
      org.x,
      org.y,
      radius,
      marks,
      (i) => {
        const m = marks[i];
        if (m.glimmer) audio.pluck(rung++);
        else this.flare(m.chapter);
      },
      done,
    );
    this.root.addChildAt(view.world, this.root.getChildIndex(this.nodeLayer));
    this.resonances.push(view);
  }

  /** For tests and the console. */
  rideState() {
    const r = this.ride;
    return r ? { from: r.from, to: r.to, s: r.current.s, length: r.current.path.length, words: r.info?.words.length ?? 0, caught: r.caught.length } : null;
  }

  flare(chapter: number) {
    const v = this.views.get(chapter);
    if (v) v.flare.alpha = 1;
  }

  update(dt: number, time: number) {
    this.time = time;
    const game = this.game;
    const cam = game.camera;
    const org = game.organism;

    // movement: riding a thread, the autopilot, or the player's own steering
    let steer = game.input.steer(cam, org.x, org.y);
    this.rideCooldown = Math.max(0, this.rideCooldown - dt);
    if (this.ride) {
      const ride = this.ride;
      // on a ride the player started with a tap, the mouse does not tug at the organism
      const own = ride.auto && game.input.lastDevice === 'mouse' ? { x: 0, y: 0 } : { x: steer.x * steer.thrust, y: steer.y * steer.thrust };
      const step = ride.current.step(dt, org, own);
      if (step.arrived || step.released) this.endRide(step.arrived);
      else {
        const m = Math.hypot(step.want.x, step.want.y) || 1;
        org.maxSpeed = ride.current.speed * 1.4;
        steer = { x: step.want.x / m, y: step.want.y / m, thrust: Math.min(1, m / org.maxSpeed), boost: false };
      }
    } else if (this.autopilot) {
      if (steer.thrust > 0 && game.input.lastDevice !== 'mouse') this.stopTravel();
      else {
        const dx = this.autopilot.x - org.x;
        const dy = this.autopilot.y - org.y;
        const d = Math.hypot(dx, dy);
        const plan = this.autopilot.ride;
        if (plan && d < 70) {
          // reached the thread: the current takes over
          const path = this.pathFor(plan.thread, plan.from);
          this.startRide(plan.thread, plan.from, Math.min(path.project(org.x, org.y).s, path.length - 200), true);
        } else if (!plan && d < 45 && org.speed < 140) {
          const chapter = this.autopilot.chapter;
          this.stopTravel();
          this.docking = 1.5;
          this.hooks.arrived(chapter);
        } else steer = { x: dx / d, y: dy / d, thrust: Math.min(1, d / 360), boost: d > 700 };
      }
    } else if (this.docking > 0) {
      this.docking = steer.thrust > 0 ? 0 : this.docking - dt;
      const brake = Math.exp(-dt * 3.5);
      org.vx *= brake;
      org.vy *= brake;
    } else if (this.rideCooldown === 0 && (this.scanFrame = (this.scanFrame + 1) % 2) === 0) {
      this.catchByThread();
    }
    if (!this.ride) org.maxSpeed = this.autopilot ? 520 : 260;
    org.update(dt, steer);
    // text beside the organism keeps clear of where it is heading
    organismAnchor.avoid = Math.abs(org.vx) > 50 ? Math.sign(org.vx) : 0;
    const lead = this.ride ? 0.5 : 0.35;
    cam.follow(org.x + org.vx * lead, org.y + org.vy * lead, dt, this.autopilot || this.ride ? 4 : 2.6);

    if (this.ride) {
      for (const index of this.ride.view.update(dt, cam, org, this.ride.current.s)) {
        this.ride.caught.push(index);
        audio.pluck(this.ride.caught.length - 1);
      }
    }
    this.resonances = this.resonances.filter((v) => {
      if (v.update(dt, cam.zoom)) return true;
      v.destroy();
      return false;
    });
    for (const v of this.fadingRides) v.update(dt, cam, org, Infinity);
    this.fadingRides = this.fadingRides.filter((v) => {
      if (!v.finished) return true;
      v.destroy();
      return false;
    });
    // the verse card stays while the organism lingers near the passage
    const reveal = store.get().reveal;
    if (reveal && !this.ride) {
      const p = this.model.position(reveal.chapter);
      if (Math.hypot(p.x - org.x, p.y - org.y) > 420) store.set({ reveal: null });
    }

    const view = cam.view(260);
    const zoom = cam.zoom;
    const far = zoom < 0.32;

    // dust twinkle (cheap: only alpha)
    for (let i = (Math.floor(time * 60) % 4); i < this.dustBits.length; i += 4) {
      const d = this.dustBits[i];
      if (d.p.alpha === 0 && this.model.nodes.get(d.chapter)?.kind !== 'hint' && this.model.nodes.has(d.chapter)) continue;
      d.p.alpha = d.base * (far ? 1.6 : 1) * (0.7 + 0.3 * Math.sin(time * 0.8 + d.phase));
    }

    // streams near the view
    for (const st of this.streams) {
      const inView = st.box.x1 > view.x && st.box.x0 < view.x + view.w && st.box.y1 > view.y && st.box.y0 < view.y + view.h;
      st.s.root.visible = inView && !this.reducedView && !this.game.quality.reducedMotion;
      if (st.s.root.visible) {
        st.s.alpha = far ? 0.5 : 0.85;
        st.s.update(dt, time);
      }
    }

    // motes, gently drawn towards the node in focus
    const focusNode = this.focusChapter !== null ? this.model.nodes.get(this.focusChapter) : null;
    this.motes.push = focusNode
      ? (x, y) => {
          const dx = focusNode.x - x;
          const dy = focusNode.y - y;
          const d = Math.hypot(dx, dy);
          if (d > 420 || d < 20) return { x: 0, y: 0 };
          const f = (1 - d / 420) * 36;
          return { x: (dx / d) * f - (dy / d) * f * 0.6, y: (dy / d) * f + (dx / d) * f * 0.6 };
        }
      : null;
    this.motes.update(dt, cam.view(200));

    this.updateNodes(dt, far);
    this.drawThreads(far);
    this.drawTheme();
    this.updateFocus();
    this.updateLabels(far);
    this.updateIndicators();
    this.drawJoystick();
    if (Math.abs(store.get().zoom - cam.zoom) > 0.02) store.set({ zoom: cam.zoom });
  }

  private updateNodes(dt: number, far: boolean) {
    const org = this.game.organism;
    for (const node of this.model.nodes.values()) {
      const v = this.views.get(node.chapter);
      if (!v) continue;
      const visible = this.game.camera.sees(node.x, node.y, 200);
      v.root.visible = visible && !(this.reducedView && node.kind === 'hint');
      if (!v.root.visible) continue;
      const d = Math.hypot(org.x - node.x, org.y - node.y);
      const near = Math.max(0, 1 - d / 380);
      const t = this.time + v.seed;
      const age = this.time - node.born;
      const grow = node.born < 0 ? 1 : Math.min(1, age / 1.6);
      const ease = 1 - Math.pow(1 - grow, 3);
      const color = node.kind === 'hint' ? mixColor(node.color, 0xffffff, 0.2) : node.color;
      const focus = this.focusChapter === node.chapter;
      const theme = this.themeChapters.has(node.chapter);
      let size: number;
      if (node.kind === 'encounter') size = node.completed ? 1.25 : 1.05;
      else if (node.kind === 'known') size = 0.62 + Math.min(0.4, node.discoveries.length * 0.1);
      else size = 0.32;
      if (far) size *= node.kind === 'hint' ? 1.8 : 1.5;
      const pulse = 1 + Math.sin(t * (node.kind === 'hint' ? 3.1 : 1.6)) * (node.kind === 'hint' ? 0.18 : 0.07) + near * 0.15;
      v.halo.tint = color;
      v.halo.scale.set(size * 2.2 * pulse * ease);
      v.halo.alpha = (node.kind === 'hint' ? 0.18 : 0.32) + near * 0.25 + (focus ? 0.15 : 0);
      v.core.tint = node.kind === 'encounter' && !node.completed ? mixColor(color, 0xffffff, 0.35) : mixColor(color, 0xffffff, 0.15);
      v.core.scale.set(size * 0.62 * pulse * ease);
      v.core.alpha = node.kind === 'hint' ? 0.55 + 0.35 * Math.sin(t * 2.3) : 0.95;
      v.ring.visible = node.kind !== 'hint' || theme;
      v.ring.tint = theme ? this.themeColor : color;
      v.ring.rotation += dt * (node.kind === 'encounter' ? 0.25 : 0.1);
      v.ring.scale.set(size * (node.completed ? 1.35 : 1.1) * ease * (theme ? 1.3 : 1));
      v.ring.alpha = theme ? 0.9 : node.kind === 'encounter' ? 0.55 + near * 0.3 : 0.35;
      v.orbit.forEach((o, i) => {
        const a = t * (0.35 + (i % 3) * 0.08) + (i / v.orbit.length) * Math.PI * 2;
        const r = 52 + (i % 4) * 9 + near * 14 + Math.sin(t + i) * 4;
        o.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.85);
        o.tint = i % 3 === 0 ? 0xffffff : color;
        o.alpha = (0.45 + 0.4 * Math.sin(t * 2 + i)) * (node.completed ? 1 : 0.8);
      });
      if (v.flare.alpha > 0) {
        v.flare.tint = color;
        v.flare.scale.set(2 + (1 - v.flare.alpha) * 4);
        v.flare.alpha = Math.max(0, v.flare.alpha - dt * 0.7);
      }
      if (node.born >= 0 && age < 0.1) v.flare.alpha = 1;
    }
  }

  /** Control point for a gently curved thread between two nodes. */
  private curve(t: Thread) {
    return threadCurve(this.model.position(t.a), this.model.position(t.b), t.a * 31 + t.b);
  }

  private bezier(a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, k: number) {
    return bezier(a, c, b, k);
  }

  /** Gliding along a thread lets its current catch the organism. */
  private catchByThread() {
    const org = this.game.organism;
    if (!this.game.input.enabled || org.speed < 90) return;
    for (const t of this.model.threads) {
      if (t.born >= 0 && this.time - t.born < 2.4) continue;
      const path = this.pathFor(t, t.a);
      const box = path.bounds(40);
      if (org.x < box.x0 || org.x > box.x1 || org.y < box.y0 || org.y > box.y1) continue;
      const hit = catchCurrent(path, org, { x: org.vx, y: org.vy }, t.kind === 'hint');
      if (!hit) continue;
      const from = hit.dir === 1 ? t.a : t.b;
      if (!this.rideable(t, from)) continue;
      this.startRide(t, from, hit.s, false);
      return;
    }
  }

  private drawThreads(far: boolean) {
    const g = this.threadsGfx;
    g.clear();
    const view = this.game.camera.view(100);
    const zoom = this.game.camera.zoom;
    let pulse = 0;
    for (const t of this.model.threads) {
      if (this.reducedView && t.kind === 'hint') continue;
      const { a, b, c } = this.curve(t);
      const minX = Math.min(a.x, b.x, c.x);
      const maxX = Math.max(a.x, b.x, c.x);
      const minY = Math.min(a.y, b.y, c.y);
      const maxY = Math.max(a.y, b.y, c.y);
      if (maxX < view.x || minX > view.x + view.w || maxY < view.y || minY > view.y + view.h) continue;
      const na = this.model.nodes.get(t.a);
      const color = t.ot ? OT_THREAD : mixColor(na?.color ?? 0x5ce1e6, 0x7fe9ff, 0.4);
      const grow = t.born < 0 ? 1 : Math.min(1, (this.time - t.born) / 2.4);
      const strength = Math.min(1, 0.35 + Math.log2(1 + t.votes) / 8);
      const riding = this.ride?.thread.id === t.id;
      const hovered = this.hovered === t || riding;
      const px = 1 / zoom;
      const width = t.kind === 'known' ? (1.6 + strength * 1.6) * px : (0.9 + strength) * px;
      const alpha = t.kind === 'known' ? 0.35 + strength * 0.35 : 0.12 + strength * 0.14;
      const steps = far ? 8 : t.kind === 'hint' ? 14 : 22;
      const upto = Math.max(1, Math.round(steps * grow));
      const shownAlpha = hovered ? Math.min(1, alpha + 0.35) : alpha;
      if (t.kind === 'hint') {
        // a ray that fades towards the unknown, so far-off lights stay a promise
        for (let i = 1; i <= upto; i++) {
          const p0 = this.bezier(a, c, b, (i - 1) / steps);
          const p1 = this.bezier(a, c, b, i / steps);
          const fade = 1 - 0.75 * (i / steps);
          g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: hovered ? width * 2.2 : width, color, alpha: shownAlpha * fade, cap: 'round' });
        }
      } else {
        g.moveTo(a.x, a.y);
        for (let i = 1; i <= upto; i++) {
          const p = this.bezier(a, c, b, i / steps);
          g.lineTo(p.x, p.y);
        }
        g.stroke({ width: hovered ? width * 2.2 : width, color, alpha: shownAlpha, cap: 'round' });
      }
      // a soft second stroke gives the thread its glow
      if (!far && t.kind === 'known') {
        g.moveTo(a.x, a.y);
        for (let i = 1; i <= upto; i++) {
          const p = this.bezier(a, c, b, i / steps);
          g.lineTo(p.x, p.y);
        }
        g.stroke({ width: width * 4, color, alpha: alpha * 0.18, cap: 'round' });
      }
      // light travelling along the thread
      if (!this.game.quality.reducedMotion && pulse < this.pulseBits.length && grow >= 1 && (t.kind === 'known' || !far)) {
        const p = this.pulseBits[pulse++];
        const speed = t.kind === 'known' ? 0.16 : 0.09;
        const k = (this.time * speed + hash(t.a + t.b * 7)) % 1;
        const q = this.bezier(a, c, b, k);
        p.x = q.x;
        p.y = q.y;
        p.tint = t.kind === 'known' ? 0xffffff : color;
        p.alpha = (t.kind === 'known' ? 0.7 : 0.35) * Math.sin(k * Math.PI);
        p.scaleX = p.scaleY = (t.kind === 'known' ? 0.2 : 0.13) / Math.max(0.5, zoom);
      }
    }
    for (let i = pulse; i < this.pulseBits.length; i++) this.pulseBits[i].alpha = 0;
  }

  private drawTheme() {
    const g = this.themeGfx;
    g.clear();
    if (!this.themeChapters.size) return;
    const pts = [...this.themeChapters].map((ch) => this.model.position(ch));
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.2);
    for (const p of pts) {
      g.moveTo(cx, cy).lineTo(p.x, p.y);
      g.circle(p.x, p.y, 34 + pulse * 6);
    }
    g.stroke({ width: 1.4 / this.game.camera.zoom, color: this.themeColor, alpha: 0.32 });
  }

  /** Thread closest to a screen point, within a finger's reach. */
  private threadAt(sx: number, sy: number): Thread | null {
    const w = this.game.camera.toWorld(sx, sy);
    const reach = 16 / this.game.camera.zoom;
    let best: Thread | null = null;
    let bestD = reach;
    for (const t of this.model.threads) {
      if (this.reducedView && t.kind === 'hint') continue;
      const { a, b, c } = this.curve(t);
      for (let i = 0; i <= 20; i++) {
        const p = this.bezier(a, c, b, i / 20);
        const d = Math.hypot(p.x - w.x, p.y - w.y);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
    }
    return best;
  }

  private nodeAt(sx: number, sy: number): WorldNode | null {
    const w = this.game.camera.toWorld(sx, sy);
    let best: WorldNode | null = null;
    let bestD = Infinity;
    for (const n of this.model.nodes.values()) {
      if (this.reducedView && n.kind === 'hint') continue;
      const reach = Math.max(n.kind === 'encounter' ? 70 : 40, 30 / this.game.camera.zoom);
      const d = Math.hypot(n.x - w.x, n.y - w.y);
      if (d < reach && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  tap(sx: number, sy: number) {
    const node = this.nodeAt(sx, sy);
    if (node) {
      // first touch shows the title; a second, deliberate one enters (same rule as the card's button)
      const focus = store.get().focus;
      if (focus?.chapter === node.chapter && focus.near) this.hooks.activate(node.chapter);
      else {
        this.focusChapter = node.chapter;
        this.travelTo(node.chapter);
      }
      return;
    }
    const thread = this.threadAt(sx, sy);
    if (thread) {
      this.hooks.openThread(thread);
      return;
    }
    if (this.game.input.lastDevice === 'touch') this.game.input.glide = this.game.camera.toWorld(sx, sy);
  }

  hover(sx: number, sy: number) {
    const node = this.nodeAt(sx, sy);
    this.hovered = node ? null : this.threadAt(sx, sy);
    this.game.app.canvas.style.cursor = node || this.hovered ? 'pointer' : 'default';
  }

  private updateFocus() {
    const org = this.game.organism;
    let best: WorldNode | null = null;
    let bestD = Infinity;
    for (const n of this.model.nodes.values()) {
      if (this.reducedView && n.kind === 'hint') continue;
      // the focused node keeps its card a little longer, so it does not flicker at the edge
      const radius = (n.kind === 'encounter' ? ENCOUNTER_RADIUS : NODE_RADIUS) * (n.chapter === this.focusChapter ? 1.3 : 1);
      const d = Math.hypot(org.x - n.x, org.y - n.y);
      if (d < radius && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    // on the way somewhere the card belongs to the destination, not to the lights passing by
    const heading = this.ride?.to ?? this.autopilot?.chapter;
    const destination = heading !== undefined ? (this.model.nodes.get(heading) ?? null) : null;
    const chosen = destination ?? best;
    this.focusChapter = chosen?.chapter ?? null;
    const prev = store.get().focus;
    if (!chosen) {
      if (prev) store.set({ focus: null });
      focusAnchor.visible = false;
      return;
    }
    const s = this.game.camera.toScreen(chosen.x, chosen.y);
    focusAnchor.x = s.x;
    focusAnchor.y = s.y;
    // on a ride the words have the screen; the card shows once the destination comes into view
    focusAnchor.visible = !this.ride || this.game.camera.sees(chosen.x, chosen.y, -40);
    const near = best === chosen;
    if (!prev || prev.chapter !== chosen.chapter || prev.near !== near || prev.completed !== chosen.completed || prev.kind !== chosen.kind) {
      store.set({ focus: this.describe(chosen, near) });
    }
  }

  private describe(n: WorldNode, near: boolean): Focus {
    const bible = this.model.bible;
    let subtitle: string;
    if (n.kind === 'encounter') {
      const d = n.discoveries.find((x) => x.kind === 'encounter');
      subtitle = d ? bible.format(d) : this.encounterRange(n);
    } else if (n.kind === 'known') {
      subtitle = n.discoveries.map((d) => bible.format(d, 'short')).join(' · ');
    } else {
      const inc = this.model.incoming(n.chapter)[0];
      subtitle = inc ? `verbunden mit ${bible.format(inc.from, 'short')}` : 'noch unentdeckt';
    }
    return { chapter: n.chapter, kind: n.kind, title: n.title, subtitle, encounter: n.encounter, completed: n.completed, near };
  }

  private encounterRange(n: WorldNode) {
    return n.encounter ? this.model.bible.format(this.model.bible.range(ENCOUNTER_RANGES[n.encounter])) : '';
  }

  private updateLabels(far: boolean) {
    const cam = this.game.camera;
    const wanted = new Set<number>();
    if (!far) {
      const org = this.game.organism;
      const candidates = [...this.model.nodes.values()]
        .filter((n) => cam.sees(n.x, n.y, -20) && (n.kind !== 'hint' || Math.hypot(n.x - org.x, n.y - org.y) < 420))
        .sort((a, b) => Math.hypot(a.x - org.x, a.y - org.y) - Math.hypot(b.x - org.x, b.y - org.y))
        .slice(0, 14);
      candidates.forEach((n) => wanted.add(n.chapter));
    } else {
      for (const n of this.model.nodes.values()) if (n.kind === 'encounter' && cam.sees(n.x, n.y)) wanted.add(n.chapter);
    }
    for (const [chapter, label] of this.labels) {
      if (!wanted.has(chapter)) {
        label.alpha -= 0.06;
        if (label.alpha <= 0) {
          label.destroy();
          this.labels.delete(chapter);
        }
      }
    }
    for (const chapter of wanted) {
      const n = this.model.nodes.get(chapter)!;
      let label = this.labels.get(chapter);
      if (!label) {
        label = new Text({
          text: n.title,
          style: {
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: n.kind === 'encounter' ? 21 : 16,
            fontWeight: n.kind === 'encounter' ? '600' : '500',
            fill: n.kind === 'hint' ? 0xbfe9ff : 0xf3ecdc,
            letterSpacing: 0.5,
            dropShadow: { color: 0x000000, alpha: 0.8, blur: 6, distance: 0 },
          },
          resolution: 2,
        });
        if (n.kind === 'hint') label.anchor.set(0, 0.5);
        else label.anchor.set(0.5, 0);
        label.alpha = 0;
        this.overlay.addChild(label);
        this.labels.set(chapter, label);
      }
      if (label.text !== n.title) label.text = n.title;
      const s = cam.toScreen(n.x, n.y);
      const offset = (n.kind === 'encounter' ? 62 : n.kind === 'known' ? 32 : 16) * Math.max(0.6, cam.zoom);
      if (n.kind === 'hint') label.position.set(s.x + offset, s.y);
      else label.position.set(s.x, s.y + offset);
      const max = n.kind === 'hint' ? 0.7 : 1;
      label.alpha = Math.min(max, label.alpha + 0.05);
    }
  }

  private updateIndicators() {
    const cam = this.game.camera;
    const pending = [...this.model.nodes.values()].filter((n) => n.kind === 'encounter' && !n.completed);
    this.indicators.forEach((s, i) => {
      const n = pending[i];
      if (!n || cam.sees(n.x, n.y, -40) || this.model.save.encounters.length >= 3) {
        s.visible = false;
        return;
      }
      const p = cam.toScreen(n.x, n.y);
      const cx = cam.width / 2;
      const cy = cam.height / 2;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const k = Math.min((cx - 28) / Math.abs(dx || 1), (cy - 28) / Math.abs(dy || 1));
      s.visible = true;
      s.position.set(cx + dx * k, cy + dy * k);
      s.tint = n.color;
      s.alpha = 0.35 + 0.25 * Math.sin(this.time * 2 + i * 2);
      s.scale.set(0.32 + 0.06 * Math.sin(this.time * 2 + i));
    });
  }

  private drawJoystick() {
    const g = this.joystick;
    g.clear();
    const j = this.game.input.joystick;
    if (!j) return;
    const l = Math.min(70, Math.hypot(j.dx, j.dy));
    const a = Math.atan2(j.dy, j.dx);
    g.circle(j.x, j.y, 70).stroke({ width: 1.5, color: 0x9fe8ff, alpha: 0.25 });
    g.circle(j.x + Math.cos(a) * l, j.y + Math.sin(a) * l, 18).fill({ color: 0x9fe8ff, alpha: 0.18 });
  }

  /** Bring the focused node's chapter into view, e.g. after a search. */
  focusOn(chapter: number) {
    this.focusChapter = chapter;
  }

  destroy() {
    this.endRide(false);
    for (const v of this.fadingRides) v.destroy();
    for (const v of this.resonances) v.destroy();
    this.overlay.destroy({ children: true });
    this.root.destroy({ children: true });
  }
}
