import { expect, test, type Page } from '@playwright/test';
import { startGame, state, watchErrors } from './helpers';

/** A player who has lived through the storm (set up directly to keep the tests short). */
async function afterStorm(page: Page) {
  await startGame(page);
  await page.evaluate(async () => {
    const d = (window as unknown as { wortstrom: { director: { bible: { range: (s: string) => { start: number; end: number }; chapterOf: (i: number) => number }; discover: (x: object) => Promise<void>; model: { completeEncounter: (id: string) => void } } } }).wortstrom.director;
    const r = d.bible.range('MAR 4:35-41');
    await d.discover({ ...r, chapter: d.bible.chapterOf(r.start), kind: 'encounter', encounter: 'storm', at: Date.now() });
    d.model.completeEncounter('storm');
  });
}

test('a thread of light carries you to a real cross-reference: Mk 4 → Psalm 107', async ({ page }) => {
  const errors = watchErrors(page);
  await afterStorm(page);
  const psalm = (await state(page)).nodes.find((n) => n.title === 'Psalm 107');
  expect(psalm?.kind).toBe('hint');

  // choosing the faint light glides to its thread, and the current takes over
  await page.evaluate((ch) => (window as unknown as { wortstrom: { director: { travelTo: (c: number) => void } } }).wortstrom.director.travelTo(ch), psalm!.chapter);
  await expect.poll(async () => (await state(page)).ride?.to, { timeout: 60_000 }).toBe(psalm!.chapter);
  await expect.poll(async () => (await state(page)).ride?.words ?? 0).toBeGreaterThan(3);

  // on arrival the verse assembles, labelled as Bible text and as a dataset link
  const reveal = page.locator('.reveal');
  await expect(reveal).toBeVisible({ timeout: 120_000 });
  await expect(reveal).toContainText('Psalm 107,');
  await expect(reveal).toContainText('Lutherbibel 1912');
  await expect(reveal.locator('.kicker')).toHaveText('Lichtfaden · im Datensatz');
  await expect(reveal.locator('.source-line')).toContainText(/Querverweis Markus 4,\d+ → Psalm 107,\d+ · \d+ Stimmen · OpenBible\.info \(CC BY 4\.0\)/);
  const words = await reveal.locator('.w').count();
  expect(words).toBeGreaterThan(3);
  await expect.poll(async () => (await state(page)).nodes.find((n) => n.title === 'Psalm 107')?.kind).toBe('known');
  await expect.poll(async () => (await state(page)).stats.connections).toBeGreaterThan(0);

  // from the verse to the full comparison
  await page.locator('#reveal-open').click();
  const sheet = page.locator('.sheet');
  await expect(sheet.locator('h3').first()).toHaveText(/^Markus 4,\d+/);
  await expect(sheet).toContainText('Psalm 107');
  await expect(sheet.locator('.tier.data')).toContainText('OpenBible.info');
  await expect(sheet.locator('.tier.data')).toContainText('Stimmen');
  await sheet.getByRole('button', { name: 'Ganzes Kapitel lesen' }).click();
  await expect(page.locator('.reader')).toContainText('Die mit Schiffen auf dem Meer fuhren');
  expect(errors).toEqual([]);
});

test('gliding along a thread lets its current catch you, steering out lets go', async ({ page }) => {
  await afterStorm(page);
  // threads only carry once they have grown in
  await page.waitForFunction(() => {
    const d = (window as unknown as { wortstrom: { director: { game: { time: number }; model: { threads: { born: number }[] } } } }).wortstrom.director;
    return d.model.threads.every((t) => d.game.time - t.born > 2.6);
  }, null, { timeout: 30_000 });
  // put the organism on the longest hint thread, already gliding along it
  const dir = await page.evaluate(() => {
    type P = { length: number; at: (s: number) => { x: number; y: number; tx: number; ty: number } };
    type T = { a: number; b: number; kind: string };
    const d = (window as unknown as { wortstrom: { director: { model: { threads: T[] }; world: { pathFor: (t: T, from: number) => P }; game: { organism: { place: (x: number, y: number) => void; vx: number; vy: number } } } } }).wortstrom.director;
    const len = (t: T) => d.world.pathFor(t, t.a).length;
    const t = d.model.threads.filter((x) => x.kind === 'hint').sort((x, y) => len(y) - len(x))[0];
    const q = d.world.pathFor(t, t.a).at(200);
    d.game.organism.place(q.x, q.y);
    d.game.organism.vx = q.tx * 230;
    d.game.organism.vy = q.ty * 230;
    return { tx: q.tx, ty: q.ty, to: t.b };
  });
  const keys = [
    ...(dir.tx > 0.35 ? ['ArrowRight'] : dir.tx < -0.35 ? ['ArrowLeft'] : []),
    ...(dir.ty > 0.35 ? ['ArrowDown'] : dir.ty < -0.35 ? ['ArrowUp'] : []),
  ];
  for (const k of keys) await page.keyboard.down(k);
  await expect.poll(async () => (await state(page)).ride?.to, { timeout: 30_000 }).toBe(dir.to);
  for (const k of keys) await page.keyboard.up(k);
  await expect(page.locator('.toast').filter({ hasText: 'Ein Lichtfaden trägt dich.' })).toBeVisible();

  // steer out sideways
  const out = Math.abs(dir.tx) > Math.abs(dir.ty) ? (dir.tx > 0 ? 'ArrowDown' : 'ArrowUp') : dir.ty > 0 ? 'ArrowLeft' : 'ArrowRight';
  await page.keyboard.down(out);
  await expect.poll(async () => (await state(page)).ride, { timeout: 30_000 }).toBeNull();
  await page.keyboard.up(out);
  await expect(page.locator('.reveal')).toHaveCount(0);
});

test('the editorial explanation is labelled apart from the data', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const d = (window as unknown as { wortstrom: { director: { bible: { range: (s: string) => { start: number; end: number }; chapterOf: (i: number) => number }; setPanel: (p: object) => void } } }).wortstrom.director;
    const a = d.bible.range('LUK 15:24');
    const b = d.bible.range('EPH 2:5');
    d.setPanel({ type: 'link', a, b, fromChapter: d.bible.chapterOf(a.start), toChapter: d.bible.chapterOf(b.start) });
  });
  const sheet = page.locator('.sheet');
  await expect(sheet.locator('.tier.data')).toContainText('30 Stimmen');
  await expect(sheet.locator('.tier.editorial .tier-label')).toHaveText('Redaktionelle Erklärung');
  await expect(sheet.locator('.tier.editorial')).toContainText('Tot – und lebendig');
  await expect(sheet.locator('.tier.auto')).toContainText('lebendig');
});
