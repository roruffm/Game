// Cross-Reference Engine: OpenBible.info links, loaded per source book on demand,
// filtered by votes, grouped by target chapter.

import { BOOKS } from '../bible/books';
import type { Bible, Range } from '../bible/bible';

/** One link from the dataset: a single verse pointing at a verse or a range. */
export interface XLink {
  from: number;
  start: number;
  end: number;
  votes: number;
}

export const XREF_SOURCE = {
  id: 'openbible',
  name: 'OpenBible.info',
  license: 'CC BY 4.0',
  url: 'https://www.openbible.info/labs/cross-references/',
} as const;

/** The source project's default: links with at least 4 votes, the best supported 44 %. */
export const DEFAULT_MIN_VOTES = 4;

interface BookFile {
  first: number;
  offsets: number[];
  start: number[];
  span: number[];
  votes: number[];
}

export interface TargetGroup {
  chapter: number;
  links: XLink[];
  votes: number;
  /** The verses of that chapter the links point at. */
  range: Range;
}

export const linkKey = (l: XLink) => `${l.from}>${l.start}-${l.end}`;

export class CrossRefs {
  private files = new Map<number, Promise<BookFile>>();

  constructor(
    private readonly bible: Bible,
    private readonly fetchJson: (path: string) => Promise<unknown>,
  ) {}

  private file(book: number) {
    let p = this.files.get(book);
    if (!p) {
      p = this.fetchJson(`xref/${BOOKS[book].code}.json`) as Promise<BookFile>;
      this.files.set(book, p);
    }
    return p;
  }

  /** All links starting in the range, strongest first. */
  async from(range: Range, minVotes = DEFAULT_MIN_VOTES): Promise<XLink[]> {
    const out: XLink[] = [];
    for (let i = range.start; i <= range.end; i++) {
      const book = this.bible.ref(i).b;
      const f = await this.file(book);
      const local = i - f.first;
      for (let k = f.offsets[local]; k < f.offsets[local + 1]; k++) {
        if (f.votes[k] < minVotes) continue;
        out.push({ from: i, start: f.start[k], end: f.start[k] + f.span[k], votes: f.votes[k] });
      }
    }
    return out.sort((a, b) => b.votes - a.votes || a.from - b.from || a.start - b.start);
  }

  /** Links in both directions between two ranges. */
  async between(a: Range, b: Range, minVotes = DEFAULT_MIN_VOTES): Promise<XLink[]> {
    const hits = (src: Range, dst: Range) =>
      this.from(src, minVotes).then((links) => links.filter((l) => l.start <= dst.end && dst.start <= l.end));
    const [ab, ba] = await Promise.all([hits(a, b), hits(b, a)]);
    return [...ab, ...ba].sort((x, y) => y.votes - x.votes);
  }

  /** Groups links by the chapter they point into, strongest chapters first. */
  groupByChapter(links: XLink[], exclude?: (chapter: number) => boolean): TargetGroup[] {
    const groups = new Map<number, TargetGroup>();
    for (const l of links) {
      const chapter = this.bible.chapterOf(l.start);
      if (exclude?.(chapter)) continue;
      const chEnd = this.bible.chapterRange(chapter).end;
      const end = Math.min(l.end, chEnd);
      const g = groups.get(chapter);
      if (g) {
        g.links.push(l);
        g.votes += Math.max(0, l.votes);
        g.range = { start: Math.min(g.range.start, l.start), end: Math.max(g.range.end, end) };
      } else {
        groups.set(chapter, { chapter, links: [l], votes: Math.max(0, l.votes), range: { start: l.start, end } });
      }
    }
    return [...groups.values()].sort((a, b) => b.votes - a.votes || a.chapter - b.chapter);
  }
}
