import { expect, test } from '@playwright/test';
import { playEncounter, startGame, state, watchErrors } from './helpers';

type Detail = Record<string, number>;

// what each encounter must have shown along the way, besides its verses
const cases = [
  {
    id: 'storm',
    title: 'Jesus stillt den Sturm',
    key: 'Wer ist der?',
    last: 'MAR 4:41',
    // the boat filled with water, Jesus stood up, the stars came out
    scenes: (d: Detail) => d.flooded > 0.5 && d.risen === 1 && d.stars === 1,
  },
  {
    id: 'prodigal',
    title: 'Der verlorene Sohn',
    key: 'dieser mein Sohn war tot',
    last: 'LUK 15:31-32',
    // the inheritance was spent, the pigs ate the pods, he was dressed and the feast began
    scenes: (d: Detail) => d.spent === 10 && d.coins === 0 && d.podsEaten > 0 && d.dressed === 1 && d.feast === 1,
  },
  {
    id: 'emmaus',
    title: 'Die Emmausjünger',
    key: 'Brannte nicht unser Herz',
    last: 'LUK 24:34-35',
    // the told images rose, the stranger was asked to stay, the bread was broken, the eleven were there
    scenes: (d: Detail) => d.visions >= 3 && d.invited === 1 && d.broken === 1 && d.recognised === 1 && d.eleven === 1,
  },
];

for (const c of cases) {
  test(`${c.title}: play through, understand, connect, return`, async ({ page }) => {
    // every scene waits for its verses to be read, so a whole encounter takes a few minutes
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await startGame(page);
    await page.getByRole('button', { name: 'Übersicht' }).click();
    const row = page.locator('.links li', { hasText: c.title });
    await row.getByRole('button', { name: 'Direkt eintreten' }).click();
    await expect(page.locator('.encounter h2')).toHaveText(c.title);

    const end = await playEncounter(page, 540_000);
    expect(end.encounter?.ui.phase).toBe(3);
    expect(c.scenes(end.encounter?.detail ?? {}), JSON.stringify(end.encounter?.detail)).toBe(true);

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
