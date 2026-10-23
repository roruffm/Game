// Soft light textures, painted once on canvases. Everything glowing in the game is built from these.

import { Texture } from 'pixi.js';

export interface Textures {
  glow: Texture;
  core: Texture;
  dot: Texture;
  ring: Texture;
  /** A soft, translucent leaf of light (base at the left edge): fins, petals and wings. */
  leaf: Texture;
}

function paint(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  return Texture.from(c);
}

function radial(stops: [number, string][]) {
  return (ctx: CanvasRenderingContext2D, size: number) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  };
}

let cache: Textures | null = null;

export function textures(): Textures {
  if (cache) return cache;
  const glow = paint(
    128,
    radial([
      [0, 'rgba(255,255,255,1)'],
      [0.12, 'rgba(255,255,255,0.75)'],
      [0.35, 'rgba(255,255,255,0.22)'],
      [0.65, 'rgba(255,255,255,0.06)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  const core = paint(
    64,
    radial([
      [0, 'rgba(255,255,255,1)'],
      [0.45, 'rgba(255,255,255,0.9)'],
      [0.7, 'rgba(255,255,255,0.25)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  const dot = paint(
    16,
    radial([
      [0, 'rgba(255,255,255,1)'],
      [0.5, 'rgba(255,255,255,0.5)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  const ring = paint(128, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
  const leaf = paint(128, (ctx, size) => {
    const m = size / 2;
    ctx.filter = 'blur(3px)';
    ctx.beginPath();
    ctx.moveTo(6, m);
    ctx.bezierCurveTo(size * 0.3, m - size * 0.36, size * 0.75, m - size * 0.2, size - 6, m);
    ctx.bezierCurveTo(size * 0.75, m + size * 0.2, size * 0.3, m + size * 0.36, 6, m);
    const g = ctx.createLinearGradient(0, 0, size, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = g;
    ctx.fill();
    // a fine vein of light along the middle
    ctx.filter = 'blur(1px)';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, m);
    ctx.lineTo(size * 0.8, m);
    ctx.stroke();
  });
  cache = { glow, core, dot, ring, leaf };
  return cache;
}
