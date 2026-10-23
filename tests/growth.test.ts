import { describe, expect, it } from 'vitest';
import { growth, STAGES } from '../src/engine/growth';

describe('the organism growing from the words it takes in', () => {
  it('starts small and simple', () => {
    const g = growth(0);
    expect(g.stage).toBe(0);
    expect(g.scale).toBe(1);
    expect([g.fins, g.tail, g.crown, g.pattern, g.veil]).toEqual([0, 0, 0, 0, 0]);
  });

  it('only ever grows: every word adds, nothing is taken away', () => {
    let prev = growth(0);
    for (let n = 1; n <= 1200; n++) {
      const g = growth(n);
      for (const key of Object.keys(g) as (keyof typeof g)[]) expect(g[key]).toBeGreaterThanOrEqual(prev[key]);
      prev = g;
    }
    expect(growth(40).segments).toBeGreaterThan(growth(0).segments);
  });

  it('unfolds a new form at each stage, gradually', () => {
    const forms = STAGES.map((s) => s.form);
    expect(forms).toEqual(['fins', 'tail', 'crown', 'pattern', 'veil']);
    for (const [i, s] of STAGES.entries()) {
      expect(growth(s.at - 1).stage).toBe(i);
      expect(growth(s.at).stage).toBe(i + 1);
      expect(growth(s.at)[s.form]).toBe(0);
      expect(growth(s.at + 15)[s.form]).toBeGreaterThan(0);
      expect(growth(s.at + 15)[s.form]).toBeLessThan(1);
      expect(growth(s.at + 60)[s.form]).toBe(1);
    }
  });

  it('stays within bounds however much is read', () => {
    const g = growth(1e6);
    expect(g.stage).toBe(STAGES.length);
    expect(g.segments).toBeLessThanOrEqual(26);
    expect(g.cilia).toBeLessThanOrEqual(28);
    expect(g.scale).toBeLessThanOrEqual(1.7);
    expect(growth(-5)).toEqual(growth(0));
  });
});
