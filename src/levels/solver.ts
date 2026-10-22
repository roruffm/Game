// A small platformer simulation that explores every place the player can reach.
// Tests use it to prove a level can be finished and has no spot you cannot leave.
// It mirrors the game's movement but deliberately jumps and runs a little weaker
// than the real game, so anything it can reach is reachable by a player too.

import { PHYS, THORN_BOX, TILE } from '../game/physics';
import { isOneWay, isSolid, type LevelData, type TilePoint } from './level';

const DT = 1 / 60;
const MAX_AIR_FRAMES = 360;

export type Goal = 'sheep' | 'home';

export interface SolveOptions {
  carrying: boolean;
  gateOpen: boolean;
  goal: Goal;
  /** Share of the game's jump and run strength the solver may use. */
  strength?: number;
}

export interface SolveResult {
  goalReached: boolean;
  /** Fragment indices touched along any explored path. */
  fragments: Set<number>;
  /** Standing positions (body top-left, px) that can be reached but from which the goal cannot. */
  deadEnds: { x: number; y: number }[];
  nodeCount: number;
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  cut: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const W = PHYS.body.w;
const H = PHYS.body.h;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Body position of the player standing on the tile below the given marker. */
export function standingBodyAt(p: TilePoint): { x: number; y: number } {
  return { x: p.tx * TILE + (TILE - W) / 2, y: (p.ty + 1) * TILE - H };
}

export function solveLevel(level: LevelData, start: TilePoint, opts: SolveOptions): SolveResult {
  const k = opts.strength ?? 0.97;
  const speed = (opts.carrying ? PHYS.carrySpeed : PHYS.runSpeed) * k;
  const jumpV = (opts.carrying ? PHYS.carryJumpVelocity : PHYS.jumpVelocity) * k;
  const gate = new Set(level.gate.map((g) => `${g.tx},${g.ty}`));
  const blocks = (tx: number, ty: number) =>
    isSolid(level, tx, ty) || (!opts.gateOpen && gate.has(`${tx},${ty}`));

  const thornRects: Rect[] = level.thorns.map((t) => ({
    x: t.tx * TILE + THORN_BOX.x,
    y: t.ty * TILE + THORN_BOX.y,
    w: THORN_BOX.w,
    h: THORN_BOX.h,
  }));
  // Small, centred target boxes so the solver never counts a near miss.
  const fragmentRects = level.fragments.map((f) => ({
    index: f.index,
    rect: { x: f.tx * TILE + 4, y: f.ty * TILE + 4, w: 8, h: 8 },
  }));
  const sheepRect = { x: level.sheep.tx * TILE + 3, y: level.sheep.ty * TILE + 6, w: 10, h: 10 };
  const homeRects = level.home.map((h) => ({ x: h.tx * TILE, y: h.ty * TILE, w: TILE, h: TILE }));
  const goalHit = (r: Rect) =>
    opts.goal === 'sheep' ? overlaps(r, sheepRect) : homeRects.some((h) => overlaps(r, h));

  const tileRange = (a: number, len: number) => [
    Math.floor(a / TILE),
    Math.floor((a + len - 1e-6) / TILE),
  ];

  function supported(b: Body): boolean {
    const feet = b.y + H;
    if (Math.abs(feet / TILE - Math.round(feet / TILE)) > 1e-6) return false;
    const ty = Math.round(feet / TILE);
    const [x0, x1] = tileRange(b.x, W);
    for (let tx = x0; tx <= x1; tx++) {
      if (blocks(tx, ty) || isOneWay(level, tx, ty)) return true;
    }
    return false;
  }

  function step(b: Body, dir: number, jumpHeld: boolean) {
    const target = dir * speed;
    const accel = (b.onGround ? PHYS.groundAccel : PHYS.airAccel) * DT;
    b.vx = b.vx < target ? Math.min(target, b.vx + accel) : Math.max(target, b.vx - accel);
    if (!jumpHeld && b.vy < 0 && !b.cut) {
      b.vy *= PHYS.jumpCut;
      b.cut = true;
    }
    b.vy = Math.min(b.vy + PHYS.gravity * DT, PHYS.maxFall);

    b.x += b.vx * DT;
    {
      const [x0, x1] = tileRange(b.x, W);
      const [y0, y1] = tileRange(b.y, H);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (!blocks(tx, ty)) continue;
          if (b.vx > 0) b.x = tx * TILE - W;
          else if (b.vx < 0) b.x = (tx + 1) * TILE;
          b.vx = 0;
        }
      }
    }

    const prevFeet = b.y + H;
    b.y += b.vy * DT;
    b.onGround = false;
    {
      const [x0, x1] = tileRange(b.x, W);
      const [y0, y1] = tileRange(b.y, H);
      if (b.vy > 0) {
        let top = Infinity;
        for (let ty = y0; ty <= y1; ty++) {
          for (let tx = x0; tx <= x1; tx++) {
            const solid = blocks(tx, ty);
            const ledge = isOneWay(level, tx, ty) && prevFeet <= ty * TILE + 0.01;
            if (solid || ledge) top = Math.min(top, ty * TILE);
          }
        }
        if (top < Infinity) {
          b.y = top - H;
          b.vy = 0;
          b.onGround = true;
        }
      } else if (b.vy < 0) {
        for (let ty = y0; ty <= y1; ty++) {
          for (let tx = x0; tx <= x1; tx++) {
            if (blocks(tx, ty)) {
              b.y = (ty + 1) * TILE;
              b.vy = 0;
            }
          }
        }
      }
    }
    if (!b.onGround && b.vy >= 0 && supported(b)) b.onGround = true;
  }

  interface Outcome {
    x: number;
    y: number;
    touches: number[];
    goal: boolean;
  }

  /**
   * Runs one input plan from a standing position: walk for `groundFrames`, jump
   * at `jumpAt` (if any), and follow any fall until the player lands again.
   * Returns where they stand afterwards, or null if they died or never landed.
   */
  function simulate(
    from: { x: number; y: number },
    plan: (frame: number) => { dir: number; jump: boolean },
    groundFrames: number,
    jumpAt: number | null,
  ): Outcome | null {
    const b: Body = { ...from, vx: 0, vy: 0, onGround: true, cut: false };
    const touches = new Set<number>();
    let airborne = false;
    for (let f = 0; f < groundFrames + MAX_AIR_FRAMES; f++) {
      const { dir, jump } = plan(f);
      if (f === jumpAt && b.onGround && !airborne) {
        b.vy = -jumpV;
        b.onGround = false;
      }
      step(b, dir, jump);
      const r = { x: b.x, y: b.y, w: W, h: H };
      if (b.y > level.height * TILE) return null;
      if (thornRects.some((t) => overlaps(r, t))) return null;
      for (const fr of fragmentRects) if (overlaps(r, fr.rect)) touches.add(fr.index);
      const out = { x: b.x, y: b.y, touches: [...touches], goal: goalHit(r) };
      if (out.goal) return out;
      if (!b.onGround) airborne = true;
      else if (airborne) return out;
      else if (jumpAt === null && f >= groundFrames - 1) return out;
    }
    return null;
  }

  type Plan = { plan: (f: number) => { dir: number; jump: boolean }; ground: number; jumpAt: number | null };
  const plans: Plan[] = [];
  for (const d of [-1, 1]) {
    // Walk a few steps; if the ground ends, either keep steering or let go.
    plans.push({ plan: () => ({ dir: d, jump: false }), ground: 8, jumpAt: null });
    plans.push({ plan: (f) => ({ dir: f < 8 ? d : 0, jump: false }), ground: 8, jumpAt: null });
  }
  for (const d of [-1, 0, 1]) {
    for (const runUp of d === 0 ? [0] : [0, 12]) {
      for (const hold of [Infinity, 8, 16, 24, 34]) {
        plans.push({
          plan: (f) => ({ dir: f < runUp + hold ? d : 0, jump: true }),
          ground: runUp,
          jumpAt: runUp,
        });
      }
      if (runUp === 0) {
        for (const delay of [10, 18]) {
          for (const late of d === 0 ? [-1, 1] : [d]) {
            plans.push({ plan: (f) => ({ dir: f < delay ? 0 : late, jump: true }), ground: 0, jumpAt: 0 });
          }
        }
      }
    }
  }

  const key = (x: number, y: number) => `${Math.round(x / 3)},${Math.round(y)}`;
  const nodes: { x: number; y: number }[] = [];
  const index = new Map<string, number>();
  const edges: number[][] = [];
  const reachesGoal: boolean[] = [];
  const fragments = new Set<number>();
  let goalReached = false;

  const add = (x: number, y: number): number => {
    const k2 = key(x, y);
    const existing = index.get(k2);
    if (existing !== undefined) return existing;
    nodes.push({ x, y });
    edges.push([]);
    reachesGoal.push(false);
    index.set(k2, nodes.length - 1);
    return nodes.length - 1;
  };

  const s = standingBodyAt(start);
  const queue = [add(s.x, s.y)];
  for (let qi = 0; qi < queue.length; qi++) {
    const n = queue[qi];
    const from = nodes[n];
    for (const p of plans) {
      const out = simulate(from, p.plan, p.ground, p.jumpAt);
      if (!out) continue;
      out.touches.forEach((t) => fragments.add(t));
      if (out.goal) {
        goalReached = true;
        reachesGoal[n] = true;
        continue;
      }
      const before = nodes.length;
      const m = add(out.x, out.y);
      if (m !== n) edges[n].push(m);
      if (nodes.length > before) queue.push(m);
    }
  }

  // Walk the graph backwards from every node that touches the goal.
  const reverse: number[][] = nodes.map(() => []);
  edges.forEach((outs, a) => outs.forEach((b) => reverse[b].push(a)));
  const ok = reachesGoal.slice();
  const stack = ok.flatMap((v, i) => (v ? [i] : []));
  while (stack.length) {
    const b = stack.pop()!;
    for (const a of reverse[b]) {
      if (!ok[a]) {
        ok[a] = true;
        stack.push(a);
      }
    }
  }
  const deadEnds = nodes.filter((_, i) => !ok[i]);

  return { goalReached, fragments, deadEnds, nodeCount: nodes.length };
}
