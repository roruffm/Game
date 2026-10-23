import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// save.ts talks to the browser: give it a window, a document and a localStorage
const store = new Map<string, string>();
beforeAll(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, {
    window: { addEventListener: () => {}, setTimeout, clearTimeout, matchMedia: () => ({ matches: false }) },
    document: { addEventListener: () => {}, visibilityState: 'visible' },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  });
});
afterAll(() => vi.useRealTimers());

describe('keeping the world', () => {
  it('saves soon after a change, even while changes keep coming', async () => {
    const { freshSave, persist } = await import('../src/state/save');
    const save = freshSave();
    // the organism eats a word every 300 ms for three seconds
    for (let i = 1; i <= 10; i++) {
      save.nourished = i;
      persist(save);
      vi.advanceTimersByTime(300);
    }
    const kept = JSON.parse(store.get('wortstrom.save.v1') ?? '{}');
    expect(kept.nourished).toBeGreaterThanOrEqual(9);
    // and the last change is not lost either
    vi.advanceTimersByTime(500);
    expect(JSON.parse(store.get('wortstrom.save.v1')!).nourished).toBe(10);
  });
});
