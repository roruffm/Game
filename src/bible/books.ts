// The 66 books in canonical (Protestant) order, with German names and colours per group.

import booksJson from '../../data/books.json';

export type Testament = 'OT' | 'NT';
export type Group = 'law' | 'history' | 'wisdom' | 'prophets' | 'gospels' | 'acts' | 'paul' | 'general' | 'revelation';

export interface Book {
  index: number;
  code: string;
  osis: string;
  name: string;
  short: string;
  aliases: string[];
  t: Testament;
  group: Group;
}

export const BOOKS: Book[] = (booksJson as Omit<Book, 'index'>[]).map((b, index) => ({ ...b, index }));

export const GROUPS: Record<Group, { label: string; color: number }> = {
  gospels: { label: 'Evangelien', color: 0xffd98a },
  acts: { label: 'Apostelgeschichte', color: 0x5ce1e6 },
  paul: { label: 'Paulusbriefe', color: 0x9b8cff },
  general: { label: 'Allgemeine Briefe', color: 0xf29bc1 },
  revelation: { label: 'Offenbarung', color: 0xb98bff },
  law: { label: 'Mose', color: 0xe0a35a },
  history: { label: 'Geschichtsbücher', color: 0x6fc0b4 },
  wisdom: { label: 'Psalmen und Weisheit', color: 0x86b6ff },
  prophets: { label: 'Propheten', color: 0xcf96e0 },
};

const byCode = new Map(BOOKS.map((b) => [b.code, b]));
const byOsis = new Map(BOOKS.map((b) => [b.osis, b]));

export function bookByCode(code: string): Book {
  const b = byCode.get(code);
  if (!b) throw new Error(`Unknown book ${code}`);
  return b;
}

export const bookByOsis = (osis: string) => byOsis.get(osis);

const norm = (s: string) => s.toLowerCase().replace(/[.\s]/g, '');
const lookup = new Map<string, Book>();
for (const b of BOOKS) {
  for (const key of [b.name, b.short, b.code, b.osis, ...b.aliases]) lookup.set(norm(key), b);
}

/** Finds a book by any of its German or English names and abbreviations ("Mk", "1. Mose", "Röm"). */
export function findBook(text: string): Book | undefined {
  return lookup.get(norm(text));
}
