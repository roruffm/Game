import { expect, test } from '@playwright/test';
import { playEncounter, startGame, state, watchErrors } from './helpers';

const cases = [
  { id: 'storm', title: 'Jesus stillt den Sturm', key: 'Wer ist der?', last: 'MAR 4:41' },
  { id: 'prodigal', title: 'Der verlorene Sohn', key: 'dieser mein Sohn war tot', last: 'LUK 15:31-32' },
  { id: 'emmaus', title: 'Die Emmausjünger', key: 'Brannte nicht unser Herz', last: 'LUK 24:34-35' },
];

for (const c of cases) {
  test(`${c.title}: play through, understand, connect, return`, async ({ page }) => {
    const errors = watchErrors(page);
    await startGame(page);
    await page.getByRole('button', { name: 'Übersicht' }).click();
    const row = page.locator('.links li', { hasText: c.title });
    await row.getByRole('button', { name: 'Direkt eintreten' }).click();
    await expect(page.locator('.encounter h2')).toHaveText(c.title);

    const end = await playEncounter(page);
    expect(end.encounter?.ui.phase).toBe(3);

    // understand: key verse, whole text, an optional question
    const sheet = page.locator('.sheet');
    await expect(sheet).toContainText(c.key);
    await expect(sheet).toContainText('Zum Nachdenken');
    await sheet.getByRole('button', { name: /Ganzen Text lesen/ }).click();
    await expect(sheet.locator('.reader')).toBeVisible();
    // connect: real cross-references out of the passage
    await expect(sheet.locator('.links li').first()).toContainText('Stimmen');

    const s = await state(page);
    expect(s.encounter?.ui.beats.at(-1)?.ref).toBe(c.last);
    await page.locator('#return-world').click();
    await expect.poll(async () => (await state(page)).phase).toBe('world');
    const after = await state(page);
    expect(after.stats.encounters).toBe(1);
    expect(after.nodes.find((n) => n.title === c.title)?.completed).toBe(true);
    expect(after.threads.length).toBeGreaterThan(3);
    expect(errors).toEqual([]);
  });
}
