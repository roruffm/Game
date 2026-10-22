import { describe, expect, it } from 'vitest';
import { loadBible, readData } from './helpers';

const { bible, xrefs } = loadBible();

describe('imported data', () => {
  it('keeps every OpenBible.info link and reports the same counts as the source project', () => {
    const meta = readData('meta.json');
    expect(meta.links).toBe(344799);
    expect(meta.linksMin4).toBe(153419);
    expect(meta.snapshot).toBe('2026-09-21');
    expect(meta.sources.find((s: { id: string }) => s.id === 'openbible').license).toBe('CC BY 4.0');
  });

  it('finds Psalm 107 behind the calming of the storm (a real dataset link)', async () => {
    const links = await xrefs.from(bible.range('MAR 4:39'));
    const ps = links.find((l) => bible.format({ start: l.start, end: l.end }) === 'Psalm 107,29');
    expect(ps?.votes).toBe(23);
    // strongest first
    expect(links[0].votes).toBeGreaterThanOrEqual(links[links.length - 1].votes);
  });

  it('filters by votes and keeps ranges intact', async () => {
    const all = await xrefs.from(bible.range('MAR 4:37'), -1000);
    const strong = await xrefs.from(bible.range('MAR 4:37'), 4);
    expect(all.length).toBeGreaterThan(strong.length);
    const range = strong.find((l) => bible.format({ start: l.start, end: l.end }) === 'Psalm 107,23–31');
    expect(range?.votes).toBe(4);
  });

  it('groups links by the chapter they lead into', async () => {
    const links = await xrefs.from(bible.range('LUK 15:11-32'));
    const groups = xrefs.groupByChapter(links, (ch) => ch === bible.chapterOf(bible.range('LUK 15:11').start));
    expect(groups.length).toBeGreaterThan(10);
    expect(groups.every((g) => g.links.every((l) => bible.chapterOf(l.start) === g.chapter))).toBe(true);
    expect(groups[0].votes).toBeGreaterThanOrEqual(groups[1].votes);
  });

  it('removed the German numbering markers and the known source defect from the text', () => {
    let marked = 0;
    for (const b of readData('versification.json').books) {
      const t = readData(`text/lut1912/${b.code}.json`);
      for (const ch of t.chapters) for (const v of ch) if (/\[\d/.test(v)) marked++;
    }
    expect(marked).toBe(0);
    const jdg = readData('text/lut1912/JDG.json');
    expect(jdg.chapters[10][24]).not.toContain('518heeft');
  });

  it('lays out every chapter at a fixed position', () => {
    const graph = readData('graph.json');
    expect(graph.chapters).toHaveLength(1189);
    expect(graph.chapters.every((c: number[]) => Number.isFinite(c[3]) && Number.isFinite(c[4]))).toBe(true);
  });
});
