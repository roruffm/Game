// World Engine (logic): which chapters are lit, which are only glimmering hints, and which
// threads of light connect them. Everything is derived from the player's discoveries and the
// cross-reference data, so the same discoveries always produce the same world.

import type { Bible, Range } from '../bible/bible';
import { BOOKS, GROUPS, type Group } from '../bible/books';
import { ENCOUNTERS, type EncounterId } from '../content/encounters';
import { THEMES } from '../content/themes';
import type { CrossRefs, TargetGroup, XLink } from '../xref/crossrefs';
import type { Discovery, SaveData } from '../state/save';

export interface GraphData {
  chapters: [number, number, number, number, number, number][];
  edges: [number, number, number][];
}

export type NodeKind = 'encounter' | 'known' | 'hint';

export interface WorldNode {
  chapter: number;
  x: number;
  y: number;
  kind: NodeKind;
  encounter?: EncounterId;
  completed: boolean;
  title: string;
  group: Group;
  color: number;
  ot: boolean;
  discoveries: Discovery[];
  /** When the node became visible (game time), for the appear animation. */
  born: number;
}

export interface Thread {
  id: string;
  a: number;
  b: number;
  kind: 'known' | 'hint';
  links: XLink[];
  votes: number;
  ot: boolean;
  born: number;
}

/** How many unknown chapters a discovery reveals as glimmering hints. */
const HINTS_ENCOUNTER = 12;
const HINTS_REFERENCE = 6;

export class WorldModel {
  readonly nodes = new Map<number, WorldNode>();
  threads: Thread[] = [];
  private groups = new Map<Discovery, TargetGroup[]>();
  clock = () => 0;
  onChange: () => void = () => {};

  constructor(
    readonly bible: Bible,
    readonly xrefs: CrossRefs,
    readonly save: SaveData,
    readonly graph: GraphData,
  ) {}

  position(chapter: number) {
    const c = this.graph.chapters[chapter];
    return { x: c[3], y: c[4] };
  }

  chapterTitle(chapter: number) {
    return this.bible.formatChapter(chapter);
  }

  encounterChapter(id: EncounterId) {
    const info = ENCOUNTERS.find((e) => e.id === id)!;
    return this.bible.chapterOf(this.bible.range(info.range).start);
  }

  async init() {
    for (const d of this.save.discoveries) this.groups.set(d, await this.linksOf(d));
    this.rebuild(true);
  }

  private async linksOf(d: Discovery) {
    const links = await this.xrefs.from({ start: d.start, end: d.end }, this.save.settings.minVotes);
    return this.xrefs.groupByChapter(links, (ch) => ch === d.chapter);
  }

  /** Re-reads all links, e.g. after the vote filter changed. */
  async reload() {
    this.groups.clear();
    await this.init();
  }

  isKnown(chapter: number) {
    return this.save.discoveries.some((d) => d.chapter === chapter);
  }

  async discover(d: Discovery): Promise<{ newHints: number; newThreads: number; isNew: boolean }> {
    const dup = this.save.discoveries.find((x) => x.start === d.start && x.end === d.end);
    if (dup) return { newHints: 0, newThreads: 0, isNew: false };
    const beforeHints = [...this.nodes.values()].filter((n) => n.kind === 'hint').length;
    const beforeThreads = this.threads.length;
    this.save.discoveries.push(d);
    this.groups.set(d, await this.linksOf(d));
    this.rebuild(false);
    const afterHints = [...this.nodes.values()].filter((n) => n.kind === 'hint').length;
    return { newHints: Math.max(0, afterHints - beforeHints), newThreads: Math.max(0, this.threads.length - beforeThreads), isNew: true };
  }

  completeEncounter(id: EncounterId) {
    if (!this.save.encounters.includes(id)) this.save.encounters.push(id);
    this.rebuild(false);
  }

  private makeNode(chapter: number, kind: NodeKind, now: number): WorldNode {
    const [b] = this.graph.chapters[chapter];
    const book = BOOKS[b];
    const old = this.nodes.get(chapter);
    const { x, y } = this.position(chapter);
    return {
      chapter,
      x,
      y,
      kind,
      completed: false,
      title: this.chapterTitle(chapter),
      group: book.group,
      color: GROUPS[book.group].color,
      ot: book.t === 'OT',
      discoveries: [],
      born: old && (old.kind === kind || kind === 'hint') ? old.born : now,
    };
  }

  private rebuild(initial: boolean) {
    const now = initial ? -100 : this.clock();
    const old = new Map(this.nodes);
    this.nodes.clear();

    for (const info of ENCOUNTERS) {
      const chapter = this.encounterChapter(info.id);
      const node = this.makeNode(chapter, 'encounter', now);
      node.encounter = info.id;
      node.title = info.title;
      node.color = info.color;
      node.completed = this.save.encounters.includes(info.id);
      node.born = old.get(chapter)?.born ?? -100;
      this.nodes.set(chapter, node);
    }
    for (const d of this.save.discoveries) {
      let node = this.nodes.get(d.chapter);
      if (!node) {
        node = this.makeNode(d.chapter, 'known', now);
        const prev = old.get(d.chapter);
        if (prev?.kind === 'known') node.born = prev.born;
        this.nodes.set(d.chapter, node);
      }
      node.discoveries.push(d);
    }

    // threads: known ↔ known for every link; known → hint for the strongest unknown chapters
    const threads = new Map<string, Thread>();
    const oldThreads = new Map(this.threads.map((t) => [t.id, t]));
    const addThread = (a: number, b: number, kind: Thread['kind'], g: TargetGroup) => {
      const id = a < b ? `${a}~${b}` : `${b}~${a}`;
      const t = threads.get(id);
      if (t) {
        t.links.push(...g.links);
        t.votes += g.votes;
        if (kind === 'known') t.kind = 'known';
        return;
      }
      const ot = BOOKS[this.graph.chapters[a][0]].t === 'OT' || BOOKS[this.graph.chapters[b][0]].t === 'OT';
      const prev = oldThreads.get(id);
      threads.set(id, { id, a, b, kind, links: [...g.links], votes: g.votes, ot, born: prev && (prev.kind === kind) ? prev.born : now });
    };
    for (const d of this.save.discoveries) {
      const groups = this.groups.get(d) ?? [];
      let hints = 0;
      const limit = d.kind === 'encounter' ? HINTS_ENCOUNTER : HINTS_REFERENCE;
      for (const g of groups) {
        const existing = this.nodes.get(g.chapter);
        if (existing && existing.kind !== 'hint' && this.isKnown(g.chapter)) {
          addThread(d.chapter, g.chapter, 'known', g);
        } else if (hints < limit) {
          hints++;
          if (!this.nodes.has(g.chapter)) {
            const node = this.makeNode(g.chapter, 'hint', now);
            const prev = old.get(g.chapter);
            if (prev?.kind === 'hint') node.born = prev.born;
            this.nodes.set(g.chapter, node);
          }
          addThread(d.chapter, g.chapter, 'hint', g);
        }
      }
    }
    this.threads = [...threads.values()].sort((x, y) => y.votes - x.votes);
    this.onChange();
  }

  /** Links into a chapter from discovered passages (strongest first). */
  incoming(chapter: number): { from: Discovery; links: XLink[] }[] {
    const out: { from: Discovery; links: XLink[] }[] = [];
    for (const d of this.save.discoveries) {
      const g = (this.groups.get(d) ?? []).find((x) => x.chapter === chapter);
      if (g) out.push({ from: d, links: g.links });
    }
    return out.sort((a, b) => b.links[0].votes - a.links[0].votes);
  }

  /** Links out of a chapter's discoveries, grouped by target chapter. */
  outgoing(chapter: number): TargetGroup[] {
    const merged = new Map<number, TargetGroup>();
    for (const d of this.save.discoveries.filter((x) => x.chapter === chapter)) {
      for (const g of this.groups.get(d) ?? []) {
        const m = merged.get(g.chapter);
        if (m) {
          m.links.push(...g.links);
          m.votes += g.votes;
        } else merged.set(g.chapter, { ...g, links: [...g.links] });
      }
    }
    return [...merged.values()].sort((a, b) => b.votes - a.votes);
  }

  themeChapters(themeId: string): { chapter: number; range: Range }[] {
    const theme = THEMES.find((t) => t.id === themeId);
    if (!theme) return [];
    return theme.passages.map((p) => {
      const range = this.bible.range(p);
      return { chapter: this.bible.chapterOf(range.start), range };
    });
  }

  stats() {
    const known = [...this.nodes.values()].filter((n) => n.kind !== 'hint' && (n.kind === 'known' || n.completed));
    return {
      discovered: this.save.discoveries.length,
      threads: this.threads.length,
      connections: this.threads.filter((t) => t.kind === 'known').length,
      encounters: this.save.encounters.length,
      ot: known.filter((n) => n.ot).length,
    };
  }

  /** 0 at the start, 1 after many discoveries: drives colour, density and music. */
  richness() {
    const s = this.stats();
    return Math.min(1, (s.discovered + s.encounters * 2 + s.connections * 0.5) / 34);
  }
}
