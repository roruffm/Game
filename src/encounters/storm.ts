// Begegnung 1: Jesus stillt den Sturm (Markus 4,35–41)
//
// A: calm lake, follow the boat of light. B: the storm rises; the current pushes you around
// while you find the points of the story. C: Jesus speaks – the whole field falls still.
// The player does not cause the miracle; it follows the text once the disciples have woken him.
// D: "Wer ist der?"

import { Container, Graphics, Sprite } from 'pixi.js';
import { audio } from '../audio/audio';
import { noise } from '../engine/noise';
import { DriftField } from '../engine/particles';
import { textures } from '../engine/textures';
import { Beacon, EncounterScene, Shockwave, clamp01, lerp, type EncounterApi } from './kit';

const WATER = [0x1f6fd1, 0x2d9cdb, 0x4fd6ff, 0x123f8a, 0x7fe9ff];

class Boat {
  readonly root = new Container();
  x = -700;
  y = 0;
  private lights: { s: Sprite; ox: number; oy: number }[] = [];
  readonly jesus: Sprite;
  private hull = new Graphics();
  rock = 0;
  private time = 0;

  constructor(private faint = false) {
    const t = textures();
    this.hull.blendMode = 'add';
    this.root.addChild(this.hull);
    for (let i = 0; i < 12; i++) {
      const s = new Sprite(t.glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.scale.set(0.22);
      s.tint = 0xffe0a8;
      const ox = -60 + (i % 6) * 26;
      const oy = i < 6 ? -8 : 8;
      this.lights.push({ s, ox, oy });
      this.root.addChild(s);
    }
    this.jesus = new Sprite(t.glow);
    this.jesus.anchor.set(0.5);
    this.jesus.blendMode = 'add';
    this.jesus.scale.set(0.42);
    this.jesus.tint = 0xfff4d6;
    this.root.addChild(this.jesus);
    if (faint) this.root.alpha = 0.35;
  }

  update(dt: number, storm: number) {
    this.time += dt;
    const bob = Math.sin(this.time * (1.2 + storm * 2)) * (4 + storm * 26);
    const tilt = Math.sin(this.time * (0.9 + storm * 1.7)) * (0.03 + storm * 0.22);
    this.root.position.set(this.x, this.y + bob);
    this.root.rotation = tilt + this.rock;
    this.lights.forEach((l, i) => {
      const jitter = storm * 5 * Math.sin(this.time * 7 + i);
      l.s.position.set(l.ox + jitter, l.oy + Math.cos(this.time * 6 + i) * storm * 4);
      l.s.alpha = 0.7 + 0.3 * Math.sin(this.time * 3 + i);
    });
    // Jesus asleep in the stern: a slow, steady glow, whatever the storm does
    this.jesus.position.set(-92, 2);
    this.jesus.alpha = 0.55 + 0.15 * Math.sin(this.time * 0.8);
    this.hull.clear();
    this.hull.moveTo(-110, 0).quadraticCurveTo(-10, 34, 100, -6).stroke({ width: 2, color: 0x9fdcff, alpha: this.faint ? 0.15 : 0.3 });
  }
}

export class StormEncounter extends EncounterScene {
  private water!: DriftField;
  private waves = new Graphics();
  private boat = new Boat();
  private others = [new Boat(true), new Boat(true)];
  private beacons: Beacon[] = [];
  private storm = 0;
  private stormTarget = 0;
  private wind = { x: 0, y: 0 };
  private calmed = false;
  private follow = 0;
  private shock: Shockwave | null = null;
  private stillness = 0;

  constructor(api: EncounterApi) {
    super(api);
    this.bounds = { x: -1500, y: -900, w: 3000, h: 1800 };
    this.cameraZoom = 0.85;
  }

  protected start() {
    const q = this.game.quality.particles;
    this.game.nebulaColors = [0x0a3a7a, 0x0b2a5a, 0x0d4a6a];
    this.game.nebulaStrength = 0.55;
    this.water = new DriftField({ count: Math.round(900 * q), colors: WATER, scale: [0.4, 1.3], alpha: [0.18, 0.6], speed: 20, eddy: 260 });
    this.water.scatter(this.bounds);
    this.water.push = (x, y, time) => {
      // a steady drift to the east, plus the storm's gusts and swirls
      const calm = { x: 18, y: Math.sin(x / 180 + time * 0.6) * 6 };
      if (this.storm < 0.01) return calm;
      const c = noise.curl(x, y, 220, time * 0.25);
      return {
        x: calm.x + (this.wind.x + c.x * 260) * this.storm,
        y: calm.y + (this.wind.y + c.y * 260) * this.storm,
      };
    };
    this.waves.blendMode = 'add';
    this.back.addChild(this.water.root, this.waves);
    this.others[0].x = -900;
    this.others[0].y = -260;
    this.others[1].x = -1000;
    this.others[1].y = 280;
    this.front.addChild(this.others[0].root, this.others[1].root, this.boat.root);
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

  protected current(x: number, y: number) {
    if (this.storm < 0.01) return { x: 10, y: 0 };
    const c = noise.curl(x, y, 300, this.t * 0.25);
    return { x: (this.wind.x * 0.7 + c.x * 150) * this.storm, y: (this.wind.y * 0.7 + c.y * 150) * this.storm };
  }

  protected step(dt: number) {
    this.storm = lerp(this.storm, this.stormTarget, 1 - Math.exp(-dt * (this.calmed ? 0.9 : 0.5)));
    const gust = noise.get(this.t * 0.15, 3.3);
    this.wind = { x: Math.cos(gust * 3) * 150, y: Math.sin(gust * 3) * 110 };
    this.water.turbulence = 0.4 + this.storm * 3;
    this.water.update(dt, this.bounds);
    this.boat.update(dt, this.storm);
    this.others.forEach((b, i) => {
      b.x += (10 + i * 3) * dt * (this.phase === 0 ? 1 : 0.3);
      b.update(dt, this.storm);
    });
    this.drawWaves();
    audio.setStorm(this.storm, 0.6);

    if (this.phase === 0) {
      this.boat.x += 22 * dt;
      const d = Math.hypot(this.org.x - this.boat.x, this.org.y - this.boat.y);
      if (d < 220) this.follow += dt;
      if (this.follow > 1.5 && !this.flag('v36')) this.say(36);
      if (this.follow > 4 && this.phaseTime > 6) this.beginStorm();
    } else if (this.phase === 1) {
      this.boat.x += 6 * dt;
      // the stern beacon rides with the boat
      const stern = this.beacons[1];
      stern.x = this.boat.x - 92;
      stern.y = this.boat.y + Math.sin(this.t * 2) * 20;
      for (const [i, b] of this.beacons.entries()) {
        if (b.update(dt, this.org.x, this.org.y)) {
          if (i === 0) {
            this.say(37);
            stern.active = true;
            this.hint('Jesus schläft hinten im Boot. Kämpf dich zu ihm durch.');
          } else {
            this.say(38);
            this.hint(null);
            this.later(3.5, () => this.calm());
          }
        }
      }
    } else if (this.phase === 2) {
      this.stillness = clamp01(this.stillness + dt / 4);
      this.boat.jesus.scale.set(lerp(0.42, 0.9, this.stillness));
      this.boat.jesus.tint = 0xfff1c9;
      this.boat.jesus.alpha = 0.95;
      if (this.shock && !this.shock.update(dt)) this.shock = null;
      if (this.phaseTime > 6 && !this.flag('d')) {
        this.setPhase(3);
        this.say(40);
        this.later(5, () => {
          this.say(41);
          this.hint('Die Jünger stellen eine Frage. Markus lässt sie offen stehen.');
        });
        this.later(10, () => this.complete());
      }
    } else if (this.shock && !this.shock.update(dt)) this.shock = null;
  }

  private flags = new Set<string>();
  private flag(name: string) {
    if (this.flags.has(name)) return true;
    this.flags.add(name);
    return false;
  }

  private beginStorm() {
    this.setPhase(1);
    this.stormTarget = 1;
    audio.setMood('storm', 4);
    this.hint('Der Sturm kommt auf. Halte dich auf Kurs.');
    const b1 = new Beacon(this.boat.x + 420, this.boat.y - 300, 0x9fdcff, 80);
    const b2 = new Beacon(this.boat.x - 92, this.boat.y, 0xfff1c9, 70);
    b2.active = false;
    this.beacons = [b1, b2];
    this.front.addChild(b1.root, b2.root);
  }

  /** Mk 4,39: Jesus speaks, the wind and the sea obey. The player only watches it happen. */
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
