import { expect, test } from '@playwright/test';
import { screenOf, startGame, state, watchErrors } from './helpers';

test('starts without errors and the organism glides with keyboard and mouse', async ({ page }) => {
  const errors = watchErrors(page);
  await startGame(page);
  const a = await state(page);
  expect(a.nodes.filter((n) => n.kind === 'encounter')).toHaveLength(3);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowRight');
  const b = await state(page);
  expect(b.organism.x - a.organism.x).toBeGreaterThan(60);

  // the mouse pulls it along like a current
  await page.mouse.move(150, 120, { steps: 5 });
  await page.waitForTimeout(2500);
  const c = await state(page);
  expect(c.organism.y).toBeLessThan(b.organism.y - 30);
  expect(errors).toEqual([]);
});

test('a node shows its title first, and only a second interaction enters', async ({ page }) => {
  await startGame(page);
  const s = await state(page);
  const storm = s.nodes.find((n) => n.title === 'Jesus stillt den Sturm')!;
  const p = await screenOf(page, storm.x, storm.y);
  await page.mouse.click(p.x, p.y);
  const card = page.locator('.focus-card');
  await expect(card).toContainText('Jesus stillt den Sturm');
  await expect(card).toContainText('Markus 4,35–41');
  await expect(page.locator('#focus-action')).toHaveText('Eintreten', { timeout: 60_000 });
  await page.keyboard.press('Enter');
  await expect(page.locator('.encounter h2')).toHaveText('Jesus stillt den Sturm');
  await expect(page.locator('.beat.now figcaption')).toContainText('Markus 4,35');
  // Escape asks before leaving
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Verlassen', exact: true }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('world');
});

test('search finds a passage, lights it up and shows the Lutherbibel 1912', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('tab', { name: 'Suchen' }).click();
  await page.locator('#search-ref').fill('Psalm 107,29');
  await expect(page.locator('.result')).toContainText('Psalm 107,29');
  await page.getByRole('button', { name: /Lesen und aufleuchten lassen/ }).click();
  await expect(page.locator('.reader')).toContainText('und stillte das Ungewitter, daß die Wellen sich legten');
  await expect(page.locator('.sheet')).toContainText('Lutherbibel 1912');
  await expect.poll(async () => (await state(page)).stats.discovered).toBe(1);
  await expect.poll(async () => (await state(page)).nodes.some((n) => n.title === 'Psalm 107' && n.kind === 'known')).toBe(true);
});

test('themes light up as a constellation and settings take effect', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('tab', { name: 'Themen' }).click();
  await page.getByRole('button', { name: /Gnade und Vergebung/ }).click();
  await expect(page.locator('.themes li.on')).toContainText('leuchtet');
  await expect(page.locator('.theme-members .chip').first()).toHaveText('Lk 15,11–32');
  await page.getByRole('button', { name: 'Schließen' }).click();

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.locator('#set-motion').check();
  await expect(page.locator('body')).toHaveClass(/reduce-motion/);
  await page.locator('#set-sound').uncheck();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByRole('button', { name: 'Ton an' })).toBeVisible();
});

test('the world is kept after a reload and can be reset', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await page.getByRole('tab', { name: 'Suchen' }).click();
  await page.locator('#search-ref').fill('Lk 15,20');
  await page.getByRole('button', { name: /Lesen und aufleuchten lassen/ }).click();
  await expect.poll(async () => (await state(page)).stats.discovered).toBe(1);
  // reload at once: the save must be written when the page goes away, not only after its delay
  await page.reload();
  await expect(page.locator('#start')).toHaveText('Weiter erkunden');
  await expect(page.locator('.start')).toContainText('1 Entdeckungen');
  await page.locator('#start').click();
  await expect.poll(async () => (await state(page)).nodes.some((n) => n.title === 'Lukas 15' || n.title === 'Der verlorene Sohn')).toBe(true);

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Spielstand zurücksetzen' }).click();
  await page.getByRole('button', { name: 'Ja, zurücksetzen' }).click();
  await expect(page.locator('#start')).toHaveText('Eintauchen');
});
