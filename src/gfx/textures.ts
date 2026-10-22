// Builds every texture at start-up from the pixel art in sprites.ts and from
// small procedural painters for terrain and sky. No image files are loaded.

import Phaser from 'phaser';
import {
  BUBBLE,
  BUSH,
  CARRIED_SHEEP,
  FRAGMENT,
  NEIGHBOUR_FRAMES,
  NEIGHBOUR_PALETTES,
  NOTE,
  PALETTE,
  SHEEP_FRAMES,
  SHEPHERD_FRAMES,
  THORNS,
  WELL_FRAMES,
  WOOL_TUFT,
  drawPixels,
  validate,
  type Pixels,
} from './sprites';

export const TILE_EARTH = 0;
export const TILE_ROCK = 48;
export const TILE_LEDGE = 96;
/** Exposed sides of a solid tile. */
export const EDGE = { top: 1, right: 2, bottom: 4, left: 8 } as const;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

/** Small deterministic random generator so the world looks the same every time. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function addSheet(scene: Phaser.Scene, key: string, frames: Pixels[], palette = PALETTE) {
  frames.forEach((f, i) => validate(`${key}[${i}]`, f));
  const w = frames[0][0].length;
  const h = frames[0].length;
  const { c, ctx } = canvas(w * frames.length, h);
  frames.forEach((f, i) => drawPixels(ctx, f, i * w, 0, { ...PALETTE, ...palette }));
  const tex = scene.textures.addCanvas(key, c)!;
  frames.forEach((_, i) => tex.add(i, 0, i * w, 0, w, h));
}

function addImage(scene: Phaser.Scene, key: string, px: Pixels) {
  addSheet(scene, key, [px]);
}

/** Dark outline on the left, right and bottom sides that face open air. */
function paintSides(ctx: CanvasRenderingContext2D, ox: number, mask: number, color: string) {
  ctx.fillStyle = color;
  if (mask & EDGE.left) ctx.fillRect(ox, 0, 1, 16);
  if (mask & EDGE.right) ctx.fillRect(ox + 15, 0, 1, 16);
  if (mask & EDGE.bottom) ctx.fillRect(ox, 15, 16, 1);
}

function paintEarth(ctx: CanvasRenderingContext2D, ox: number, mask: number, r: () => number) {
  const base = ['#a46d42', '#9a663d', '#ad7547', '#94603a'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = base[Math.floor(r() * base.length)];
      ctx.fillRect(ox + x, y, 1, 1);
    }
  }
  // pebbles and darker specks
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(r() * 14);
    const y = Math.floor(r() * 14);
    ctx.fillStyle = r() < 0.5 ? '#c4935f' : '#7a4e30';
    ctx.fillRect(ox + x, y, r() < 0.5 ? 2 : 1, 1);
  }
  paintSides(ctx, ox, mask, '#5e3d26');
  if (mask & EDGE.top) {
    for (let x = 0; x < 16; x++) {
      const h = 3 + (r() < 0.35 ? 1 : 0);
      ctx.fillStyle = '#a7bb5c';
      ctx.fillRect(ox + x, 0, 1, 1);
      ctx.fillStyle = '#7d9440';
      ctx.fillRect(ox + x, 1, 1, h - 2);
      ctx.fillStyle = '#56692c';
      ctx.fillRect(ox + x, h - 1, 1, 1);
    }
    if (mask & EDGE.left) ctx.clearRect(ox, 0, 1, 1);
    if (mask & EDGE.right) ctx.clearRect(ox + 15, 0, 1, 1);
  }
}

function paintRock(ctx: CanvasRenderingContext2D, ox: number, mask: number, r: () => number, seed: number) {
  const base = ['#5a5470', '#56506b', '#5f5976'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = base[Math.floor(r() * base.length)];
      ctx.fillRect(ox + x, y, 1, 1);
    }
  }
  // stone blocks: a horizontal seam and a vertical joint, offset per variant
  const seam = 7 + (seed % 3);
  ctx.fillStyle = '#433e56';
  ctx.fillRect(ox, seam, 16, 1);
  const j1 = 3 + Math.floor(r() * 9);
  const j2 = 2 + Math.floor(r() * 11);
  ctx.fillRect(ox + j1, 0, 1, seam);
  ctx.fillRect(ox + j2, seam, 1, 16 - seam);
  ctx.fillStyle = '#6c6585';
  ctx.fillRect(ox, seam + 1, 16, 1);
  if (mask & EDGE.top) {
    ctx.fillStyle = '#958eae';
    ctx.fillRect(ox, 0, 16, 1);
    ctx.fillStyle = '#77708f';
    ctx.fillRect(ox, 1, 16, 1);
  }
  paintSides(ctx, ox, mask, '#2f2b3d');
  if (mask & EDGE.top && mask & EDGE.left) ctx.clearRect(ox, 0, 1, 1);
  if (mask & EDGE.top && mask & EDGE.right) ctx.clearRect(ox + 15, 0, 1, 1);
}

function paintLedge(ctx: CanvasRenderingContext2D, ox: number, oy: number, kind: number) {
  // kind: 0 left end, 1 middle, 2 right end, 3 single
  const rows = ['#958eae', '#6c6585', '#6c6585', '#5a5470', '#433e56', '#2f2b3d'];
  rows.forEach((col, y) => {
    ctx.fillStyle = col;
    ctx.fillRect(ox, oy + y, 16, 1);
  });
  for (const [end, x] of [[0, ox], [2, ox + 15]]) {
    if (kind === end || kind === 3) {
      ctx.clearRect(x, oy, 1, 1);
      ctx.clearRect(x, oy + 5, 1, 1);
    }
  }
}

function makeTileset(scene: Phaser.Scene) {
  const { c, ctx } = canvas(16 * 16, 16 * 7);
  for (let mask = 0; mask < 16; mask++) {
    for (let v = 0; v < 3; v++) {
      const ie = TILE_EARTH + mask * 3 + v;
      const ir = TILE_ROCK + mask * 3 + v;
      ctx.save();
      ctx.translate(0, Math.floor(ie / 16) * 16);
      paintEarth(ctx, (ie % 16) * 16, mask, rng(1000 + mask * 7 + v * 131));
      ctx.restore();
      ctx.save();
      ctx.translate(0, Math.floor(ir / 16) * 16);
      paintRock(ctx, (ir % 16) * 16, mask, rng(5000 + mask * 11 + v * 197), v);
      ctx.restore();
    }
  }
  for (let k = 0; k < 4; k++) {
    const i = TILE_LEDGE + k;
    paintLedge(ctx, (i % 16) * 16, Math.floor(i / 16) * 16, k);
  }
  scene.textures.addCanvas('tiles', c);
}

function makeCaveTiles(scene: Phaser.Scene) {
  const { c, ctx } = canvas(16 * 4, 16);
  for (let v = 0; v < 4; v++) {
    const r = rng(9000 + v * 31);
    const base = ['#2a2236', '#262032', '#2d2539'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = base[Math.floor(r() * base.length)];
        ctx.fillRect(v * 16 + x, y, 1, 1);
      }
    }
    ctx.fillStyle = '#1f1a29';
    const seam = 5 + v * 2;
    ctx.fillRect(v * 16, seam, 16, 1);
    ctx.fillRect(v * 16 + 4 + v * 2, 0, 1, seam);
  }
  scene.textures.addCanvas('cave', c);
}

function makeSky(scene: Phaser.Scene) {
  const h = 360;
  const { c, ctx } = canvas(64, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0f0c22');
  g.addColorStop(0.25, '#211943');
  g.addColorStop(0.4, '#43285c');
  g.addColorStop(0.49, '#8e4562');
  g.addColorStop(0.54, '#d77c50');
  g.addColorStop(0.6, '#3a2448');
  g.addColorStop(1, '#170f26');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, h);
  scene.textures.addCanvas('sky', c);

  const stars = canvas(256, 140);
  const r = rng(77);
  for (let i = 0; i < 70; i++) {
    const a = r();
    stars.ctx.fillStyle = a < 0.15 ? '#fff6cf' : a < 0.5 ? '#c9c2e8' : '#7d74a8';
    stars.ctx.fillRect(Math.floor(r() * 256), Math.floor(r() * 140 * r()), 1, 1);
  }
  scene.textures.addCanvas('stars', stars.c);

  const moon = canvas(14, 14);
  moon.ctx.fillStyle = '#f6e7b8';
  moon.ctx.beginPath();
  moon.ctx.arc(7, 7, 6, 0, Math.PI * 2);
  moon.ctx.fill();
  moon.ctx.globalCompositeOperation = 'destination-out';
  moon.ctx.beginPath();
  moon.ctx.arc(10, 5, 6, 0, Math.PI * 2);
  moon.ctx.fill();
  scene.textures.addCanvas('moon', moon.c);
}

/** A seamless ridge line: the sum of sines whose periods divide the width. */
function ridge(width: number, seed: number, amps: number[]) {
  const r = rng(seed);
  const phases = amps.map(() => r() * Math.PI * 2);
  return (x: number) =>
    amps.reduce((sum, a, i) => sum + a * Math.sin(((x / width) * Math.PI * 2 * (i + 1) * 2) + phases[i]), 0);
}

function makeMountains(scene: Phaser.Scene) {
  const W = 256;
  const far = canvas(W, 96);
  const f = ridge(W, 3, [14, 7, 4, 2]);
  for (let x = 0; x < W; x++) {
    const top = Math.round(44 + f(x));
    far.ctx.fillStyle = '#3a2453';
    far.ctx.fillRect(x, top, 1, 96 - top);
    far.ctx.fillStyle = '#5a3466';
    far.ctx.fillRect(x, top, 1, 1);
  }
  scene.textures.addCanvas('mountains', far.c);

  const near = canvas(W, 200);
  const n = ridge(W, 11, [6, 5, 3]);
  const r = rng(19);
  for (let x = 0; x < W; x++) {
    const top = Math.round(40 + n(x));
    near.ctx.fillStyle = '#251838';
    near.ctx.fillRect(x, top, 1, 200 - top);
  }
  // olive trees on the near hills
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(r() * (W - 12)) + 6;
    const top = Math.round(40 + n(x));
    near.ctx.fillStyle = '#251838';
    near.ctx.fillRect(x, top - 4, 1, 4);
    near.ctx.beginPath();
    near.ctx.ellipse(x + 0.5, top - 7, 5, 3.5, 0, 0, Math.PI * 2);
    near.ctx.fill();
  }
  scene.textures.addCanvas('hills', near.c);
}

/** A wooden gate the height of `tiles` tiles, with its latch on the right (inside). */
export function makeGate(scene: Phaser.Scene, tiles: number) {
  const key = `gate${tiles}`;
  if (scene.textures.exists(key)) return key;
  const h = tiles * 16;
  const { c, ctx } = canvas(16, h);
  const rect = (col: string, x: number, y: number, w: number, hh: number) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, hh);
  };
  // planks with pointed tops
  for (const x of [1, 6, 11]) {
    rect('#1c1424', x - 1, 2, 5, h - 2);
    rect('#8a5a2e', x, 3, 3, h - 4);
    rect('#a8784a', x, 3, 1, h - 4);
    rect('#1c1424', x, 1, 3, 1);
    rect('#1c1424', x + 1, 0, 1, 1);
  }
  // rails and a diagonal brace
  for (const y of [6, h - 11]) {
    rect('#1c1424', 0, y - 1, 16, 5);
    rect('#6b4a2a', 0, y, 16, 3);
    rect('#8a5a2e', 0, y, 16, 1);
  }
  const top = 9;
  const bottom = h - 12;
  for (let y = top; y <= bottom; y++) {
    const x = Math.round(14 - ((y - top) / (bottom - top)) * 13);
    rect('#1c1424', x - 1, y, 4, 1);
    rect('#6b4a2a', x, y, 2, 1);
  }
  // hinges (left) and latch (right)
  for (const y of [6, h - 11]) rect('#3a3549', 0, y, 2, 3);
  rect('#1c1424', 12, Math.floor(h / 2) - 2, 4, 5);
  rect('#8a8396', 13, Math.floor(h / 2) - 1, 3, 3);
  scene.textures.addCanvas(key, c);
  return key;
}

function makeGlow(scene: Phaser.Scene) {
  const size = 96;
  const { c, ctx } = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,240,200,0.55)');
  g.addColorStop(0.4, 'rgba(255,214,107,0.18)');
  g.addColorStop(1, 'rgba(255,214,107,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  scene.textures.addCanvas('glow', c);

  const dot = canvas(2, 2);
  dot.ctx.fillStyle = '#ffffff';
  dot.ctx.fillRect(0, 0, 2, 2);
  scene.textures.addCanvas('dot', dot.c);
}

export function createTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('tiles')) return;
  addSheet(scene, 'shepherd', SHEPHERD_FRAMES);
  NEIGHBOUR_PALETTES.forEach((p, i) => addSheet(scene, `neighbour${i}`, NEIGHBOUR_FRAMES, p));
  addSheet(scene, 'sheep', SHEEP_FRAMES);
  addSheet(scene, 'well', WELL_FRAMES);
  addImage(scene, 'carried', CARRIED_SHEEP);
  addImage(scene, 'fragment', FRAGMENT);
  addImage(scene, 'thorns', THORNS);
  addImage(scene, 'bush', BUSH);
  addImage(scene, 'wool', WOOL_TUFT);
  addImage(scene, 'bubble', BUBBLE);
  addImage(scene, 'note', NOTE);
  makeTileset(scene);
  makeCaveTiles(scene);
  makeSky(scene);
  makeMountains(scene);
  makeGlow(scene);
}
