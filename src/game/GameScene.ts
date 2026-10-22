// Level 1 – Das verlorene Schaf: find the lost sheep, carry it home, celebrate.

import Phaser from 'phaser';
import { sound } from '../audio/sound';
import { QUOTES, VERSES } from '../data/verses';
import { createTextures, EDGE, makeGate, TILE_EARTH, TILE_LEDGE, TILE_ROCK } from '../gfx/textures';
import { charAt, isCave, isOneWay, isSolid, type LevelData, type TilePoint } from '../levels/level';
import { level1 } from '../levels/level1';
import { persist, save } from '../save';
import { bus } from './bus';
import { input } from './input';
import { PHYS, THORN_BOX, TILE } from './physics';

const VERSE = VERSES['lk15-6'];
const HERD_SIZE = 100;

type Phase = 'title' | 'play' | 'dying' | 'celebrate' | 'done';

interface Well {
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Image;
  active: boolean;
}

const tileCenter = (p: TilePoint) => ({ x: p.tx * TILE + TILE / 2, y: p.ty * TILE + TILE / 2 });
/** Sprite centre of a 16×16 sprite standing on the ground below the marker tile. */
const standing = (p: TilePoint) => ({ x: p.tx * TILE + TILE / 2, y: (p.ty + 1) * TILE - 8 });

function solidTileIndex(level: LevelData, tx: number, ty: number): number {
  const ch = charAt(level, tx, ty);
  if (ch === '#' || ch === 'R') {
    const open = (x: number, y: number) => y >= 0 && y < level.height && !isSolid(level, x, y);
    let mask = 0;
    if (open(tx, ty - 1)) mask |= EDGE.top;
    if (open(tx + 1, ty)) mask |= EDGE.right;
    if (open(tx, ty + 1)) mask |= EDGE.bottom;
    if (open(tx - 1, ty)) mask |= EDGE.left;
    const variant = (tx * 7 + ty * 13) % 3;
    return (ch === '#' ? TILE_EARTH : TILE_ROCK) + mask * 3 + variant;
  }
  if (ch === '=') {
    const l = isOneWay(level, tx - 1, ty);
    const r = isOneWay(level, tx + 1, ty);
    return TILE_LEDGE + (l && r ? 1 : r ? 0 : l ? 2 : 3);
  }
  return -1;
}

export class GameScene extends Phaser.Scene {
  private level: LevelData = level1;
  private phase: Phase = 'title';
  private player!: Phaser.Physics.Arcade.Sprite;
  private pbody!: Phaser.Physics.Arcade.Body;
  private carried!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private sheep!: Phaser.GameObjects.Sprite;
  private sheepZone!: Phaser.GameObjects.Zone;
  private homeZone!: Phaser.GameObjects.Zone;
  private gate!: Phaser.Physics.Arcade.StaticGroup;
  private gateImage!: Phaser.GameObjects.Image;
  private terrain!: Phaser.Tilemaps.TilemapLayer;
  private wells: Well[] = [];
  private neighbours: Phaser.GameObjects.Sprite[] = [];
  private bubble!: Phaser.GameObjects.Image;
  private bg!: {
    sky: Phaser.GameObjects.Image;
    stars: Phaser.GameObjects.TileSprite;
    moon: Phaser.GameObjects.Image;
    mountains: Phaser.GameObjects.TileSprite;
    hills: Phaser.GameObjects.TileSprite;
  };

  private carrying = false;
  private gateOpen = false;
  private facing = 1;
  private coyote = 0;
  private buffer = 0;
  private rising = false;
  private invulnerable = 0;
  private checkpoint = { x: 0, y: 0 };
  private found = new Set<number>();
  private hints = new Set<string>();

  constructor() {
    super('game');
  }

  create(data: { autoplay?: boolean }) {
    createTextures(this);
    this.resetState();
    const W = this.level.width * TILE;
    const H = this.level.height * TILE;

    this.createBackground();
    this.createTerrain();
    this.createDecor();
    this.createPlayer();
    this.createInteractive();

    this.physics.world.setBounds(0, 0, W, H + 200);
    this.physics.world.setBoundsCollision(true, true, true, false);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.player, true, 0.14, 0.14, 0, 12);
    cam.setDeadzone(20, 36);
    cam.setRoundPixels(true);

    this.time.addEvent({ delay: 4200, loop: true, callback: () => this.bleat() });
    this.scale.on('resize', this.layoutBackground, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layoutBackground, this));

    const params = new URLSearchParams(location.search);
    if (params.has('dev')) this.devSetup(params);
    this.emitHud();
    if (data.autoplay) this.begin();
  }

  /** Starts play after the intro screens. */
  begin() {
    this.phase = 'play';
    input.reset();
    sound.music(this.carrying ? 'carry' : 'search');
    this.hint('start', 'Hundert Schafe – eins fehlt. Folge den Wollfetzen und hör auf das Blöken.', undefined, 5200);
  }

  isCarrying() {
    return this.carrying;
  }

  restartLevel() {
    this.scene.restart({ autoplay: true });
  }

  /** Escape hatch from the pause menu. */
  backToRestingPlace() {
    if (this.phase === 'play') this.respawn();
  }

  private resetState() {
    this.phase = 'title';
    this.carrying = false;
    this.gateOpen = false;
    this.facing = 1;
    this.coyote = this.buffer = this.invulnerable = 0;
    this.rising = false;
    this.found = new Set();
    this.hints = new Set();
    this.wells = [];
    this.neighbours = [];
    this.checkpoint = standing(this.level.start);
  }

  // ── World ────────────────────────────────────────────────────────────

  private createBackground() {
    const cam = this.cameras.main;
    this.bg = {
      sky: this.add.image(0, 0, 'sky').setOrigin(0, 0).setScrollFactor(0, 0.4).setDepth(-10),
      stars: this.add.tileSprite(0, 0, cam.width, 140, 'stars').setOrigin(0, 0).setScrollFactor(0, 0.4).setDepth(-9),
      moon: this.add.image(0, 34, 'moon').setScrollFactor(0, 0.4).setDepth(-9),
      mountains: this.add.tileSprite(0, 140, cam.width, 96, 'mountains').setOrigin(0, 0).setScrollFactor(0, 0.4).setDepth(-8),
      hills: this.add.tileSprite(0, 178, cam.width, 200, 'hills').setOrigin(0, 0).setScrollFactor(0, 0.55).setDepth(-7),
    };
    this.layoutBackground();
  }

  private layoutBackground() {
    const w = this.cameras.main.width;
    this.bg.sky.setDisplaySize(w, 360);
    this.bg.stars.setSize(w, 140);
    this.bg.mountains.setSize(w, 96);
    this.bg.hills.setSize(w, 200);
    this.bg.moon.setX(Math.round(w * 0.78));
  }

  private createTerrain() {
    const { level } = this;
    const solid: number[][] = [];
    const cave: number[][] = [];
    for (let ty = 0; ty < level.height; ty++) {
      solid.push([]);
      cave.push([]);
      for (let tx = 0; tx < level.width; tx++) {
        solid[ty].push(solidTileIndex(level, tx, ty));
        const caveBg = !isSolid(level, tx, ty) && isCave(level, tx, ty);
        cave[ty].push(caveBg ? (tx * 5 + ty * 3) % 4 : -1);
      }
    }

    const caveMap = this.make.tilemap({ data: cave, tileWidth: TILE, tileHeight: TILE });
    caveMap.createLayer(0, caveMap.addTilesetImage('cave', 'cave', TILE, TILE, 0, 0)!, 0, 0)!.setDepth(-2);

    const map = this.make.tilemap({ data: solid, tileWidth: TILE, tileHeight: TILE });
    this.terrain = map.createLayer(0, map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!, 0, 0)!;
    this.terrain.setDepth(5);
    this.terrain.forEachTile((t) => {
      if (t.index < 0) return;
      // ledges only hold you from above
      if (t.index >= TILE_LEDGE) t.setCollision(false, false, true, false, false);
      else t.setCollision(true, true, true, true, false);
    });
    this.terrain.calculateFacesWithin(0, 0, level.width, level.height);
  }

  private createDecor() {
    const { level } = this;
    for (const t of level.thorns) this.add.image(t.tx * TILE + 8, t.ty * TILE + 8, 'thorns').setDepth(6);
    for (const b of level.bushes) this.add.image(b.tx * TILE + 8, b.ty * TILE + 8, 'bush').setDepth(3);
    for (const w of level.wool) {
      this.add.image(w.tx * TILE + 8, w.ty * TILE + 8, 'bush').setDepth(3);
      const tuft = this.add.image(w.tx * TILE + 9, w.ty * TILE + 8, 'wool').setDepth(4);
      this.tweens.add({ targets: tuft, angle: { from: -8, to: 8 }, duration: 900 + w.tx * 13, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    level.herd.forEach((h, i) => {
      const s = this.add.sprite(h.tx * TILE + 8, (h.ty + 1) * TILE - 6, 'sheep', 0).setDepth(4).setFlipX(i % 2 === 1);
      // graze, look up, now and then bleat
      this.time.addEvent({
        delay: 1400 + i * 530,
        loop: true,
        callback: () => s.setFrame(Phaser.Utils.Array.GetRandom([0, 0, 2, 2, 2, 1])),
      });
    });

    level.neighbours.forEach((n, i) => {
      const p = standing(n);
      this.neighbours.push(this.add.sprite(p.x, p.y, `neighbour${i % 3}`, 0).setDepth(7).setAlpha(0).setFlipX(i % 2 === 0));
    });
  }

  private createPlayer() {
    const p = standing(this.level.start);
    this.player = this.physics.add.sprite(p.x, p.y, 'shepherd', 0).setDepth(10);
    this.pbody = this.player.body as Phaser.Physics.Arcade.Body;
    this.pbody.setSize(PHYS.body.w, PHYS.body.h).setOffset(3, 2);
    this.pbody.setMaxVelocity(400, PHYS.maxFall);
    this.player.setCollideWorldBounds(true);

    this.carried = this.add.image(0, 0, 'carried').setOrigin(0.5, 0).setDepth(9).setVisible(false);
    this.glow = this.add.image(p.x, p.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(8).setAlpha(0.7);

    const anim = (key: string, frames: number[], frameRate: number) =>
      this.anims.exists(key) ||
      this.anims.create({ key, frames: frames.map((f) => ({ key: 'shepherd', frame: f })), frameRate, repeat: -1 });
    anim('idle', [0, 1], 2);
    anim('run', [2, 3], 9);
    anim('jump', [4], 1);
    anim('fall', [5], 1);
    this.player.play('idle');
    this.physics.add.collider(this.player, this.terrain);
  }

  private createInteractive() {
    const { level } = this;

    // the lost sheep, stuck in the thorns
    const s = level.sheep;
    this.sheep = this.add.sprite(s.tx * TILE + 8, (s.ty + 1) * TILE - 6, 'sheep', 0).setDepth(7).setFlipX(true);
    this.tweens.add({ targets: this.sheep, x: this.sheep.x + 1, duration: 120, yoyo: true, repeat: -1, repeatDelay: 900 });
    this.sheepZone = this.add.zone(s.tx * TILE + 3, s.ty * TILE + 4, 10, 12).setOrigin(0, 0);
    this.physics.add.existing(this.sheepZone, true);
    this.physics.add.overlap(this.player, this.sheepZone, () => this.pickUpSheep());
    this.bubble = this.add.image(0, 0, 'bubble').setDepth(50).setVisible(false);

    // fragments
    for (const f of level.fragments) {
      const c = tileCenter(f);
      const glow = this.add.image(c.x, c.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.45).setDepth(8);
      const img = this.physics.add.staticImage(c.x, c.y, 'fragment').setDepth(9);
      (img.body as Phaser.Physics.Arcade.StaticBody).setSize(10, 10);
      this.tweens.add({ targets: [img, glow], y: c.y - 3, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: glow, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });
      this.physics.add.overlap(this.player, img, () => {
        img.destroy();
        glow.destroy();
        this.collect(f.index, c.x, c.y);
      });
    }

    // thorns
    const thorns = this.physics.add.staticGroup();
    for (const t of level.thorns) {
      const z = this.add.zone(t.tx * TILE + THORN_BOX.x, t.ty * TILE + THORN_BOX.y, THORN_BOX.w, THORN_BOX.h).setOrigin(0, 0);
      thorns.add(z);
    }
    this.physics.add.overlap(this.player, thorns, () => this.die());

    // resting places
    level.checkpoints.forEach((c) => {
      const p = standing(c);
      const sprite = this.add.sprite(p.x, p.y, 'well', 0).setDepth(4);
      const glow = this.add.image(p.x, p.y + 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0).setDepth(8);
      const well = { sprite, glow, active: false };
      this.wells.push(well);
      const zone = this.add.zone(c.tx * TILE, c.ty * TILE, TILE, TILE).setOrigin(0, 0);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player, zone, () => this.rest(well, p));
    });

    // gate: one picture, one invisible blocker per tile; it only opens from the inside (the right)
    const gx = level.gate[0].tx * TILE;
    const gy = Math.min(...level.gate.map((g) => g.ty)) * TILE;
    this.gateImage = this.add.image(gx, gy, makeGate(this, level.gate.length)).setOrigin(0, 0).setDepth(6);
    this.gate = this.physics.add.staticGroup();
    for (const g of level.gate) this.gate.add(this.add.zone(g.tx * TILE, g.ty * TILE, TILE, TILE).setOrigin(0, 0));
    this.physics.add.collider(this.player, this.gate, () => this.touchGate());

    // home: the fold
    const xs = level.home.map((h) => h.tx);
    const top = Math.min(...level.home.map((h) => h.ty)) - 1;
    const bottom = Math.max(...level.home.map((h) => h.ty));
    this.homeZone = this.add
      .zone(Math.min(...xs) * TILE, top * TILE, (Math.max(...xs) - Math.min(...xs) + 1) * TILE, (bottom - top + 1) * TILE)
      .setOrigin(0, 0);
    this.physics.add.existing(this.homeZone, true);
    this.physics.add.overlap(this.player, this.homeZone, () => {
      if (this.carrying && this.phase === 'play') this.celebrate();
    });
  }

  // ── Loop ─────────────────────────────────────────────────────────────

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.scrollBackground();
    if (this.phase === 'play') {
      this.move(dt);
      this.invulnerable -= dt;
      if (this.player.y > this.level.height * TILE + 24) this.die();
    }
    this.animatePlayer();
    // look ahead in the walking direction
    const cam = this.cameras.main;
    cam.followOffset.x += (-this.facing * 22 - cam.followOffset.x) * Math.min(1, dt * 2.5);
    this.carried.setPosition(this.player.x, this.player.y - 5).setFlipX(this.facing < 0);
    this.glow.setPosition(this.player.x, this.player.y);
  }

  private move(dt: number) {
    const b = this.pbody;
    const onGround = b.blocked.down;
    this.coyote = onGround ? PHYS.coyoteTime : this.coyote - dt;
    this.buffer = input.consumeJumpPress() ? PHYS.jumpBuffer : this.buffer - dt;

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const target = dir * (this.carrying ? PHYS.carrySpeed : PHYS.runSpeed);
    const accel = (onGround ? PHYS.groundAccel : PHYS.airAccel) * dt;
    const vx = b.velocity.x;
    b.setVelocityX(vx < target ? Math.min(target, vx + accel) : Math.max(target, vx - accel));
    if (dir) this.facing = dir;

    if (this.buffer > 0 && this.coyote > 0) {
      b.setVelocityY(-(this.carrying ? PHYS.carryJumpVelocity : PHYS.jumpVelocity));
      this.buffer = 0;
      this.coyote = 0;
      this.rising = true;
      sound.jump();
    }
    if (this.rising && !input.jump && b.velocity.y < 0) {
      b.setVelocityY(b.velocity.y * PHYS.jumpCut);
      this.rising = false;
    }
    if (b.velocity.y >= 0) this.rising = false;
  }

  private animatePlayer() {
    const b = this.pbody;
    this.player.setFlipX(this.facing < 0);
    if (this.phase === 'dying') return;
    const key = !b.blocked.down
      ? b.velocity.y < 0
        ? 'jump'
        : 'fall'
      : Math.abs(b.velocity.x) > 10 && this.phase === 'play'
        ? 'run'
        : 'idle';
    if (this.player.anims.currentAnim?.key !== key) this.player.play(key);
  }

  private scrollBackground() {
    const x = this.cameras.main.scrollX;
    this.bg.stars.tilePositionX = x * 0.04;
    this.bg.mountains.tilePositionX = x * 0.12;
    this.bg.hills.tilePositionX = x * 0.3;
  }

  // ── Events ───────────────────────────────────────────────────────────

  private collect(index: number, x: number, y: number) {
    this.found.add(index);
    const ever = new Set([...(save.fragments[VERSE.id] ?? []), index]);
    save.fragments[VERSE.id] = [...ever].sort();
    persist();
    sound.collect();
    this.burst(x, y, 0xffd66b);
    bus.emit('fragment', { index });
    bus.emit('toast', { text: `„${VERSE.fragments[index - 1]}“`, ref: `Fragment ${this.found.size} von ${VERSE.fragments.length}` });
    this.emitHud();
  }

  private pickUpSheep() {
    if (this.carrying || this.phase !== 'play') return;
    this.carrying = true;
    this.tweens.killTweensOf(this.sheep);
    this.sheep.setVisible(false);
    (this.sheepZone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.carried.setVisible(true);
    this.bubble.setVisible(false);
    this.burst(this.player.x, this.player.y - 8, 0xfff6cf);
    sound.pickup();
    sound.music('carry');
    bus.emit('toast', { text: QUOTES.carry.text, ref: QUOTES.carry.ref, ms: 5000 });
    this.time.delayedCall(5600, () =>
      this.hint('carry', 'Mit dem Schaf auf den Schultern springst du nicht mehr so hoch. Gibt es einen anderen Weg nach Hause?', undefined, 6000),
    );
    this.emitHud();
  }

  private touchGate() {
    if (this.gateOpen) return;
    if (this.player.x < this.level.gate[0].tx * TILE) {
      this.hint('gate-locked', 'Das Gatter ist verriegelt – von der anderen Seite.');
      return;
    }
    this.gateOpen = true;
    sound.gate();
    this.gate.getChildren().forEach((g) => ((g.body as Phaser.Physics.Arcade.StaticBody).enable = false));
    // swings open on its left hinges; seen edge-on it becomes a narrow strip
    this.tweens.add({ targets: this.gateImage, scaleX: 0.2, duration: 450, ease: 'Back.out' });
    this.gateImage.setTint(0xb0a090);
    this.hint('gate-open', 'Das Gatter lässt sich von innen öffnen. Fast zu Hause!');
  }

  private rest(well: Well, p: { x: number; y: number }) {
    if (well.active || this.phase !== 'play') return;
    this.wells.forEach((w) => {
      w.active = false;
      w.sprite.setFrame(0);
      w.glow.setAlpha(0);
    });
    well.active = true;
    well.sprite.setFrame(1);
    this.tweens.add({ targets: well.glow, alpha: { from: 0.2, to: 0.9 }, duration: 900, yoyo: true, repeat: -1 });
    this.checkpoint = p;
    sound.rest();
    if (!save.seenRestQuote) {
      save.seenRestQuote = true;
      persist();
      bus.emit('toast', { text: QUOTES.rest.text, ref: `${QUOTES.rest.ref} · Rastplatz`, ms: 5500 });
    }
  }

  private die() {
    if (this.phase !== 'play' || this.invulnerable > 0) return;
    this.phase = 'dying';
    sound.hurt();
    this.player.setTint(0xff7070).play('fall');
    this.pbody.setVelocity(0, -140);
    this.cameras.main.shake(140, 0.006);
    this.time.delayedCall(420, () => {
      this.cameras.main.fadeOut(160, 20, 12, 30);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.respawn();
        this.cameras.main.fadeIn(220, 20, 12, 30);
      });
    });
  }

  private respawn() {
    this.player.clearTint();
    this.pbody.reset(this.checkpoint.x, this.checkpoint.y);
    this.invulnerable = 0.6;
    this.phase = 'play';
  }

  private celebrate() {
    this.phase = 'celebrate';
    this.pbody.setVelocity(0, 0);
    this.facing = -1;
    this.carrying = false;
    this.carried.setVisible(false);
    sound.music(null);
    sound.fanfare();
    this.emitHud();

    // the sheep hops back into the herd
    const home = this.level.herd[this.level.herd.length - 1];
    const s = this.add.sprite(this.player.x, this.player.y - 6, 'sheep', 0).setDepth(7).setFlipX(true);
    const targetX = home.tx * TILE + 8 + 10;
    const groundY = (home.ty + 1) * TILE - 6;
    this.tweens.add({ targets: s, x: targetX, duration: 1100, ease: 'Linear' });
    this.tweens.add({ targets: s, y: { from: groundY - 4, to: groundY - 14 }, duration: 180, yoyo: true, repeat: 2, onComplete: () => s.setY(groundY) });
    this.time.delayedCall(1300, () => sound.bleat(0, 0.14));

    this.neighbours.forEach((n, i) => {
      this.tweens.add({ targets: n, alpha: 1, duration: 500, delay: 300 + i * 200 });
      this.tweens.add({ targets: n, y: n.y - 6, duration: 220, yoyo: true, repeat: -1, delay: 700 + i * 160, ease: 'Quad.out' });
    });

    const fold = tileCenter(this.level.home[0]);
    const notes = this.add.particles(fold.x - 24, fold.y - 20, 'note', {
      x: { min: -40, max: 40 },
      speedY: { min: -40, max: -18 },
      speedX: { min: -10, max: 10 },
      lifespan: 1800,
      alpha: { start: 1, end: 0 },
      frequency: 160,
    });
    notes.setDepth(20);
    this.time.delayedCall(2600, () => notes.stop());

    bus.emit('toast', { text: 'Hundert von hundert. Alle sind wieder da.', ms: 3600 });
    this.time.delayedCall(4200, () => {
      this.phase = 'done';
      bus.emit('levelComplete', { fragments: save.fragments[VERSE.id] ?? [] });
    });
  }

  private bleat() {
    if (this.phase !== 'play' || this.carrying) return;
    const cam = this.cameras.main;
    const dx = this.sheep.x - this.player.x;
    const dist = Math.hypot(dx, this.sheep.y - this.player.y);
    sound.bleat(Phaser.Math.Clamp(dx / 320, -1, 1), Phaser.Math.Clamp(0.22 - dist / 3200, 0.04, 0.22));
    this.sheep.setFrame(1);
    this.time.delayedCall(650, () => this.sheep.setFrame(0));

    // In view: a bubble over the sheep. Out of view: the bubble sits on the screen
    // edge in the sheep's direction, so you can follow the sound.
    const sx = this.sheep.x - cam.scrollX;
    const sy = this.sheep.y - cam.scrollY;
    const inView = sx > 0 && sx < cam.width && sy > 0 && sy < cam.height;
    this.bubble
      .setScrollFactor(0)
      .setPosition(
        inView ? sx + 2 : Phaser.Math.Clamp(sx, 10, cam.width - 10),
        inView ? sy - 16 : Phaser.Math.Clamp(sy, 14, cam.height - 14),
      )
      .setVisible(true)
      .setAlpha(inView ? 1 : Phaser.Math.Clamp(1.2 - dist / 2400, 0.45, 1))
      .setScale(1);
    this.tweens.killTweensOf(this.bubble);
    this.tweens.add({ targets: this.bubble, scale: 1.25, duration: 160, yoyo: true, repeat: 1 });
    this.time.delayedCall(1300, () => this.bubble.setVisible(false));
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private burst(x: number, y: number, tint: number) {
    const p = this.add.particles(x, y, 'dot', {
      speed: { min: 30, max: 90 },
      lifespan: 520,
      scale: { start: 1, end: 0 },
      tint,
      emitting: false,
    });
    p.setDepth(20);
    p.explode(16);
    this.time.delayedCall(800, () => p.destroy());
  }

  private hint(id: string, text: string, ref?: string, ms?: number) {
    if (this.hints.has(id)) return;
    this.hints.add(id);
    bus.emit('toast', { text, ref, ms });
  }

  private emitHud() {
    bus.emit('hud', {
      sheep: this.phase === 'celebrate' || this.phase === 'done' ? HERD_SIZE : HERD_SIZE - 1,
      herd: HERD_SIZE,
      fragments: this.found.size,
      totalFragments: VERSE.fragments.length,
    });
  }

  /** Test helpers: ?dev&at=140,20 starts at a tile, &carry with the sheep, &bodies shows hitboxes. */
  private devSetup(params: URLSearchParams) {
    if (params.has('bodies')) this.physics.world.createDebugGraphic();
    const at = params.get('at')?.split(',').map(Number);
    if (at && at.length === 2) {
      const p = standing({ tx: at[0], ty: at[1] });
      this.pbody.reset(p.x, p.y);
      this.checkpoint = p;
    }
    if (params.has('carry')) {
      this.carrying = true;
      this.sheep.setVisible(false);
      (this.sheepZone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.carried.setVisible(true);
    }
    (window as unknown as { scene: GameScene }).scene = this;
  }
}
