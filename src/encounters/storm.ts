// Begegnung 1: Jesus stillt den Sturm (Markus 4,35–41)
//
// A: evening on the lake: the sun low over the water, the crowd left behind on the shore, the
// boat of light setting off with other boats. B: a great gust of wind: streaks of wind, spray,
// waves breaking into the boat until it fills. Jesus sleeps in the stern on a cushion; the
// disciples crowd round him and wake him. C: Jesus stands and speaks – the wind drops, the
// water lies still, the stars come out. The player does not cause the miracle; it follows the
// text once the disciples have woken him. D: they are afraid: "Wer ist der?"

import { Container, Graphics, Sprite } from 'pixi.js';
import { audio } from '../audio/audio';
import { noise } from '../engine/noise';
import { DriftField } from '../engine/particles';
import { textures } from '../engine/textures';
import { Beacon, EncounterScene, Shockwave, clamp01, lerp, type EncounterApi } from './kit';
import { Spray, Stars, Swarm, Wind, ease, light } from './props';

const WATER = [0x1f6fd1, 0x2d9cdb, 0x4fd6ff, 0x123f8a, 0x7fe9ff];
const SHORE_X = -1250;

/** The hull of the boat: a shallow curve, as a function of 0–1 from stern to bow. */
const hull = (k: number) => {
  const x = (1 - k) * (1 - k) * -110 + 2 * (1 - k) * k * -10 + k * k * 100;
  const y = 2 * (1 - k) * k * 34 + k * k * -6;
  return { x, y };
};

class Boat {
  readonly root = new Container();
  x = -700;
  y = 0;
  private lights: { s: Sprite; ox: number; oy: number; x: number; y: number }[] = [];
  readonly jesus: Sprite;
  private pillow: Sprite;
  private hull = new Graphics();
  private water = new Graphics();
  rock = 0;
  /** 0–1: how full of water the boat is. */
  flooded = 0;
  /** 0–1: the disciples crowd round the sleeper. */
  waking = 0;
  /** 0–1: Jesus has stood up. */
  risen = 0;
  /** 0–1: the disciples tremble. */
  fear = 0;
  private time = 0;

  constructor(private faint = false) {
    const t = textures();
    this.hull.blendMode = 'add';
    this.water.blendMode = 'add';
    this.root.addChild(this.water, this.hull);
    this.pillow = light(t.glow, 0.3, 0xcfe6ff, faint ? 0 : 0.45, this.root);
    this.pillow.scale.set(0.34, 0.12);
    this.pillow.position.set(-96, 12);
    for (let i = 0; i < 12; i++) {
      const s = light(t.glow, 0.22, 0xffe0a8, 0.8, this.root);
      const ox = -60 + (i % 6) * 26;
      const oy = i < 6 ? -8 : 8;
      this.lights.push({ s, ox, oy, x: ox, y: oy });
    }
    this.jesus = light(t.glow, 0.42, 0xfff4d6, 0.6, this.root);
    if (faint) this.root.alpha = 0.35;
  }

  update(dt: number, storm: number) {
    this.time += dt;
    const bob = Math.sin(this.time * (1.2 + storm * 2)) * (4 + storm * 26);
    const tilt = Math.sin(this.time * (0.9 + storm * 1.7)) * (0.03 + storm * 0.22);
    // a boat full of water rides lower
    this.root.position.set(this.x, this.y + bob + this.flooded * 10);
    this.root.rotation = tilt + this.rock;
    this.lights.forEach((l, i) => {
      // the disciples crowd round the stern to wake him, and stay close once he has spoken
      const tx = lerp(l.ox, -62 + (i % 4) * 9, this.waking);
      const ty = lerp(l.oy, -14 + Math.floor(i / 4) * 10, this.waking);
      l.x = ease(l.x, tx, 2.5, dt);
      l.y = ease(l.y, ty, 2.5, dt);
      const jitter = storm * 5 * Math.sin(this.time * 7 + i) + this.fear * 2.5 * Math.sin(this.time * 23 + i * 3);
      l.s.position.set(l.x + jitter, l.y + Math.cos(this.time * 6 + i) * (storm * 4 + this.fear * 2));
      l.s.alpha = 0.7 + 0.3 * Math.sin(this.time * 3 + i);
    });
    // Jesus asleep in the stern on a cushion: a slow, steady breath, whatever the storm does;
    // when he stands, the light rises
    const breath = 0.55 + 0.15 * Math.sin(this.time * 0.8);
    this.jesus.position.set(-92, 2 - this.risen * 26);
    this.jesus.alpha = lerp(breath, 0.95, this.risen);
    this.pillow.alpha = this.faint ? 0 : 0.45 * (1 - 0.6 * this.risen);
    this.hull.clear();
    this.hull.moveTo(-110, 0).quadraticCurveTo(-10, 34, 100, -6).stroke({ width: 2, color: 0x9fdcff, alpha: this.faint ? 0.15 : 0.3 });
    this.drawWater(storm);
  }

  /** "also daß das Schiff voll ward": water rising inside the hull, sloshing with the waves. */
  private drawWater(storm: number) {
    const g = this.water;
    g.clear();
    if (this.flooded < 0.02) return;
    const surface = 30 - this.flooded * 32;
    const pts: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const p = hull(i / 24);
      if (p.y > surface) pts.push(p.x, p.y);
    }
    if (pts.length < 6) return;
    const left = pts[0];
    const right = pts[pts.length - 2];
    const top: number[] = [];
    for (let x = right; x >= left; x -= 8) top.push(x, surface + Math.sin(x / 18 + this.time * 5) * 3 * storm);
    g.poly([...pts, ...top]).fill({ color: 0x4fd6ff, alpha: 0.22 + 0.12 * this.flooded });
  }
}

export class StormEncounter extends EncounterScene {
  private water!: DriftField;
  private waves = new Graphics();
  private shore = new Graphics();
  private boat = new Boat();
  private others = [new Boat(true), new Boat(true)];
  private crowd = new Swarm(18, [0xffe0a8, 0xffd2b8, 0xfff1c9, 0xcfe6ff], 0.3, 110);
  private sun = new Container();
  private glitter = new Graphics();
  private dusk = 0;
  private wind!: Wind;
  private spray!: Spray;
  private stars!: Stars;
  private sprayClock = 0;
  private beacons: Beacon[] = [];
  private storm = 0;
  private stormTarget = 0;
  private gust = { x: 0, y: 0 };
  private calmed = false;
  private follow = 0;
  private shock: Shockwave | null = null;
  private stillness = 0;
  private steps = new Set<string>();

  constructor(api: EncounterApi) {
    super(api);
    this.bounds = { x: -1500, y: -900, w: 3000, h: 1800 };
    this.cameraZoom = 0.85;
  }

  protected start() {
    const q = this.game.quality.particles;
    const t = textures();
    this.game.nebulaColors = [0x0a3a7a, 0x0b2a5a, 0x0d4a6a, 0x5a2a3a];
    this.game.nebulaStrength = 0.55;
    this.water = new DriftField({ count: Math.round(900 * q), colors: WATER, scale: [0.4, 1.3], alpha: [0.18, 0.6], speed: 20, eddy: 260 });
    this.water.scatter(this.bounds);
    this.water.push = (x, y, time) => {
      // a steady drift to the east, plus the storm's gusts and swirls
      const calm = { x: 18, y: Math.sin(x / 180 + time * 0.6) * 6 };
      if (this.storm < 0.01) return calm;
      const c = noise.curl(x, y, 220, time * 0.25);
      return {
        x: calm.x + (this.gust.x + c.x * 260) * this.storm,
        y: calm.y + (this.gust.y + c.y * 260) * this.storm,
      };
    };
    this.waves.blendMode = 'add';
    this.shore.blendMode = 'add';
    this.glitter.blendMode = 'add';
    this.drawShore();
    // the evening sun, low over the lake
    light(t.glow, 5, 0xff9a5a, 0.18, this.sun);
    light(t.glow, 1.6, 0xffb36a, 0.6, this.sun);
    light(t.core, 0.7, 0xffe2b0, 0.9, this.sun);
    this.sun.position.set(-150, -620);
    this.stars = new Stars(Math.round(320 * q), this.bounds);
    this.back.addChild(this.stars.root, this.sun, this.glitter, this.water.root, this.waves, this.shore);
    this.others[0].x = -900;
    this.others[0].y = -260;
    this.others[1].x = -1000;
    this.others[1].y = 280;
    // the crowd stays behind on the shore
    this.crowd.place(SHORE_X + 160, 60);
    this.wind = new Wind(Math.round(160 * q));
    this.spray = new Spray(Math.round(160 * q));
    this.front.addChild(this.crowd.root, this.others[0].root, this.others[1].root, this.boat.root, this.spray.root, this.wind.root);
    this.org.place(-760, 160);
    this.org.color = 0x7fe9ff;
    this.org.accent = 0xffffff;
    this.org.vitality = 1;
    audio.setMood('calm', 2);
    audio.setStorm(0.05);
    this.say(35);
    this.hint('Folge dem Boot über den See.');
  }

  objective() {
    if (this.phase === 0) return { x: this.boat.x, y: this.boat.y + 70 };
    if (this.phase === 1) {
      const b = this.beacons.find((x) => x.active && !x.revealed);
      return b ? { x: b.x, y: b.y } : null;
    }
    return null;
  }

  detail() {
    return { storm: this.storm, flooded: this.boat.flooded, waking: this.boat.waking, risen: this.boat.risen, stars: this.stars.shown, dusk: this.dusk };
  }

  private once(name: string, run: () => void) {
    if (this.steps.has(name)) return;
    this.steps.add(name);
    run();
  }

  protected current(x: number, y: number) {
    if (this.storm < 0.01) return { x: 10, y: 0 };
    const c = noise.curl(x, y, 300, this.t * 0.25);
    return { x: (this.gust.x * 0.7 + c.x * 150) * this.storm, y: (this.gust.y * 0.7 + c.y * 150) * this.storm };
  }

  protected step(dt: number) {
    this.storm = lerp(this.storm, this.stormTarget, 1 - Math.exp(-dt * (this.calmed ? 0.9 : 0.5)));
    const g = noise.get(this.t * 0.15, 3.3);
    this.gust = { x: Math.cos(g * 3) * 150, y: Math.sin(g * 3) * 110 };
    this.water.turbulence = (0.4 + this.storm * 3) * (1 - 0.8 * this.stillness);
    this.water.update(dt, this.bounds);
    this.boat.update(dt, this.storm);
    this.others.forEach((b, i) => {
      b.x += (10 + i * 3) * dt * (this.phase === 0 ? 1 : 0.3);
      b.update(dt, this.storm);
    });
    this.crowd.update(dt);
    // closer to the boat while it is in danger and when it is still
    const nearBoat = this.phase >= 1 && Math.hypot(this.org.x - this.boat.x, this.org.y - this.boat.y) < 420;
    this.closeUp(nearBoat ? 1.3 : 1, dt);
    this.drawWaves();
    this.updateSky(dt);
    this.wind.strength = ease(this.wind.strength, this.storm > 0.15 && !this.calmed ? this.storm : 0, this.calmed ? 3 : 1, dt);
    this.wind.update(dt, this.game.camera.view(80), this.gust);
    // spray where the waves hit the boat
    this.sprayClock -= dt;
    if (this.storm > 0.3 && !this.calmed && this.sprayClock <= 0) {
      this.sprayClock = 0.25 + Math.random() * 0.4;
      this.spray.burst(this.boat.x + (Math.random() - 0.5) * 160, this.boat.y + 10, Math.round(10 * this.storm), this.gust);
    }
    this.spray.update(dt);
    this.stars.update(dt);
    audio.setStorm(this.storm, 0.6);

    if (this.phase === 0) {
      this.boat.x += 22 * dt;
      const d = Math.hypot(this.org.x - this.boat.x, this.org.y - this.boat.y);
      if (d < 220) this.follow += dt;
      if (this.follow > 1.5) this.once('v36', () => this.say(36));
      // "Und sie ließen das Volk gehen": the crowd on the shore stays behind and slowly goes home
      if (this.heard(36)) this.once('crowd', () => {
        this.crowd.mode = 'scatter';
        this.crowd.shown = 0.15;
      });
      if (this.follow > 4 && this.phaseTime > 6 && this.heard(36) && this.settled) this.once('storm', () => this.beginStorm());
    } else if (this.phase === 1) {
      this.boat.x += 6 * dt;
      // the waves break into the boat once the gust has come
      if (this.heard(37)) this.boat.flooded = Math.min(0.9, this.boat.flooded + dt / 16);
      if (this.heard(38)) this.boat.waking = Math.min(1, this.boat.waking + dt / 2.5);
      // the stern beacon rides with the boat
      const stern = this.beacons[1];
      stern.x = this.boat.x - 92;
      stern.y = this.boat.y + Math.sin(this.t * 2) * 20;
      for (const [i, b] of this.beacons.entries()) {
        if (b.update(dt, this.org.x, this.org.y)) {
          if (i === 0) {
            this.say(37);
            stern.active = true;
            this.hint('Jesus schläft hinten im Boot auf einem Kissen. Kämpf dich zu ihm durch.');
          } else {
            this.say(38);
            this.hint(null);
          }
        }
      }
      if (this.heard(38) && this.settled) this.once('calm', () => this.calm());
    } else if (this.phase === 2) {
      this.stillness = clamp01(this.stillness + dt / 4);
      this.boat.risen = clamp01(this.boat.risen + dt / 1.5);
      this.boat.jesus.scale.set(lerp(0.42, 0.9, this.stillness));
      this.boat.jesus.tint = 0xfff1c9;
      if (this.shock && !this.shock.update(dt)) this.shock = null;
      if (this.heard(39) && this.settled && this.phaseTime > 6) this.once('d', () => {
        this.setPhase(3);
        this.say(40);
      });
    } else {
      if (this.shock && !this.shock.update(dt)) this.shock = null;
      // "Und sie fürchteten sich sehr"
      this.boat.fear = this.heard(41) ? ease(this.boat.fear, 1, 1, dt) : 0;
      if (this.heard(40) && this.settled) this.once('v41', () => this.say(41));
      if (this.heard(41)) this.once('q', () => {
        this.hint('Die Jünger stellen eine Frage. Markus lässt sie offen stehen.');
        this.later(6, () => this.complete());
      });
    }
  }

  /** Evening: the sun sinks and reddens; the storm hides it; after the calm the stars come out. */
  private updateSky(dt: number) {
    if (this.phase === 0) this.dusk = Math.min(1, this.dusk + dt / 40);
    const hidden = this.phase >= 1 ? 1 : 0;
    this.sun.alpha = ease(this.sun.alpha, (1 - hidden) * (1 - 0.5 * this.dusk), hidden ? 0.8 : 1, dt);
    // low over the far shore: it keeps its place in the sky as you go
    const v = this.game.camera.view();
    this.sun.x = v.x + v.w * 0.74;
    this.sun.y = v.y + v.h * (0.14 + this.dusk * 0.08);
    // its reflection: a path of glittering light on the water
    const gl = this.glitter;
    gl.clear();
    if (this.sun.alpha > 0.02) {
      for (let i = 0; i < 26; i++) {
        const y = this.sun.y + 90 + i * 22;
        const w = 6 + i * 2.2;
        const x = this.sun.x + Math.sin(this.t * 1.8 + i * 1.3) * w;
        gl.circle(x, y, 2.2).fill({ color: i % 3 ? 0xffc890 : 0xffe9c0, alpha: this.sun.alpha * 0.5 * (1 - i / 26) * (0.6 + 0.4 * Math.sin(this.t * 3 + i)) });
      }
    }
    this.stars.shown = this.calmed ? 1 : 0;
    // the storm darkens the evening; the calm clears it
    this.game.nebulaStrength = lerp(0.55, 0.3, Math.max(this.storm, this.dusk * 0.4)) + this.stillness * 0.1;
  }

  private beginStorm() {
    this.setPhase(1);
    this.stormTarget = 1;
    audio.setMood('storm', 4);
    this.hint('Ein großer Windwirbel kommt auf. Halte dich auf Kurs.');
    const b1 = new Beacon(this.boat.x + 420, this.boat.y - 300, 0x9fdcff, 80);
    const b2 = new Beacon(this.boat.x - 92, this.boat.y, 0xfff1c9, 70);
    b2.active = false;
    this.beacons = [b1, b2];
    this.front.addChild(b1.root, b2.root);
  }

  /** Mk 4,39: Jesus stands and speaks, the wind and the sea obey. The player only watches it happen. */
  private calm() {
    this.setPhase(2);
    this.calmed = true;
    this.steeringLocked = true;
    this.say(39);
    audio.chime('reveal');
    audio.setMood('calm', 5);
    this.stormTarget = 0;
    this.shock = new Shockwave(this.boat.x - 92, this.boat.y, 0xfff1c9, 3.5, 1700);
    this.front.addChild(this.shock.g);
    this.later(3, () => {
      this.steeringLocked = false;
    });
  }

  private drawShore() {
    const g = this.shore;
    // the shore the boats leave behind, on the left
    g.moveTo(SHORE_X + 40, this.bounds.y);
    for (let y = this.bounds.y; y <= this.bounds.y + this.bounds.h; y += 60) g.lineTo(SHORE_X + Math.sin(y / 230) * 50, y);
    g.stroke({ width: 3, color: 0xffd2a0, alpha: 0.18 });
  }

  private drawWaves() {
    const g = this.waves;
    g.clear();
    const v = this.game.camera.view(50);
    const amp = 6 + this.storm * 70;
    for (let row = -4; row <= 4; row++) {
      const y0 = this.boat.y + row * 180;
      if (y0 < v.y - amp || y0 > v.y + v.h + amp) continue;
      g.moveTo(v.x, y0);
      for (let x = v.x; x <= v.x + v.w; x += 40) {
        const n = noise.get(x / 400 + this.t * 0.2 * (1 + this.storm * 3), row * 7.1);
        g.lineTo(x, y0 + Math.sin(x / 140 + this.t * (0.8 + this.storm * 3) + row) * amp * 0.5 + n * amp);
      }
      g.stroke({ width: 2, color: 0x4fd6ff, alpha: 0.06 + this.storm * 0.08 + (this.phase >= 2 ? 0.04 : 0) });
    }
  }
}
