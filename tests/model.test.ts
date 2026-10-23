import { describe, expect, it } from 'vitest';
import { freshSave } from '../src/state/save';
import { WorldModel, type GraphData } from '../src/world/model';
import { loadBible, readData } from './helpers';

const { bible, xrefs } = loadBible();
const graph = readData('graph.json') as GraphData;

function model() {
  const save = freshSave();
  const m = new WorldModel(bible, xrefs, save, graph);
  return { m, save };
}

const discovery = (spec: string, kind: 'encounter' | 'reference' = 'reference') => {
  const r = bible.range(spec);
  return { start: r.start, end: r.end, chapter: bible.chapterOf(r.start), kind, at: 0 };
};

describe('World Engine', () => {
  it('starts with the four encounters and nothing else', async () => {
    const { m } = model();
    await m.init();
    expect([...m.nodes.values()].map((n) => n.kind)).toEqual(['encounter', 'encounter', 'encounter', 'encounter']);
    expect(m.threads).toHaveLength(0);
  });

  it('turns an encounter into glimmering hints along real links', async () => {
    const { m } = model();
    await m.init();
    const res = await m.discover(discovery('MAR 4:35-41', 'encounter'));
    expect(res.newHints).toBeGreaterThan(0);
    const ps107 = bible.chapterOf(bible.range('PSA 107:1').start);
    const thread = m.threads.find((t) => t.b === ps107 || t.a === ps107);
    expect(thread?.kind).toBe('hint');
    expect(thread?.links.some((l) => l.votes === 23)).toBe(true);
  });

  it('lets a resonance bring hidden links near a point to light, and keeps them', async () => {
    const { m, save } = model();
    await m.init();
    await m.discover(discovery('LUK 15:11-32', 'encounter'));
    const shown = [...m.nodes.values()].filter((n) => n.kind === 'hint').length;
    // around the whole world: every hidden link counts
    const hidden = m.hiddenNear(0, 0, 1e6, 50);
    expect(hidden.length).toBeGreaterThan(0);
    for (const h of hidden) {
      expect(m.nodes.has(h.chapter)).toBe(false);
      expect(h.votes).toBeGreaterThan(0);
    }
    expect(hidden.map((h) => h.votes)).toEqual([...hidden.map((h) => h.votes)].sort((a, b) => b - a));
    // near a point: only chapters within the radius
    const p = m.position(hidden[0].chapter);
    for (const h of m.hiddenNear(p.x, p.y, 300)) {
      const q = m.position(h.chapter);
      expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeLessThanOrEqual(300);
    }
    m.reveal(hidden.slice(0, 3).map((h) => h.chapter));
    expect([...m.nodes.values()].filter((n) => n.kind === 'hint').length).toBe(shown + 3);
    expect(save.revealed).toHaveLength(3);
    for (const h of hidden.slice(0, 3)) expect(m.threads.some((t) => t.b === h.chapter && t.kind === 'hint')).toBe(true);
    expect(m.hiddenNear(0, 0, 1e6, 50).some((h) => save.revealed.includes(h.chapter))).toBe(false);
  });

  it('connects two discovered passages with a solid thread', async () => {
    const { m } = model();
    await m.init();
    await m.discover(discovery('MAR 4:35-41', 'encounter'));
    await m.discover(discovery('PSA 107:23-31'));
    const ps107 = bible.chapterOf(bible.range('PSA 107:1').start);
    const mk4 = bible.chapterOf(bible.range('MAR 4:1').start);
    const thread = m.threads.find((t) => [t.a, t.b].includes(ps107) && [t.a, t.b].includes(mk4));
    expect(thread?.kind).toBe('known');
    expect(m.stats().connections).toBeGreaterThan(0);
  });

  it('builds the same world from the same discoveries', async () => {
    const a = model();
    const b = model();
    for (const x of [a, b]) {
      await x.m.init();
      await x.m.discover(discovery('LUK 15:11-32', 'encounter'));
      await x.m.discover(discovery('EPH 2:5'));
    }
    expect(a.m.threads.map((t) => t.id)).toEqual(b.m.threads.map((t) => t.id));
    expect([...a.m.nodes.keys()].sort()).toEqual([...b.m.nodes.keys()].sort());
  });

  it('ignores a passage discovered twice', async () => {
    const { m, save } = model();
    await m.init();
    await m.discover(discovery('LUK 24:13-35', 'encounter'));
    const again = await m.discover(discovery('LUK 24:13-35', 'encounter'));
    expect(again.isNew).toBe(false);
    expect(save.discoveries).toHaveLength(1);
  });
});
