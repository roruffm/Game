import { describe, expect, it } from 'vitest';
import { catchCurrent, Current, placeWords, RIDE, rideSpeed, threadCurve, ThreadPath } from '../src/world/ride';

const straight = () => new ThreadPath([
  { x: 0, y: 0 },
  { x: 500, y: 0 },
  { x: 1000, y: 0 },
]);

/** Moves a point the way the organism eases towards the wanted velocity. */
function simulate(current: Current, start: { x: number; y: number }, input = { x: 0, y: 0 }, seconds = 20) {
  const pos = { ...start };
  const vel = { x: 0, y: 0 };
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt) {
    const step = current.step(dt, pos, input);
    if (step.arrived || step.released) return { ...step, pos, t };
    const k = 1 - Math.exp(-dt * 1.9);
    vel.x += (step.want.x - vel.x) * k;
    vel.y += (step.want.y - vel.y) * k;
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
  }
  return { arrived: false, released: false, pos, t: seconds, offset: 0, want: vel };
}

describe('thread paths', () => {
  it('measure, sample and project', () => {
    const p = straight();
    expect(p.length).toBe(1000);
    expect(p.at(250)).toMatchObject({ x: 250, y: 0, tx: 1, ty: 0 });
    const q = p.project(600, 30);
    expect(q.s).toBeCloseTo(600);
    expect(q.dist).toBeCloseTo(30);
    // y grows downwards on screen: below a rightward path is its right-hand side
    expect(q.side).toBeGreaterThan(0);
    expect(p.project(600, -30).side).toBeLessThan(0);
  });

  it('can be reversed', () => {
    const p = straight().reversed();
    expect(p.start).toEqual({ x: 1000, y: 0 });
    expect(p.at(0).tx).toBe(-1);
    expect(p.length).toBe(1000);
  });

  it('follow the drawn curve', () => {
    const { a, b, c } = threadCurve({ x: 0, y: 0 }, { x: 1000, y: 0 }, 42);
    const p = ThreadPath.fromCurve(a, c, b);
    expect(p.start).toEqual(a);
    expect(p.end).toEqual(b);
    expect(p.length).toBeGreaterThanOrEqual(1000);
  });
});

describe('the current', () => {
  it('flows faster on stronger cross-references, within bounds', () => {
    expect(rideSpeed(0)).toBe(300);
    expect(rideSpeed(10)).toBeGreaterThan(rideSpeed(4));
    expect(rideSpeed(10_000)).toBe(640);
  });

  it('carries the organism to the end without any steering', () => {
    const end = simulate(new Current(straight(), 400), { x: 0, y: 10 });
    expect(end.arrived).toBe(true);
    expect(end.pos.x).toBeGreaterThan(1000 - RIDE.arrive - 20);
    expect(Math.abs(end.pos.y)).toBeLessThan(RIDE.band);
  });

  it('lets go when the player steers out sideways', () => {
    const end = simulate(new Current(new ThreadPath([{ x: 0, y: 0 }, { x: 6000, y: 0 }]), 400), { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(end.released).toBe(true);
    expect(end.pos.y).toBeGreaterThan(RIDE.release - 1);
  });

  it('lets go when the player pushes hard against it', () => {
    const end = simulate(new Current(new ThreadPath([{ x: 0, y: 0 }, { x: 6000, y: 0 }]), 400), { x: 0, y: 0 }, { x: -1, y: 0 });
    expect(end.released).toBe(true);
    expect(end.t).toBeLessThan(1.5);
  });

  it('never pulls back', () => {
    const c = new Current(straight(), 400, 600);
    c.step(1 / 30, { x: 200, y: 0 }, { x: 0, y: 0 });
    expect(c.s).toBe(600);
  });
});

describe('being caught', () => {
  const p = straight();
  it('needs to be close, fast and moving along the thread', () => {
    expect(catchCurrent(p, { x: 300, y: 10 }, { x: 200, y: 20 }, true)).toEqual({ s: 300, dir: 1 });
    expect(catchCurrent(p, { x: 300, y: 80 }, { x: 200, y: 0 }, true)).toBeNull();
    expect(catchCurrent(p, { x: 300, y: 10 }, { x: 40, y: 0 }, true)).toBeNull();
    expect(catchCurrent(p, { x: 300, y: 10 }, { x: 0, y: 200 }, true)).toBeNull();
    expect(catchCurrent(p, { x: 950, y: 0 }, { x: 200, y: 0 }, true)).toBeNull();
  });

  it('runs backwards only where the thread allows it', () => {
    expect(catchCurrent(p, { x: 300, y: 0 }, { x: -200, y: 0 }, true)).toBeNull();
    expect(catchCurrent(p, { x: 300, y: 0 }, { x: -200, y: 0 }, false)).toEqual({ s: 700, dir: -1 });
  });
});

describe('words along the way', () => {
  it('spread evenly, in reading order, alternating sides', () => {
    const words = placeWords(10, 100, 900);
    expect(words).toHaveLength(10);
    expect(words.map((w) => w.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(words[0].s).toBe(100);
    expect(words[9].s).toBe(900);
    expect(words.some((w) => w.offset > 20) && words.some((w) => w.offset < -20)).toBe(true);
  });

  it('sample long verses and keep their first and last word', () => {
    const words = placeWords(80, 0, 3000);
    expect(words).toHaveLength(30);
    expect(words[0].index).toBe(0);
    expect(words[29].index).toBe(79);
  });

  it('fit short threads, or stay away from very short ones', () => {
    expect(placeWords(20, 0, 200)).toHaveLength(5);
    expect(placeWords(20, 0, 30)).toEqual([]);
    expect(placeWords(0, 0, 900)).toEqual([]);
  });
});
