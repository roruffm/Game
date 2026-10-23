import { expect, type Page } from '@playwright/test';

export interface GameState {
  phase: string;
  organism: { x: number; y: number; carried: number; nourished: number; stage: number; segments: number };
  /** Words floating as food. */
  food: number;
  camera: { x: number; y: number; zoom: number };
  encounter: { id: string; objective: { x: number; y: number } | null; ui: { phase: number; done: boolean; beats: { ref: string; kind: string }[] } } | null;
  nodes: { chapter: number; kind: string; title: string; x: number; y: number; completed: boolean }[];
  threads: { a: number; b: number; kind: string; votes: number; links: number }[];
  stats: { discovered: number; threads: number; connections: number; encounters: number; ot: number };
  ride: { from: number; to: number; s: number; length: number; words: number; caught: number } | null;
  music: { scene: string; mood: string; track: string | null; playing: boolean; players: number };
  reveal: { label: string; words: { text: string; caught: boolean }[] } | null;
  fps: number;
}

/** Collects errors the page reports; tests assert it stays empty. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/GPU stall|GroupMarker|swiftshader/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

export const state = (page: Page) => page.evaluate(() => (window as unknown as { wortstrom: { state: () => GameState } }).wortstrom.state());

export async function screenOf(page: Page, x: number, y: number) {
  return page.evaluate(([wx, wy]) => (window as unknown as { wortstrom: { toScreen: (x: number, y: number) => { x: number; y: number } } }).wortstrom.toScreen(wx, wy), [x, y]);
}

export async function startGame(page: Page) {
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#start').click();
  await expect.poll(async () => (await state(page)).phase).toBe('world');
}

/** Plays an encounter by following its objective with the mouse, as a player would. */
export async function playEncounter(page: Page, maxMs = 380_000) {
  const vp = page.viewportSize()!;
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await state(page);
    if (!s.encounter || s.encounter.ui.done) return s;
    const obj = s.encounter.objective;
    if (obj) {
      const p = await screenOf(page, obj.x, obj.y);
      await page.mouse.move(Math.max(4, Math.min(vp.width - 4, p.x)), Math.max(4, Math.min(vp.height - 4, p.y)), { steps: 2 });
    }
    await page.waitForTimeout(250);
  }
  throw new Error('encounter did not finish in time');
}
