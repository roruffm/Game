// Begegnung 2: Der verlorene Sohn (Lukas 15,11–32)
//
// A: drift away from the warm centre – the further you go, the colder and thinner everything
// becomes, and your own light scatters. B: "Da schlug er in sich": a faint path leads back.
// C: while you are still far off, the father runs to meet you; you do not have to cover the
// distance yourself. D: the elder brother stays outside. The parable ends open, and so does this.

import { Container, Graphics, Sprite } from 'pixi.js';
import { audio } from '../audio/audio';
import { DriftField } from '../engine/particles';
import { mixColor } from '../engine/organism';
import { textures } from '../engine/textures';
import { Beacon, EncounterScene, clamp01, lerp, type EncounterApi } from './kit';

const HOME = { x: 0, y: 0 };
const FAR_X = 3000;

class LightCentre {
  readonly root = new Container();
  private halo: Sprite;
  private core: Sprite;
  private orbit: Sprite[] = [];
  private time = 0;
  x: number;
  y: number;
  warmth = 1;

  constructor(x: number, y: number, private color: number, size: number, orbiters: number) {
    const t = textures();
    this.x = x;
    this.y = y;
    const mk = (tex: Sprite['texture'], s: number) => {
      const sp = new Sprite(tex);
      sp.anchor.set(0.5);
      sp.blendMode = 'add';
      sp.scale.set(s);
      this.root.addChild(sp);
      return sp;
    };
    this.halo = mk(t.glow, size * 3);
    this.core = mk(t.glow, size);
    for (let i = 0; i < orbiters; i++) this.orbit.push(mk(t.dot, 0.9));
  }

  update(dt: number, scale = 1) {
    this.time += dt;
    this.root.position.set(this.x, this.y);
    const pulse = 1 + Math.sin(this.time * 1.4) * 0.06;
    this.halo.tint = this.color;
    this.halo.alpha = 0.3 * this.warmth;
    this.halo.scale.set(3 * scale * pulse);
    this.core.tint = mixColor(this.color, 0xffffff, 0.4);
    this.core.scale.set(scale * pulse);
    this.core.alpha = 0.9 * this.warmth;
    this.orbit.forEach((o, i) => {
      const a = this.time * (0.4 + (i % 5) * 0.06) + i * 2.399;
      const r = (60 + (i % 7) * 18) * scale;
      o.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.8);
      o.tint = i % 4 === 0 ? 0xffffff : this.color;
      o.alpha = (0.4 + 0.4 * Math.sin(this.time * 2 + i)) * this.warmth;
    });
  }
}

export class ProdigalEncounter extends EncounterScene {
  private field!: DriftField;
  private father = new LightCentre(HOME.x, HOME.y, 0xffc865, 0.9, 26);
  private brother = new LightCentre(520, -560, 0x8f9dff, 0.45, 6);
  private path = new Graphics();
  private pathBeacons: Beacon[] = [];
  private brotherBeacon: Beacon | null = null;
  private steps = new Set<string>();
  private fatherRunning = false;
  private together = false;
  private feast = 0;

  constructor(api: EncounterApi) {
    super(api);
    this.bounds = { x: -900, y: -1100, w: FAR_X + 1500, h: 2000 };
    this.cameraZoom = 0.8;
  }

  protected start() {
    const q = this.game.quality.particles;
    this.game.nebulaColors = [0x5a3a12, 0x3a1d6c, 0x2a1d5c];
    this.game.nebulaStrength = 0.5;
    this.field = new DriftField({ count: Math.round(800 * q), colors: [0xffd98a, 0xffc865, 0xb48cff, 0xfff1c9], scale: [0.4, 1.2], alpha: [0.2, 0.6], speed: 16, eddy: 300 });
    this.field.scatter(this.bounds);
    this.path.blendMode = 'add';
    this.back.addChild(this.field.root, this.path);
    this.brother.root.alpha = 0;
    this.front.addChild(this.father.root, this.brother.root);
    this.org.place(160, 40);
    this.org.color = 0xffe7a8;
    this.org.accent = 0xffffff;
    this.org.vitality = 1;
    audio.setMood('home', 2);
    this.say(11);
    this.later(4, () =>
      this.once('v12', () => {
        this.say(12);
        this.hint('Zieh fort, weit weg vom warmen Licht.');
      }),
    );
  }

  objective() {
    if (this.phase === 0) return { x: FAR_X + 100, y: 0 };
    if (this.phase === 1) {
      const b = this.pathBeacons.find((x) => !x.revealed);
      return b ? { x: b.x, y: b.y } : { x: HOME.x, y: HOME.y };
    }
    if (this.phase === 3 && this.brotherBeacon && !this.brotherBeacon.revealed) return { x: this.brother.x, y: this.brother.y };
    return null;
  }

  private once(name: string, run: () => void) {
    if (this.steps.has(name)) return;
    this.steps.add(name);
    run();
  }

  /** 0 at home, 1 in the far country. */
  private distance() {
    return clamp01((this.org.x - HOME.x) / FAR_X);
  }

  protected current(x: number) {
    // Phase A: the current carries you away. Phase B: it pulls gently against your return.
    if (this.phase === 0) return { x: 70 + clamp01(x / FAR_X) * 50, y: 0 };
    if (this.phase === 1) return { x: 35, y: 0 };
    return { x: 0, y: 0 };
  }

  protected step(dt: number) {
    const far = this.distance();
    // the world thins and cools with distance, then warms again when the father comes
    const cold = this.together ? Math.max(0, 1 - this.feast) * far : far;
    this.field.visible = lerp(1, 0.25, cold);
    this.field.turbulence = lerp(1, 0.4, cold);
    this.field.update(dt, this.bounds);
    this.game.nebulaStrength = lerp(0.55, 0.15, cold);
    this.father.warmth = lerp(1, 0.6, cold);
    this.father.update(dt, this.together ? 1.4 + this.feast * 0.6 : 1);
    this.brother.update(dt, 0.8);

    if (this.phase === 0) {
      this.org.vitality = lerp(1, 0.32, far);
      this.org.color = mixColor(0xffe7a8, 0x8f9dff, far);
      // the story keeps its order however fast you drift
      const said = (k: string) => this.steps.has(k);
      if (far > 0.18 && said('v12')) this.once('v13', () => this.say(13));
      if (far > 0.45 && said('v13')) this.once('v14', () => {
        this.say(14);
        audio.setMood('far', 6);
      });
      if (far > 0.7 && said('v14')) this.once('v15', () => this.say(15, 16));
      if (far > 0.95 && said('v15')) this.once('turn', () => this.turn());
    } else if (this.phase === 1) {
      this.drawPath();
      for (const [i, b] of this.pathBeacons.entries()) {
        if (b.update(dt, this.org.x, this.org.y)) this.say(i === 0 ? 18 : 19);
      }
      // "Da er aber noch ferne von dannen war" – the father sets off long before the son arrives
      if (this.org.x < FAR_X * 0.72 && this.pathBeacons.every((b) => b.revealed)) this.once('run', () => this.fatherRuns());
    } else if (this.phase === 2) {
      this.drawPath();
      if (this.fatherRunning) {
        const dx = this.org.x - this.father.x;
        const dy = this.org.y - this.father.y;
        const d = Math.hypot(dx, dy);
        const speed = 900;
        if (d > 60) {
          this.father.x += (dx / d) * Math.min(d, speed * dt);
          this.father.y += (dy / d) * Math.min(d, speed * dt);
        } else this.embrace();
      }
      if (this.together) {
        this.feast = clamp01(this.feast + dt / 6);
        this.org.vitality = lerp(this.org.vitality, 1.15, dt);
        this.org.color = mixColor(this.org.color, 0xffd98a, dt);
        // father and son go home together
        this.father.x = lerp(this.father.x, HOME.x + 60, dt * 0.25);
        this.father.y = lerp(this.father.y, HOME.y, dt * 0.25);
        this.org.x = lerp(this.org.x, this.father.x + 40, dt * 1.5);
        this.org.y = lerp(this.org.y, this.father.y + 10, dt * 1.5);
      }
    } else if (this.phase === 3) {
      this.brother.root.alpha = Math.min(1, this.brother.root.alpha + dt * 0.5);
      if (this.brotherBeacon?.update(dt, this.org.x, this.org.y)) {
        this.say(29, 30);
        this.later(7, () => this.say(31, 32));
        this.later(13, () => this.hint('Das Gleichnis endet hier. Ob der ältere Bruder hineingeht, erzählt Jesus nicht.'));
        this.later(19, () => this.complete());
      }
    }
  }

  /** Lk 15,17: "Da schlug er in sich." */
  private turn() {
    this.setPhase(1);
    this.say(17);
    this.hint('Ein schwaches Licht zeigt den Weg zurück.');
    const b1 = new Beacon(FAR_X * 0.86, -60, 0xfff1c9, 70);
    const b2 = new Beacon(FAR_X * 0.78, 40, 0xfff1c9, 70);
    this.pathBeacons = [b1, b2];
    this.front.addChild(b1.root, b2.root);
  }

  private fatherRuns() {
    this.setPhase(2);
    this.fatherRunning = true;
    this.say(20);
    this.hint(null);
    audio.setMood('home', 2.5);
    audio.chime('reveal');
  }

  private embrace() {
    if (this.together) return;
    this.fatherRunning = false;
    this.together = true;
    this.steeringLocked = true;
    this.later(3, () => this.say(21));
    this.later(9, () => this.say(22, 23));
    this.later(15, () => this.say(24));
    this.later(22, () => this.elderBrother());
  }

  private elderBrother() {
    this.setPhase(3);
    this.steeringLocked = false;
    this.say(25, 27);
    this.later(7, () => {
      this.say(28);
      this.hint('Der ältere Bruder bleibt draußen. Geh zu ihm.');
      this.brotherBeacon = new Beacon(this.brother.x, this.brother.y, 0x8f9dff, 110);
      this.front.addChild(this.brotherBeacon.root);
    });
  }

  private drawPath() {
    const g = this.path;
    g.clear();
    const k = this.phase === 2 ? 1 : 0.6;
    for (let x = this.org.x; x > HOME.x + 80; x -= 70) {
      const y = Math.sin(x / 260) * 30;
      g.circle(x, y, 3).fill({ color: 0xfff1c9, alpha: 0.18 * k });
    }
  }
}
