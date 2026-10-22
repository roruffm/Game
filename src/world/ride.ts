// Riding a thread of light: the curve between two passages becomes a current that carries the
// organism along it. This file holds only geometry and motion, so it can be tested without
// graphics; the world scene draws the ride and the director supplies the verse.

import type { Range } from '../bible/bible';
import type { Panel } from '../state/store';
import type { XLink } from '../xref/crossrefs';

export interface Point {
  x: number;
  y: number;
}

export const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** The gently bent curve of a thread (a quadratic Bézier); drawing and riding share it. */
export function threadCurve(a: Point, b: Point, seed: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const bend = (hash(seed) - 0.5) * 0.5;
  return { a, b, c: { x: (a.x + b.x) / 2 - dy * bend, y: (a.y + b.y) / 2 + dx * bend } };
}

export function bezier(a: Point, c: Point, b: Point, k: number): Point {
  const u = 1 - k;
  return { x: u * u * a.x + 2 * u * k * c.x + k * k * b.x, y: u * u * a.y + 2 * u * k * c.y + k * k * b.y };
}

/** A curve sampled into a polyline, measured by arc length. */
export class ThreadPath {
  readonly lens: number[] = [0];
  readonly length: number;

  constructor(readonly pts: Point[]) {
    for (let i = 1; i < pts.length; i++) this.lens.push(this.lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    this.length = this.lens[this.lens.length - 1] || 1;
  }

  static fromCurve(a: Point, c: Point, b: Point, samples = 32) {
    return new ThreadPath(Array.from({ length: samples + 1 }, (_, i) => bezier(a, c, b, i / samples)));
  }

  reversed() {
    return new ThreadPath([...this.pts].reverse());
  }

  get start() {
    return this.pts[0];
  }

  get end() {
    return this.pts[this.pts.length - 1];
  }

  /** Point and unit tangent at arc length s. */
  at(s: number) {
    const d = Math.max(0, Math.min(this.length, s));
    let i = 1;
    while (i < this.pts.length - 1 && this.lens[i] < d) i++;
    const a = this.pts[i - 1];
    const b = this.pts[i];
    const seg = this.lens[i] - this.lens[i - 1] || 1;
    const k = (d - this.lens[i - 1]) / seg;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, tx: (b.x - a.x) / seg, ty: (b.y - a.y) / seg };
  }

  /** Nearest point on the path: arc length, distance, and signed offset (on screen, positive is right of travel). */
  project(x: number, y: number) {
    let best = { s: 0, dist: Infinity, side: 0 };
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const len2 = vx * vx + vy * vy || 1;
      const k = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / len2));
      const px = a.x + vx * k;
      const py = a.y + vy * k;
      const dist = Math.hypot(x - px, y - py);
      if (dist < best.dist) {
        const len = Math.sqrt(len2);
        best = { s: this.lens[i - 1] + k * len, dist, side: ((x - px) * -vy + (y - py) * vx) / len };
      }
    }
    return best;
  }

  /** Bounding box, grown by a margin. */
  bounds(margin = 0) {
    const xs = this.pts.map((p) => p.x);
    const ys = this.pts.map((p) => p.y);
    return { x0: Math.min(...xs) - margin, y0: Math.min(...ys) - margin, x1: Math.max(...xs) + margin, y1: Math.max(...ys) + margin };
  }
}

export const RIDE = {
  /** Half-width of the lane in which the current lets the organism drift freely. */
  band: 34,
  /** Lateral offset at which the organism has left the current. */
  release: 125,
  /** How close to the thread, how fast and how well aligned the organism must be to be caught. */
  catchDistance: 36,
  catchSpeed: 90,
  catchAlign: 0.8,
  /** No catching right before the end of a thread. */
  catchMargin: 160,
  /** The current slows down over this distance before the end. */
  slowDown: 240,
  /** Distance from the end that counts as arrived. */
  arrive: 46,
  /** Words are caught within this radius. */
  wordReach: 36,
};

/** Stronger cross-references (more votes) flow faster. */
export const rideSpeed = (votes: number) => Math.max(300, Math.min(640, 250 + 70 * Math.log2(1 + Math.max(0, votes))));

export interface RideStep {
  /** The velocity the organism should take on (world units per second). */
  want: Point;
  arrived: boolean;
  released: boolean;
  /** Signed distance from the middle of the current. */
  offset: number;
}

/** The current along one thread, in the direction of travel. */
export class Current {
  /** Progress along the path; it only grows, the current never pulls back. */
  s: number;
  private against = 0;

  constructor(
    readonly path: ThreadPath,
    readonly speed: number,
    s = 0,
  ) {
    this.s = s;
  }

  /** `input` is the player's steering: unit direction times thrust (zero when not steering). */
  step(dt: number, pos: Point, input: Point): RideStep {
    const p = this.path.project(pos.x, pos.y);
    this.s = Math.max(this.s, p.s);
    const q = this.path.at(this.s);
    const nx = -q.ty;
    const ny = q.tx;
    const along = input.x * q.tx + input.y * q.ty;
    const lateral = input.x * nx + input.y * ny;
    // steering hard against the current for a moment lets go of it
    this.against = along < -0.7 ? this.against + dt : 0;
    const still = { x: 0, y: 0 };
    if (this.path.length - this.s < RIDE.arrive) return { want: still, arrived: true, released: false, offset: p.side };
    if (Math.abs(p.side) > RIDE.release || this.against > 0.7) return { want: still, arrived: false, released: true, offset: p.side };
    const slow = Math.min(1, (this.path.length - this.s) / RIDE.slowDown);
    const v = this.speed * (1 + 0.3 * Math.max(-1, Math.min(1, along))) * (0.3 + 0.7 * slow);
    // free inside the lane, drawn back softly beyond it
    const spring = Math.abs(p.side) > RIDE.band ? -(p.side - Math.sign(p.side) * RIDE.band) * 2 : 0;
    const side = lateral * 240 + spring;
    return { want: { x: q.tx * v + nx * side, y: q.ty * v + ny * side }, arrived: false, released: false, offset: p.side };
  }
}

/**
 * Whether a thread catches the organism: close to it, fast enough and moving along it.
 * Returns where on the path (in the direction of travel) the ride begins.
 */
export function catchCurrent(path: ThreadPath, pos: Point, vel: Point, forwardOnly: boolean): { s: number; dir: 1 | -1 } | null {
  const speed = Math.hypot(vel.x, vel.y);
  if (speed < RIDE.catchSpeed) return null;
  const p = path.project(pos.x, pos.y);
  if (p.dist > RIDE.catchDistance) return null;
  const q = path.at(p.s);
  const align = (vel.x * q.tx + vel.y * q.ty) / speed;
  if (align > RIDE.catchAlign && p.s < path.length - RIDE.catchMargin) return { s: p.s, dir: 1 };
  if (!forwardOnly && align < -RIDE.catchAlign && p.s > RIDE.catchMargin) return { s: path.length - p.s, dir: -1 };
  return null;
}

export interface PlacedWord {
  /** Index into the verse's words. */
  index: number;
  /** Arc length along the path. */
  s: number;
  /** Sideways offset from the middle of the current. */
  offset: number;
}

/**
 * Spreads words of a verse along a stretch of the path, alternating left and right of the
 * middle so that catching them takes a little steering. Long verses are sampled evenly.
 */
export function placeWords(count: number, from: number, to: number, max = 30, gap = 46): PlacedWord[] {
  if (count <= 0 || to - from < gap) return [];
  const n = Math.min(count, max, Math.floor((to - from) / gap) + 1);
  return Array.from({ length: n }, (_, k) => ({
    index: n === 1 ? 0 : Math.round((k * (count - 1)) / (n - 1)),
    s: n === 1 ? (from + to) / 2 : from + ((to - from) * k) / (n - 1),
    offset: Math.sin(k * 1.9 + 0.6) * 48,
  }));
}

/** What a ride leads to: the cross-reference and the verse it flows into. */
export interface RideInfo {
  link: XLink;
  /** The linked passage in the target chapter (what becomes discovered). */
  target: Range;
  /** The verses the words come from: the target, shortened when it is long. */
  shown: Range;
  words: string[];
  /** e.g. "Psalm 107,29" */
  label: string;
  /** German verse number, when it differs, e.g. "dt. 107,29". */
  note?: string;
  truncated: boolean;
  /** The link in the dataset's own direction, e.g. "Markus 4,39 → Psalm 107,29". */
  linkLabel: string;
  votes: number;
  panel: Panel;
}
