import { expect, test } from '@playwright/test';
import { screenOf, startGame, state, watchErrors } from './helpers';

test('on a phone: drag to glide, tap to see a node, enter and leave an encounter', async ({ page }) => {
  const errors = watchErrors(page);
  await startGame(page);
  const a = await state(page);

  // a drag anywhere works as a soft joystick
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 600 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 600 - i * 8 }] });
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const b = await state(page);
  expect(a.organism.y - b.organism.y).toBeGreaterThan(80);

  // tap a node: first its card, then enter
  const storm = b.nodes.find((n) => n.title === 'Jesus stillt den Sturm')!;
  const p = await screenOf(page, storm.x, storm.y);
  const vp = page.viewportSize()!;
  await page.touchscreen.tap(Math.max(8, Math.min(vp.width - 8, p.x)), Math.max(80, Math.min(vp.height - 8, p.y)));
  await expect(page.locator('#focus-action')).toHaveText('Eintreten', { timeout: 120_000 });
  await page.locator('#focus-action').tap();
  await expect(page.locator('.encounter h2')).toHaveText('Jesus stillt den Sturm');
  await page.getByRole('button', { name: 'Begegnung verlassen' }).tap();
  await page.getByRole('button', { name: 'Verlassen', exact: true }).tap();
  await expect.poll(async () => (await state(page)).phase).toBe('world');

  // panels become bottom sheets that fit the screen
  await page.getByRole('button', { name: 'Übersicht' }).tap();
  const sheet = page.locator('.sheet');
  await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const box = await sheet.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(vp.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
  expect(errors).toEqual([]);
});
