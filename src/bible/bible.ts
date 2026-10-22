// Bible Data Service: versification (KJV numbering, as in the cross-reference data),
// global verse indices, German references, and the Lutherbibel 1912 text, loaded per book.

import { BOOKS, findBook, type Book } from './books';

export interface VerseRef {
  b: number;
  c: number;
  v: number;
}

/** A run of verses by global index, inclusive. */
export interface Range {
  start: number;
  end: number;
}

export interface Verse {
  index: number;
  ref: VerseRef;
  text: string;
  /** The verse number in the German edition where it differs from the KJV numbering. */
  germanNumber?: string;
}

export interface Versification {
  verses: number;
  books: { code: string; first: number; chapters: number[] }[];
}

export const TRANSLATION = 'Lutherbibel 1912';

export class Bible {
  readonly chapterIds: number[][] = [];
  private readonly chapterFirst: number[][] = [];
  private readonly chapterList: { b: number; c: number; first: number; count: number }[] = [];
  private readonly texts = new Map<string, Promise<{ chapters: string[][]; alt: Record<string, string> }>>();

  constructor(
    readonly versification: Versification,
    private readonly fetchJson: (path: string) => Promise<unknown>,
  ) {
    versification.books.forEach((book, b) => {
      let first = book.first;
      this.chapterIds[b] = [];
      this.chapterFirst[b] = [];
      book.chapters.forEach((count, c) => {
        this.chapterIds[b].push(this.chapterList.length);
        this.chapterFirst[b].push(first);
        this.chapterList.push({ b, c: c + 1, first, count });
        first += count;
      });
    });
  }

  get chapterCount() {
    return this.chapterList.length;
  }

  chapter(id: number) {
    return this.chapterList[id];
  }

  chapterId(b: number, c: number): number {
    return this.chapterIds[b][c - 1];
  }

  chapterRange(id: number): Range {
    const ch = this.chapterList[id];
    return { start: ch.first, end: ch.first + ch.count - 1 };
  }

  index(ref: VerseRef): number {
    const count = this.versification.books[ref.b]?.chapters[ref.c - 1];
    if (count === undefined || ref.v < 1 || ref.v > count) throw new Error(`No verse ${JSON.stringify(ref)}`);
    return this.chapterFirst[ref.b][ref.c - 1] + ref.v - 1;
  }

  ref(index: number): VerseRef {
    const id = this.chapterOf(index);
    const ch = this.chapterList[id];
    return { b: ch.b, c: ch.c, v: index - ch.first + 1 };
  }

  chapterOf(index: number): number {
    let lo = 0;
    let hi = this.chapterList.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.chapterList[mid].first <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  book(index: number): Book {
    return BOOKS[this.ref(index).b];
  }

  /** Parses "MAR 4:35-41" (data notation) into a range. */
  range(spec: string): Range {
    const m = /^(\S+) (\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/.exec(spec.trim());
    if (!m) throw new Error(`Bad range "${spec}"`);
    const b = BOOKS.findIndex((x) => x.code === m[1]);
    if (b < 0) throw new Error(`Bad book in "${spec}"`);
    const c = Number(m[2]);
    const start = this.index({ b, c, v: Number(m[3]) });
    const end = m[5] ? this.index({ b, c: m[4] ? Number(m[4]) : c, v: Number(m[5]) }) : start;
    return { start, end };
  }

  /** "Markus 4,35–41", "Psalm 107,29", "Lukas 15,32–16,2". */
  format(range: Range, style: 'long' | 'short' = 'long'): string {
    const a = this.ref(range.start);
    const z = this.ref(range.end);
    const book = BOOKS[a.b];
    const name = style === 'long' ? book.name : book.short;
    if (range.start === range.end) return `${name} ${a.c},${a.v}`;
    if (a.c === z.c) return `${name} ${a.c},${a.v}–${z.v}`;
    return `${name} ${a.c},${a.v}–${z.c},${z.v}`;
  }

  formatChapter(id: number, style: 'long' | 'short' = 'long'): string {
    const ch = this.chapterList[id];
    const book = BOOKS[ch.b];
    return `${style === 'long' ? book.name : book.short} ${ch.c}`;
  }

  /**
   * Understands what people type: "Mk 4,35-41", "Markus 4", "1. Mose 3,15", "Joh 3:16", "Ps 23".
   * Returns a chapter or verse range, or null.
   */
  parse(input: string): Range | null {
    const m = /^\s*((?:[1-3]\.?\s*)?[^\d\s][^\d]*?)\s*(\d+)(?:\s*[,:]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/.exec(input);
    if (!m) return null;
    const book = findBook(m[1]);
    if (!book) return null;
    const c = Number(m[2]);
    const counts = this.versification.books[book.index].chapters;
    if (c < 1 || c > counts.length) return null;
    if (!m[3]) return this.chapterRange(this.chapterId(book.index, c));
    const v1 = Number(m[3]);
    const v2 = m[4] ? Number(m[4]) : v1;
    if (v1 < 1 || v2 < v1 || v2 > counts[c - 1]) return null;
    return { start: this.index({ b: book.index, c, v: v1 }), end: this.index({ b: book.index, c, v: v2 }) };
  }

  private loadText(code: string) {
    let p = this.texts.get(code);
    if (!p) {
      p = this.fetchJson(`text/lut1912/${code}.json`) as Promise<{ chapters: string[][]; alt: Record<string, string> }>;
      this.texts.set(code, p);
    }
    return p;
  }

  async verses(range: Range): Promise<Verse[]> {
    const out: Verse[] = [];
    for (let i = range.start; i <= range.end; i++) {
      const ref = this.ref(i);
      const data = await this.loadText(BOOKS[ref.b].code);
      const germanNumber = data.alt[`${ref.c}:${ref.v}`];
      out.push({ index: i, ref, text: data.chapters[ref.c - 1][ref.v - 1], ...(germanNumber ? { germanNumber } : {}) });
    }
    return out;
  }

  async text(range: Range): Promise<string> {
    return (await this.verses(range)).map((v) => v.text).join(' ');
  }
}

export const overlaps = (a: Range, b: Range) => a.start <= b.end && b.start <= a.end;
export const contains = (r: Range, i: number) => i >= r.start && i <= r.end;
export const rangeKey = (r: Range) => `${r.start}-${r.end}`;
