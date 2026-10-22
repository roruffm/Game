import { describe, expect, it } from 'vitest';
import { EDITORIAL } from '../src/content/editorial';
import { ENCOUNTERS } from '../src/content/encounters';
import { THEMES } from '../src/content/themes';
import { loadBible } from './helpers';

const { bible, xrefs } = loadBible();

describe('editorial layer', () => {
  it('only explains links that really exist in the dataset, with the votes it states', async () => {
    for (const note of EDITORIAL) {
      const from = bible.range(note.from);
      const to = bible.range(note.to);
      const links = await xrefs.from(from, -1000);
      const hit = links.find((l) => l.start <= to.end && to.start <= l.end);
      expect(hit, `${note.from} → ${note.to}`).toBeDefined();
      expect(hit!.votes, `${note.from} → ${note.to}`).toBe(note.votes);
    }
  });

  it('quotes the Lutherbibel 1912 word for word', async () => {
    // every „…“ quotation in an explanation must appear in one of the two texts it connects
    for (const note of EDITORIAL) {
      const a = await bible.text(bible.range(note.from));
      const b = await bible.text(bible.range(note.to));
      for (const m of note.text.matchAll(/„([^“]+)“/g)) {
        const parts = m[1].split(' … ');
        for (const part of parts) {
          const inText = a.includes(part) || b.includes(part);
          if (!inText) {
            // quotations may also come from the encounter passage around the source verse
            const passage = ENCOUNTERS.find((e) => {
              const r = bible.range(e.range);
              return from(note) >= r.start && from(note) <= r.end;
            });
            const around = passage ? await bible.text(bible.range(passage.range)) : '';
            expect(around.includes(part) || (await quotedElsewhere(part)), `${note.title}: „${part}“`).toBe(true);
          }
        }
      }
    }
  });
});

const from = (note: { from: string }) => bible.range(note.from).start;

// A few explanations quote a third passage they name (e.g. Lk 15,2 or Lk 24,35).
async function quotedElsewhere(part: string) {
  for (const ref of ['LUK 15:2', 'LUK 24:35', 'LUK 15:5', 'LUK 15:18', 'LUK 15:21']) {
    if ((await bible.text(bible.range(ref))).includes(part)) return true;
  }
  return false;
}

describe('themes', () => {
  it('point to valid passages and are kept apart from the dataset', () => {
    expect(THEMES).toHaveLength(8);
    for (const t of THEMES) {
      expect(t.passages.length).toBeGreaterThan(3);
      for (const p of t.passages) expect(() => bible.range(p), p).not.toThrow();
    }
  });
});

describe('encounters', () => {
  it('each rests on a real passage with its key verse inside it', () => {
    expect(ENCOUNTERS.map((e) => e.id)).toEqual(['storm', 'prodigal', 'emmaus']);
    for (const e of ENCOUNTERS) {
      const r = bible.range(e.range);
      const k = bible.range(e.keyVerse);
      expect(k.start >= r.start && k.end <= r.end).toBe(true);
      expect(e.phases).toHaveLength(4);
    }
  });
});
