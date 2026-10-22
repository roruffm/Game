// Soft light textures, painted once on canvases. Everything glowing in the game is built from these.

import { Texture } from 'pixi.js';

export interface Textures {
  glow: Texture;
  core: Texture;
  dot: Texture;
  ring: Texture;
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
  cache = { glow, core, dot, ring };
  return cache;
}
