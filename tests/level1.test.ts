import { describe, expect, it } from 'vitest';
import { VERSES } from '../src/data/verses';
import { level1 } from '../src/levels/level1';
import { solveLevel } from '../src/levels/solver';

const verse = VERSES['lk15-6'];

describe('Level 1 – Das verlorene Schaf', () => {
  it('has everything the level needs', () => {
    expect(level1.start.tx).toBeGreaterThanOrEqual(0);
    expect(level1.sheep.tx).toBeGreaterThanOrEqual(0);
    expect(level1.home.length).toBeGreaterThan(0);
    expect(level1.gate.length).toBeGreaterThan(0);
    expect(level1.checkpoints.length).toBeGreaterThan(0);
    expect(level1.fragments.map((f) => f.index)).toEqual(verse.fragments.map((_, i) => i + 1));
  });

  it('splits the verse into fragments that rebuild it exactly', () => {
    expect(verse.text.endsWith(verse.fragments.join(' '))).toBe(true);
  });

  it('lets you reach the sheep from the start without getting stuck', () => {
    const out = solveLevel(level1, level1.start, { carrying: false, gateOpen: false, goal: 'sheep' });
    expect(out.goalReached).toBe(true);
    expect(out.deadEnds).toEqual([]);
  });

  it('lets you carry the sheep home without getting stuck', () => {
    const out = solveLevel(level1, level1.sheep, { carrying: true, gateOpen: true, goal: 'home' });
    expect(out.goalReached).toBe(true);
    expect(out.deadEnds).toEqual([]);
  });

  it('keeps the plateau out of reach while carrying, so the cave is the way home', () => {
    const blocked = solveLevel(level1, level1.sheep, { carrying: true, gateOpen: false, goal: 'home' });
    expect(blocked.goalReached).toBe(false);
  });

  it('places every fragment where a player can collect it', () => {
    const out = solveLevel(level1, level1.start, { carrying: false, gateOpen: false, goal: 'sheep' });
    const home = solveLevel(level1, level1.sheep, { carrying: true, gateOpen: true, goal: 'home' });
    const found = new Set([...out.fragments, ...home.fragments]);
    expect([...found].sort()).toEqual(level1.fragments.map((f) => f.index));
  });
});
