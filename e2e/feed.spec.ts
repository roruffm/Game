import { expect, test, type Page } from '@playwright/test';
import { startGame, state, watchErrors } from './helpers';

type Bit = { x: number; y: number; eaten: number; word: string };
type Director = {
  startEncounter: (id: string) => Promise<void>;
  returnToWorld: () => void;
  spill: (words: { word: string; x: number; y: number; size: number }[], color: number) => void;
  save: { nourished: number };
  game: { food: { bits: Bit[] }; organism: { place: (x: number, y: number) => void; setGrowth: (n: number, animate?: boolean) => boolean } };
};

/** Puts the organism onto the nearest floating word, as if it had swum there. */
async function swimToWord(page: Page) {
  return page.evaluate(() => {
    const d = (window as unknown as { wortstrom: { director: Director } }).wortstrom.director;
    const bit = d.game.food.bits.find((b) => b.eaten < 0);
    if (bit) d.game.organism.place(bit.x, bit.y);
    return bit?.word ?? null;
  });
}

test('read verses become food: the organism takes in their words and grows', async ({ page }) => {
  const errors = watchErrors(page);
  await startGame(page);
  await page.evaluate(() => (window as unknown as { wortstrom: { director: Director } }).wortstrom.director.startEncounter('storm'));
  const thought = page.locator('.thought');
  await expect(thought.locator('.tl').first()).toContainText('Und an demselben Tage');
  const before = await state(page);
  expect(before.food).toBe(0);
  expect(before.organism.nourished).toBe(0);

  // once the verse could be read, its words leave the thought and float as food
  await expect.poll(async () => (await state(page)).food, { timeout: 40_000 }).toBeGreaterThan(5);
  await expect(page.locator('.thought-body.ripe').first()).toBeAttached();
  await expect(page.locator('.toasts')).toContainText('Die gelesenen Worte lösen sich.');
  // where the words came from stays readable
  await expect(thought.locator('.thought-ref').first()).toContainText('Lutherbibel 1912');

  // swimming into them, the organism takes them in
  for (let i = 0; i < 6; i++) {
    expect(await swimToWord(page)).not.toBeNull();
    await page.waitForTimeout(400);
  }
  await expect.poll(async () => (await state(page)).organism.nourished).toBeGreaterThanOrEqual(3);
  // the first meal is answered with scripture
  await expect(page.locator('.toasts')).toContainText('Dein Wort ward mir Speise', { timeout: 10_000 });
  await expect(page.locator('.toasts')).toContainText('Jeremia 15,16a · Lutherbibel 1912');

  // close to a new stage, one more word unfolds a new form
  await page.evaluate(() => {
    const d = (window as unknown as { wortstrom: { director: Director } }).wortstrom.director;
    d.save.nourished = 39;
    d.game.organism.setGrowth(39, false);
    d.spill([{ word: 'Wort', x: 300, y: 300, size: 18 }], 0xffe2a8);
  });
  const small = await state(page);
  expect(small.organism.stage).toBe(0);
  await expect.poll(async () => {
    await swimToWord(page);
    return (await state(page)).organism.stage;
  }, { timeout: 20_000 }).toBe(1);
  await expect(page.locator('.toasts')).toContainText('Der Organismus entfaltet Flossen.');
  const grown = await state(page);
  expect(grown.organism.segments).toBeGreaterThan(before.organism.segments);

  // what it has taken in is kept
  await page.waitForTimeout(600);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('wortstrom.save.v1') ?? '{}').nourished);
  expect(saved).toBeGreaterThanOrEqual(40);

  // coming back, the verses are there to be read again
  await page.evaluate(() => (window as unknown as { wortstrom: { director: Director } }).wortstrom.director.returnToWorld());
  await expect.poll(async () => (await state(page)).phase).toBe('world');
  expect((await state(page)).food).toBe(0);
  await page.evaluate(() => (window as unknown as { wortstrom: { director: Director } }).wortstrom.director.startEncounter('storm'));
  await expect(thought.locator('.tl').first()).toBeVisible();
  await expect(thought.locator('.tl').first()).toContainText('Und an demselben Tage');
  expect(errors).toEqual([]);
});
