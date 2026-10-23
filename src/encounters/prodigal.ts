// Begegnung 2: Der verlorene Sohn (Lukas 15,11–32)
//
// A: the father divides what he has; a handful of golden lights goes with you. The current
// carries you away from the warm centre into a far country. There the lights are spent "mit
// Prassen" – shown here as a glittering tavern with wine and a round dance that takes coin after
// coin (Luke says only "mit Prassen"; the hint says so). Then famine: the world turns dry and
// grey. On a field you herd pigs to the carob pods and may not eat them yourself.
// B: "Da schlug er in sich": the image of the father's house, bread in plenty; a faint path
// leads back. C: while you are still far off, the father runs to meet you; you do not have to
// cover the distance yourself. A robe, a ring, shoes, and a feast with a round dance.
// D: the elder brother stays outside; the father goes out to him. The parable ends open.

import { Container, Graphics, Sprite } from 'pixi.js';
import { audio } from '../audio/audio';
import { mixColor } from '../engine/organism';
import { DriftField } from '../engine/particles';
import { textures } from '../engine/textures';
import { Beacon, EncounterScene, Shockwave, clamp01, lerp, type EncounterApi } from './kit';
import { Beast, Flames, Goblet, Lantern, Pod, Swarm, Vision, ease, light } from './props';

const HOME = { x: 0, y: 0 };
const FAR_X = 3000;
const TAVERN = { x: 1150, y: -40 };
const FIELD = { x: 2550, y: 60 };
const GOLD = 0xffd98a;
const WINE = 0xff5a78;
const COINS = 10;

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
    this.halo = light(t.glow, size * 3, color, 0.3, this.root);
    this.core = light(t.glow, size, color, 0.9, this.root);
    for (let i = 0; i < orbiters; i++) this.orbit.push(light(t.dot, 0.9, color, 0.5, this.root));
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

/** A golden light of the inheritance: it travels, is carried, and is spent. */
interface Coin {
  s: Sprite;
  x: number;
  y: number;
  /** Who it goes to, or where (null: carried by the son). */
  to: { x: number; y: number } | null;
  state: 'given' | 'carried' | 'spent';
  phase: number;
  life: number;
}

export class ProdigalEncounter extends EncounterScene {
  private field!: DriftField;
  private father = new LightCentre(HOME.x, HOME.y, 0xffc865, 0.9, 26);
  private brother = new LightCentre(170, -170, 0x8f9dff, 0.45, 6);
  private path = new Graphics();
  private acre = new Graphics();
  private pathBeacons: Beacon[] = [];
  private brotherBeacon: Beacon | null = null;
  private steps = new Set<string>();
  private fatherRunning = false;
  private together = false;
  private feast = 0;
  // the far country
  private coins: Coin[] = [];
  private lanterns: Lantern[] = [];
  private goblets: Goblet[] = [];
  private revellers = new Swarm(14, [0xff6a9a, 0xffb35a, 0xd77bff, 0xff8a6a], 0.34, 95);
  private hall = new Container();
  private revelling = false;
  private spendClock = 0;
  private drunk = 0;
  private famine = 0;
  private pigs: Beast[] = [];
  private pods: Pod[] = [];
  private herding = false;
  private podsEaten = 0;
  private hunger = 0;
  private herdTime = 0;
  // the way home
  private vision: Vision | null = null;
  private trail = new Flames(60, [0xffd98a, 0xffc865, 0xfff1c9]);
  private robe: Sprite[] = [];
  private ring!: Sprite;
  private shoes: Sprite[] = [];
  private dressed = 0;
  private homeLights: Lantern[] = [];
  private table = new Graphics();
  private dance = new Swarm(18, [0xffd98a, 0xffc865, 0xfff1c9, 0xffb35a], 0.4, 290);
  private shock: Shockwave | null = null;
  private fatherGoesOut = false;
  private hallFading = false;

  constructor(api: EncounterApi) {
    super(api);
    this.bounds = { x: -900, y: -1100, w: FAR_X + 1500, h: 2000 };
    this.cameraZoom = 0.8;
  }

  protected start() {
    const q = this.game.quality.particles;
    const t = textures();
    this.game.nebulaColors = [0x5a3a12, 0x3a1d6c, 0x2a1d5c];
    this.game.nebulaStrength = 0.5;
    this.field = new DriftField({ count: Math.round(800 * q), colors: [0xffd98a, 0xffc865, 0xb48cff, 0xfff1c9], scale: [0.4, 1.2], alpha: [0.2, 0.6], speed: 16, eddy: 300 });
    this.field.scatter(this.bounds);
    this.path.blendMode = 'add';
    this.acre.blendMode = 'add';
    this.table.blendMode = 'add';
    this.drawAcre();
    this.back.addChild(this.field.root, this.hall, this.acre, this.path, this.table);

    // the tavern in the far country: a warm, red glow, a string of lamps, a table with wine,
    // and people who dance while there is money
    const glowHall = light(t.glow, 1, 0xff6a5a, 0.16, this.hall);
    glowHall.scale.set(5.2, 2.6);
    const table = new Graphics();
    for (let i = 0; i < 12; i++) table.circle(-165 + i * 30, 70, 3).fill({ color: 0xffb35a, alpha: 0.55 });
    table.roundRect(-185, 62, 370, 16, 8).stroke({ width: 2, color: 0xff8a6a, alpha: 0.3 });
    table.blendMode = 'add';
    this.hall.addChild(table);
    this.hall.position.set(TAVERN.x, TAVERN.y);
    const lamps = [0xff7a5a, 0xffb35a, 0xff6a9a, 0xffc865];
    for (let i = 0; i < 11; i++) {
      // hung along a sagging string over the table
      const u = i / 10 - 0.5;
      this.lanterns.push(new Lantern(TAVERN.x + u * 560, TAVERN.y - 170 + u * u * 4 * 70, lamps[i % lamps.length], 0.8));
    }
    for (let i = 0; i < 6; i++) this.goblets.push(new Goblet(TAVERN.x - 150 + i * 60, TAVERN.y + 50));
    this.revellers.place(TAVERN.x, TAVERN.y);
    this.revellers.shown = 0.35;
    // the field: pigs rooting about and carob pods on the ground
    for (let i = 0; i < 7; i++) this.pigs.push(new Beast(FIELD.x - 200 + (i % 4) * 120, FIELD.y - 90 + Math.floor(i / 4) * 150));
    for (let i = 0; i < 12; i++) {
      const a = i * 2.399;
      const r = 120 + (i % 4) * 70;
      this.pods.push(new Pod(FIELD.x + Math.cos(a) * r * 1.3, FIELD.y + Math.sin(a) * r * 0.7));
    }
    // at home, for the feast later: lamps around the house and a long table
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const lamp = new Lantern(HOME.x + Math.cos(a) * 300, HOME.y + Math.sin(a) * 210, i % 2 ? 0xffd98a : 0xffb35a, 1);
      lamp.on = false;
      lamp.lit = 0;
      this.homeLights.push(lamp);
    }
    this.dance.place(HOME.x, HOME.y);
    this.dance.shown = 0;
    this.dance.mode = 'dance';
    this.dance.spin = 0.08;
    // the robe, the ring and the shoes wait, unseen
    for (let i = 0; i < 2; i++) {
      const s = light(t.leaf, 0.1, 0xfff1c9, 0, this.front);
      s.anchor.set(0.05, 0.5);
      this.robe.push(s);
    }
    this.ring = light(t.ring, 0.22, GOLD, 0, this.front);
    for (let i = 0; i < 2; i++) this.shoes.push(light(t.core, 0.09, 0xffe2a8, 0, this.front));

    this.front.addChild(
      ...this.lanterns.map((l) => l.root),
      ...this.homeLights.map((l) => l.root),
      ...this.pods.map((p) => p.root),
      ...this.pigs.map((p) => p.root),
      ...this.goblets.map((g) => g.root),
      this.revellers.root,
      this.dance.root,
      this.trail.root,
      this.father.root,
      this.brother.root,
    );
    this.org.place(160, 40);
    this.org.color = 0xffe7a8;
    this.org.accent = 0xffffff;
    this.org.vitality = 1;
    audio.setMood('home', 2);
    // "Ein Mensch hatte zwei Söhne": the elder is there too, at first
    this.brother.root.alpha = 0.6;
    this.say(11);
    this.later(4, () =>
      this.once('v12', () => {
        this.say(12);
        this.divide();
        this.hint('Zieh fort, weit weg vom warmen Licht.');
      }),
    );
  }

  objective() {
    if (this.phase === 0) {
      if (!this.steps.has('spent')) return TAVERN;
      if (this.herding) {
        const pod = this.nearestPod(this.org.x, this.org.y);
        return pod ? { x: pod.x, y: pod.y } : FIELD;
      }
      return FIELD;
    }
    if (this.phase === 1) {
      const b = this.pathBeacons.find((x) => !x.revealed);
      return b ? { x: b.x, y: b.y } : { x: HOME.x, y: HOME.y };
    }
    if (this.phase === 3 && this.brotherBeacon && !this.brotherBeacon.revealed) return { x: this.brother.x, y: this.brother.y };
    return null;
  }

  detail() {
    return {
      coins: this.coins.filter((c) => c.state === 'carried').length,
      spent: this.coins.filter((c) => c.state === 'spent').length,
      drunk: this.steps.has('drank') ? 1 : 0,
      famine: this.famine,
      podsEaten: this.podsEaten,
      herding: this.herding ? 1 : 0,
      dressed: this.dressed,
      feast: this.feast,
    };
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

  protected current(x: number, y: number) {
    if (this.phase === 0) {
      // reeling after the wine
      const sway = { x: Math.cos(this.t * 1.3) * 60 * this.drunk, y: Math.sin(this.t * 2.1) * 110 * this.drunk };
      // the tavern draws you in while there is money to spend
      const dt = Math.hypot(x - TAVERN.x, y - TAVERN.y);
      if (!this.steps.has('spent') && dt < 520) {
        const k = 1 - dt / 520;
        return { x: (TAVERN.x - x) * 0.25 * k + 40 * (1 - k) + sway.x, y: (TAVERN.y - y) * 0.25 * k + sway.y };
      }
      // in the field there is no current any more: you stay
      if (x > FIELD.x - 500) return sway;
      return { x: 70 + clamp01(x / FAR_X) * 50 + sway.x, y: sway.y };
    }
    // on the way back it pulls gently against you
    if (this.phase === 1) return { x: 35, y: 0 };
    return { x: 0, y: 0 };
  }

  protected step(dt: number) {
    const far = this.distance();
    // the world thins and cools with distance, then warms again when the father comes
    const cold = this.together ? Math.max(0, 1 - this.feast) * far : far;
    this.field.visible = lerp(1, 0.25, cold);
    this.field.turbulence = lerp(1, 0.4, cold) * (1 - 0.6 * this.famine);
    this.field.update(dt, this.bounds);
    this.game.nebulaStrength = lerp(0.55, 0.15, cold) * (1 - 0.4 * this.famine);
    this.father.warmth = lerp(1, 0.6, cold);
    this.father.update(dt, this.together ? 1.15 + this.feast * 0.25 : 1);
    this.brother.update(dt, 0.8);
    this.updateCoins(dt);
    this.updateFarCountry(dt);
    this.updateHome(dt);
    if (this.vision && !this.vision.update(dt)) {
      this.vision.root.destroy({ children: true });
      this.vision = null;
    }
    if (this.shock && !this.shock.update(dt)) this.shock = null;
    // closer in the tavern and on the field, wide on the way
    const inTavern = this.revelling || Math.hypot(this.org.x - TAVERN.x, this.org.y - TAVERN.y) < 360;
    const onField = this.phase === 0 && this.org.x > FIELD.x - 520;
    this.closeUp(inTavern ? 1.35 : onField ? 1.3 : this.together ? 1.15 : 1, dt);

    if (this.phase === 0) {
      // the elder son stays at home
      this.brother.root.alpha = Math.max(0, this.brother.root.alpha - dt * 0.15 * (far > 0.08 ? 1 : 0));
      const hungry = this.famine * (0.25 + 0.15 * this.hunger);
      this.org.vitality = lerp(1, 0.32, far) * (1 - hungry) + 0.1 * hungry;
      this.org.color = mixColor(mixColor(0xffe7a8, 0x8f9dff, far), WINE, this.drunk * 0.7);
      // the story keeps its order however fast you drift
      const said = (k: string) => this.steps.has(k);
      if (far > 0.18 && said('v12')) this.once('v13', () => {
        this.say(13);
        this.hint('Lukas sagt nur: „mit Prassen“. Hier ist es ausgemalt als Schenke voller Lichter.');
      });
      // each picture waits for its verse, so text and image go together
      if (this.heard(13) && !said('spent') && (Math.hypot(this.org.x - TAVERN.x, this.org.y - TAVERN.y) < 420 || this.org.x > TAVERN.x)) {
        this.once('revel', () => {
          this.revelling = true;
          this.revellers.mode = 'dance';
          this.revellers.shown = 1;
        });
      }
      if (said('spent') && this.heard(14) && this.settled && this.org.x > FIELD.x - 520) this.once('v15', () => this.say(15));
      if (this.heard(15)) this.once('herd', () => {
        this.herding = true;
        this.hint('Hüte die Säue: Führe sie zu den Trebern.');
      });
      if (this.herding) this.herdTime += dt;
      if (this.herdTime > 14) this.once('v16', () => this.say(16));
      if (this.heard(16)) this.once('none', () => this.hint('Die Säue fressen. Dir gibt niemand davon.'));
      if (this.heard(16) && this.settled && (this.podsEaten >= 5 || this.herdTime > 32)) this.once('turn', () => this.turn());
    } else if (this.phase === 1) {
      this.drawPath();
      for (const [i, b] of this.pathBeacons.entries()) {
        if (b.update(dt, this.org.x, this.org.y)) this.say(i === 0 ? 18 : 19);
      }
      this.org.vitality = ease(this.org.vitality, 0.45, 0.5, dt);
      // "Da er aber noch ferne von dannen war" – the father sets off long before the son arrives
      const last = this.pathBeacons[this.pathBeacons.length - 1];
      if (this.heard(19) && this.settled && this.org.x < last.x - 80) this.once('run', () => this.fatherRuns());
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
        // Lk 15,22–24: the robe, the ring, the shoes, then the feast
        if (this.heard(21) && this.settled) this.once('v22', () => this.say(22, 23));
        if (this.heard(22)) this.once('dress', () => (this.dressed = 0.01));
        if (this.heard(22) && this.settled) this.once('v24', () => this.say(24));
        if (this.heard(24)) this.once('feast', () => this.celebrate());
        if (this.heard(24) && this.settled) this.once('elder', () => this.later(2, () => this.elderBrother()));
        this.feast = clamp01(this.feast + dt / 6);
        this.org.vitality = lerp(this.org.vitality, 1.15, dt);
        this.org.color = mixColor(this.org.color, 0xffd98a, dt);
        // father and son go home together
        this.father.x = lerp(this.father.x, HOME.x + 60, dt * 0.25);
        this.father.y = lerp(this.father.y, HOME.y, dt * 0.25);
        this.org.x = lerp(this.org.x, this.father.x + 110, dt * 1.5);
        this.org.y = lerp(this.org.y, this.father.y + 10, dt * 1.5);
      }
    } else if (this.phase === 3) {
      this.brother.root.alpha = Math.min(1, this.brother.root.alpha + dt * 0.5);
      // "Da ging sein Vater heraus und bat ihn"
      if (this.fatherGoesOut) {
        this.father.x = ease(this.father.x, this.brother.x - 120, 0.6, dt);
        this.father.y = ease(this.father.y, this.brother.y + 60, 0.6, dt);
      }
      if (this.heard(25) && this.settled) this.once('v28', () => this.say(28));
      if (this.heard(28)) this.once('out', () => {
        this.fatherGoesOut = true;
        this.hint('Der ältere Bruder bleibt draußen. Der Vater geht zu ihm hinaus. Geh auch zu ihm.');
        this.brotherBeacon = new Beacon(this.brother.x, this.brother.y, 0x8f9dff, 110);
        this.front.addChild(this.brotherBeacon.root);
      });
      if (this.brotherBeacon?.update(dt, this.org.x, this.org.y)) this.say(29, 30);
      if (this.heard(29) && this.settled) this.once('v31', () => this.say(31, 32));
      if (this.heard(31) && this.settled) this.once('end', () => {
        this.hint('Das Gleichnis endet hier. Ob der ältere Bruder hineingeht, erzählt Jesus nicht.');
        this.later(6, () => this.complete());
      });
    }
    // the father's way to his son leaves a trail of light
    this.trail.intensity = this.fatherRunning ? 1 : ease(this.trail.intensity, 0, 2, dt);
    this.trail.update(dt, [{ x: this.father.x, y: this.father.y }]);
  }

  // ── A: the inheritance and the far country ──────────────────────────

  /** Lk 15,12: "Und er teilte ihnen das Gut." Golden lights go to both sons. */
  private divide() {
    const t = textures();
    for (let i = 0; i < COINS * 2; i++) {
      const s = light(t.core, 0.09, GOLD, 0.95, this.front);
      const toElder = i >= COINS;
      this.coins.push({
        s,
        x: this.father.x + Math.cos(i) * 40,
        y: this.father.y + Math.sin(i) * 30,
        to: toElder ? { x: this.brother.x, y: this.brother.y } : null,
        state: toElder ? 'given' : 'carried',
        phase: i * 2.399,
        life: 1,
      });
    }
    audio.chime('thread');
  }

  private updateCoins(dt: number) {
    for (const c of this.coins) {
      c.phase += dt * 1.6;
      if (c.state === 'carried') {
        // carried close around the son, catching the light
        const r = 22 + (c.phase % 3) * 3;
        c.x = ease(c.x, this.org.x + Math.cos(c.phase) * r, 4, dt);
        c.y = ease(c.y, this.org.y + Math.sin(c.phase) * r * 0.8, 4, dt);
      } else if (c.to) {
        c.x = ease(c.x, c.to.x, 3, dt);
        c.y = ease(c.y, c.to.y, 3, dt);
        if (Math.hypot(c.x - c.to.x, c.y - c.to.y) < 12) c.life -= dt * 1.5;
      }
      c.s.position.set(c.x, c.y);
      c.s.alpha = Math.max(0, c.life) * (0.75 + 0.25 * Math.sin(c.phase * 3));
    }
  }

  /** One coin less: it goes to whoever is dancing nearest. */
  private spend(at?: { x: number; y: number }) {
    const coin = this.coins.find((c) => c.state === 'carried');
    if (!coin) return;
    coin.state = 'spent';
    coin.to = at ?? { x: this.revellers.x + (Math.random() - 0.5) * 120, y: this.revellers.y + (Math.random() - 0.5) * 80 };
    this.revellers.glee = 1;
    if (!this.coins.some((c) => c.state === 'carried')) this.once('spent', () => this.spentAll());
  }

  private updateFarCountry(dt: number) {
    for (const l of this.lanterns) l.update(dt);
    if (this.hallFading) this.hall.alpha = Math.max(0, this.hall.alpha - dt * 0.25);
    this.drunk = Math.max(0, this.drunk - dt / 6);
    if (this.revelling) {
      // the dancers stay with you as long as there is something to spend
      this.revellers.x = ease(this.revellers.x, this.org.x, 2, dt);
      this.revellers.y = ease(this.revellers.y, this.org.y, 2, dt);
      this.spendClock += dt;
      if (this.spendClock > 2.4) {
        this.spendClock = 0;
        this.spend();
      }
    }
    this.revellers.update(dt);
    this.goblets.forEach((g, i) => {
      // the cups are offered: they gather round you
      if (this.revelling && !g.taken) {
        const a = (i / this.goblets.length) * Math.PI * 2 + this.t * 0.2;
        g.home.x = ease(g.home.x, this.org.x + Math.cos(a) * 80, 0.35, dt);
        g.home.y = ease(g.home.y, this.org.y + Math.sin(a) * 60, 0.35, dt);
      }
      if (!g.taken && this.revelling && Math.hypot(g.x - this.org.x, g.y - this.org.y) < 55) {
        g.taken = true;
        this.drunk = Math.min(1, this.drunk + 0.55);
        this.spend({ x: g.x, y: g.y });
        audio.chime('near');
        this.once('drank', () => undefined);
      }
      g.update(dt, g.taken ? { x: this.org.x, y: this.org.y } : null);
    });
    // famine: the land grows dry and grey
    if (this.steps.has('spent')) this.famine = Math.min(1, this.famine + dt / 8);
    // the field
    const hungry = this.famine > 0.5;
    this.pigs.forEach((pig, i) => {
      const pod = this.herding ? this.nearestPod(pig.x, pig.y, 170) : null;
      if (pod) {
        pig.goal = { x: pod.x, y: pod.y };
        if (Math.hypot(pod.x - pig.x, pod.y - pig.y) < 50) pod.taker = pig;
      } else if (this.herding) {
        // a loose herd behind the one who keeps them
        const back = this.org.heading + Math.PI + ((i % 3) - 1) * 0.6;
        const dist = 90 + Math.floor(i / 3) * 55;
        pig.goal = { x: this.org.x + Math.cos(back) * dist, y: this.org.y + Math.sin(back) * dist };
      } else pig.goal = null;
      pig.update(dt, this.herding ? 150 : 50);
    });
    // "und niemand gab sie ihm": a pod you reach for is taken first
    if (hungry && this.herding) {
      const near = this.nearestPod(this.org.x, this.org.y, 80);
      if (near && !near.taker) {
        near.taker = this.nearestPig(near.x, near.y);
        this.hunger = 1;
        this.once('v16', () => this.say(16));
      }
    }
    this.hunger = Math.max(0, this.hunger - dt * 0.5);
    this.pods = this.pods.filter((p) => {
      const was = p.eaten;
      const alive = p.update(dt);
      if (!was && p.eaten) this.podsEaten++;
      if (!alive) p.root.destroy();
      return alive;
    });
    this.acre.alpha = 0.4 + 0.6 * this.famine;
  }

  private nearestPod(x: number, y: number, within = Infinity) {
    let best: Pod | null = null;
    let bestD = within;
    for (const p of this.pods) {
      if (p.taker || p.eaten) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private nearestPig(x: number, y: number) {
    return this.pigs.reduce((a, b) => (Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b));
  }

  /** Lk 15,14: all is spent; the lamps go out, the dancers leave, a famine comes. */
  private spentAll() {
    this.revelling = false;
    this.revellers.mode = 'scatter';
    this.revellers.shown = 0;
    this.lanterns.forEach((l, i) => this.later(0.4 + i * 0.35, () => (l.on = false)));
    this.hallFading = true;
    this.say(14);
    this.hint('Das Land wird dürr und grau.');
    audio.setMood('far', 6);
    this.field.setColors([0x8a7a6a, 0x6a5a4a, 0xa89070, 0x5a5048]);
    this.field.push = () => ({ x: -6, y: 12 });
  }

  private drawAcre() {
    const g = this.acre;
    // furrows of a field in the far country
    for (let row = -5; row <= 5; row++) {
      const y = FIELD.y + row * 48;
      g.moveTo(FIELD.x - 520, y);
      for (let x = FIELD.x - 520; x <= FIELD.x + 520; x += 40) g.lineTo(x, y + Math.sin(x / 90 + row) * 6);
      g.stroke({ width: 2, color: 0xb08a4a, alpha: 0.14 });
    }
    this.acre.alpha = 0.4;
  }

  // ── B: "Da schlug er in sich" ───────────────────────────────────────

  /** Lk 15,17: he remembers his father's house, where there is bread in plenty. */
  private turn() {
    this.setPhase(1);
    this.say(17);
    this.herding = false;
    this.steeringLocked = true;
    this.later(3.5, () => (this.steeringLocked = false));
    this.vision = this.breadVision(this.org.x - 60, this.org.y - 190);
    this.front.addChild(this.vision.root);
    this.later(6, () => this.hint('Ein schwaches Licht zeigt den Weg zurück.'));
    const b1 = new Beacon(this.org.x - 280, this.org.y - 60, 0xfff1c9, 70);
    const b2 = new Beacon(this.org.x - 600, this.org.y + 30, 0xfff1c9, 70);
    this.pathBeacons = [b1, b2];
    this.front.addChild(b1.root, b2.root);
  }

  /** The father's house as he remembers it: warm light, and round loaves for every day labourer. */
  private breadVision(x: number, y: number) {
    const v = new Vision(x, y, 8);
    const t = textures();
    light(t.glow, 1.3, 0xffc865, 0.5, v.root);
    light(t.core, 0.35, 0xfff1c9, 0.9, v.root);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const loaf = light(t.glow, 0.2, 0xffb35a, 0.9, v.root);
      loaf.scale.set(0.2, 0.14);
      loaf.position.set(Math.cos(a) * 90, Math.sin(a) * 60);
      const worker = light(t.dot, 0.5, 0xffe2a8, 0.8, v.root);
      worker.position.set(Math.cos(a) * 125, Math.sin(a) * 85);
    }
    return v;
  }

  // ── C: the father ───────────────────────────────────────────────────

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
    this.shock = new Shockwave(this.org.x, this.org.y, 0xffd98a, 2.5, 600);
    this.front.addChild(this.shock.g);
    this.later(2, () => this.say(21));
  }

  /** Lk 15,23–24: "lasset uns essen und fröhlich sein!" Lamps, a table, a round dance. */
  private celebrate() {
    this.homeLights.forEach((l, i) => this.later(i * 0.3, () => (l.on = true)));
    this.dance.shown = 1;
    this.drawTable();
  }

  private updateHome(dt: number) {
    for (const l of this.homeLights) l.update(dt);
    this.dance.x = HOME.x + 60;
    this.dance.update(dt);
    this.table.alpha = ease(this.table.alpha, this.feast > 0.9 ? 1 : 0, 1, dt);
    if (this.dressed > 0) this.dressed = Math.min(1, this.dressed + dt / 3);
    const d = this.dressed;
    const o = this.org;
    // the robe: two wide, soft leaves of light folding around the son
    this.robe.forEach((s, i) => {
      const side = i === 0 ? 1 : -1;
      s.position.set(o.x, o.y + 4);
      s.rotation = Math.PI / 2 + side * (0.5 + 0.1 * Math.sin(this.t * 1.2 + i));
      s.scale.set(0.42 * d, 0.3 * d);
      s.alpha = 0.32 * d;
    });
    this.ring.position.set(o.x, o.y);
    this.ring.rotation = this.t * 0.5;
    this.ring.scale.set(0.24 * d, 0.24 * d * 0.85);
    this.ring.alpha = 0.7 * d;
    this.shoes.forEach((s, i) => {
      s.position.set(o.x + (i ? 9 : -9), o.y + 30);
      s.alpha = 0.8 * d;
    });
  }

  private drawTable() {
    const g = this.table;
    g.clear();
    // a long table of light by the house, for the meal
    for (let i = 0; i < 16; i++) g.circle(HOME.x - 225 + i * 30, HOME.y + 150, 4).fill({ color: 0xffd98a, alpha: 0.5 });
    g.roundRect(HOME.x - 240, HOME.y + 140, 480, 20, 10).stroke({ width: 2, color: 0xffc865, alpha: 0.25 });
    g.alpha = 0;
  }

  // ── D: the elder brother ────────────────────────────────────────────

  private elderBrother() {
    this.setPhase(3);
    this.steeringLocked = false;
    // he was in the field; coming near the house he hears the singing and the dancing
    this.brother.x = 520;
    this.brother.y = -560;
    this.say(25, 27);
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
