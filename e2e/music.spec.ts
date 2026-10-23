import { expect, test } from '@playwright/test';
import { startGame, state } from './helpers';

test('calm worship music plays, changes with the encounters and is credited', async ({ page }) => {
  await startGame(page);
  await expect.poll(async () => (await state(page)).music).toMatchObject({ scene: 'world', track: 'welt-1', playing: true });

  await page.evaluate(() => (window as unknown as { wortstrom: { director: { startEncounter: (id: string) => Promise<void> } } }).wortstrom.director.startEncounter('prodigal'));
  await expect.poll(async () => (await state(page)).music).toMatchObject({ scene: 'prodigal', track: 'sohn', playing: true });

  await page.getByRole('button', { name: 'Begegnung verlassen' }).click();
  await page.getByRole('button', { name: 'Verlassen', exact: true }).click();
  // back in the world, the other piece of the world follows
  await expect.poll(async () => (await state(page)).music).toMatchObject({ scene: 'world', track: 'welt-2', playing: true });

  await page.getByRole('button', { name: 'Ton aus' }).click();
  await expect.poll(async () => (await state(page)).music.playing).toBe(false);

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: /Quellen/ }).click();
  const sheet = page.locator('.sheet');
  await expect(sheet).toContainText('Pixabay-Inhaltslizenz');
  for (const name of ['Denis Pavlov', 'Adrian Huminiak', 'smccleery', 'Jesse Quinn']) await expect(sheet).toContainText(name);
});

test('the small sounds join the music quietly, in its key', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { wortstrom?: { renderPreview?: unknown } }).wortstrom?.renderPreview);
  const levels = await page.evaluate(async () => {
    type Render = (id: string, s: number, e: { at: number; kind: string; step?: number }[], offset?: number) => Promise<AudioBuffer>;
    const render = (window as unknown as { wortstrom: { renderPreview: Render } }).wortstrom.renderPreview;
    const events = [
      { at: 1, kind: 'beat' },
      { at: 2.5, kind: 'discover' },
      { at: 4, kind: 'thread' },
      { at: 5, kind: 'pluck', step: 2 },
      { at: 6, kind: 'reveal' },
      { at: 8, kind: 'resonance' },
    ];
    const out: { music: number; notes: number }[] = [];
    for (const id of ['welt-1', 'sturm', 'emmaus']) {
      const plain = (await render(id, 11, [], 40)).getChannelData(0);
      const mixed = (await render(id, 11, events, 40)).getChannelData(0);
      let music = 0;
      let notes = 0;
      for (let i = 0; i < plain.length; i++) {
        music = Math.max(music, Math.abs(plain[i]));
        notes = Math.max(notes, Math.abs(mixed[i] - plain[i]));
      }
      out.push({ music: 20 * Math.log10(music), notes: 20 * Math.log10(notes) });
    }
    return out;
  });
  for (const l of levels) {
    expect(l.music).toBeGreaterThan(-24);
    expect(l.music).toBeLessThan(-3);
    // audible, and clearly below the music
    expect(l.notes).toBeGreaterThan(-40);
    expect(l.notes).toBeLessThan(l.music - 5);
  }
});

test('with sound switched off, no music is loaded until it is switched on', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'wortstrom.save.v1',
      JSON.stringify({ version: 1, discoveries: [], encounters: [], links: [], notes: {}, settings: { sound: false, volume: 0.7, reducedMotion: false, reducedView: false, minVotes: 4 }, player: null, zoom: null, theme: null, tips: [], revealed: [] }),
    ),
  );
  await startGame(page);
  await page.waitForTimeout(1500);
  // no player, no download (phones save their data)
  expect((await state(page)).music).toMatchObject({ players: 0, track: null, playing: false });
  await page.getByRole('button', { name: 'Ton an' }).click();
  await expect.poll(async () => (await state(page)).music).toMatchObject({ players: 2, track: 'welt-1', playing: true });
});
