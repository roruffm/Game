import { expect, test } from '@playwright/test';
import { screenOf, startGame, state } from './helpers';

test('a thread of light leads to a real cross-reference: Mk 4 → Psalm 107', async ({ page }) => {
  await startGame(page);
  // Given a player who has lived through the storm (set up directly to keep the test short)
  await page.evaluate(async () => {
    const d = (window as unknown as { wortstrom: { director: { bible: { range: (s: string) => { start: number; end: number }; chapterOf: (i: number) => number }; discover: (x: object) => Promise<void>; model: { completeEncounter: (id: string) => void } } } }).wortstrom.director;
    const r = d.bible.range('MAR 4:35-41');
    await d.discover({ ...r, chapter: d.bible.chapterOf(r.start), kind: 'encounter', encounter: 'storm', at: Date.now() });
    d.model.completeEncounter('storm');
  });
  const s = await state(page);
  const psalm = s.nodes.find((n) => n.title === 'Psalm 107');
  expect(psalm?.kind).toBe('hint');

  // follow the faint light: click it, glide there, follow it
  const p = await screenOf(page, psalm!.x, psalm!.y);
  await page.evaluate((ch) => (window as unknown as { wortstrom: { director: { travelTo: (c: number) => void } } }).wortstrom.director.travelTo(ch), psalm!.chapter);
  await expect(page.locator('#focus-action')).toHaveText('Dem Licht folgen', { timeout: 120_000 });
  expect(p).toBeTruthy();
  await page.locator('#focus-action').click();

  const sheet = page.locator('.sheet');
  await expect(sheet.locator('h3').first()).toHaveText(/^Markus 4,\d+/);
  await expect(sheet).toContainText('Psalm 107');
  await expect(sheet.locator('.tier.data')).toContainText('OpenBible.info');
  await expect(sheet.locator('.tier.data')).toContainText('Stimmen');
  await expect(sheet).toContainText('CC BY 4.0');
  await expect.poll(async () => (await state(page)).nodes.find((n) => n.title === 'Psalm 107')?.kind).toBe('known');
  // the two discovered passages are now joined by a solid thread
  await expect.poll(async () => (await state(page)).stats.connections).toBeGreaterThan(0);

  await sheet.getByRole('button', { name: 'Ganzes Kapitel lesen' }).click();
  await expect(page.locator('.reader')).toContainText('Die mit Schiffen auf dem Meer fuhren');
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
