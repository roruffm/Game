// 2D simplex noise (after Stefan Gustavson's public-domain reference) and a curl field built on it.
// Curl noise is divergence-free, so particles swirl like water instead of bunching up.

const GRAD = [
  [1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export class Noise {
  private perm = new Uint8Array(512);

  constructor(seed = 1) {
    const p = new Uint8Array(256).map((_, i) => i);
    let s = seed >>> 0 || 1;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** Simplex noise in [-1, 1]. */
  get(x: number, y: number): number {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const corner = (gx: number, gy: number, g: number) => {
      const tt = 0.5 - gx * gx - gy * gy;
      if (tt < 0) return 0;
      const grad = GRAD[g % 8];
      return tt * tt * tt * tt * (grad[0] * gx + grad[1] * gy);
    };
    const n =
      corner(x0, y0, this.perm[ii + this.perm[jj]]) +
      corner(x1, y1, this.perm[ii + i1 + this.perm[jj + j1]]) +
      corner(x2, y2, this.perm[ii + 1 + this.perm[jj + 1]]);
    return 70 * n;
  }

  /** Divergence-free flow direction at (x, y); scale sets the size of the eddies. */
  curl(x: number, y: number, scale: number, time = 0): { x: number; y: number } {
    const e = 0.5;
    const sx = x / scale + time;
    const sy = y / scale - time * 0.7;
    const dx = (this.get(sx + e, sy) - this.get(sx - e, sy)) / (2 * e);
    const dy = (this.get(sx, sy + e) - this.get(sx, sy - e)) / (2 * e);
    return { x: dy, y: -dx };
  }
}

export const noise = new Noise(7);
