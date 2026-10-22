// Turns the pinned sources into the game's datasets in public/data/.
//
//   text/lut1912/<BOOK>.json   Lutherbibel 1912, one file per book (loaded on demand)
//   xref/<BOOK>.json           every OpenBible.info cross-reference starting in that book
//   versification.json         chapters and verse counts (KJV numbering, 31,102 verses)
//   graph.json                 chapter graph with a stable, deterministic world layout
//   meta.json                  counts, snapshot date, licences and attributions
//
// Usage: npm run data            (always rebuild)
//        node build.mjs --if-needed  (skip when the outputs match the sources)

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, OUT_DIR, ROOT, ensureSource, loadSources, readJson, readZipMember, sha256, writeJson } from './lib.mjs';
import { computeLayout } from './layout.mjs';

const BUILD_VERSION = 3;
const books = readJson(join(DATA_DIR, 'books.json'));
const sources = loadSources();
const stampPath = join(OUT_DIR, 'stamp.json');
const stamp = sha256(
  JSON.stringify({ BUILD_VERSION, sources, books }) +
    readFileSync(join(ROOT, 'scripts/data/build.mjs'), 'utf8') +
    readFileSync(join(ROOT, 'scripts/data/layout.mjs'), 'utf8'),
);

if (process.argv.includes('--if-needed') && existsSync(stampPath) && readJson(stampPath).stamp === stamp) {
  console.log('data: up to date');
  process.exit(0);
}

const started = Date.now();
const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
const lutherZip = await ensureSource(byId.luther1912);
const openbibleZip = await ensureSource(byId.openbible);

rmSync(OUT_DIR, { recursive: true, force: true });

// ── Lutherbibel 1912 and the versification ─────────────────────────────

const codeIndex = new Map(books.map((b, i) => [b.code, i]));
const verses = books.map(() => []); // [book][chapter-1][verse-1] = text
const alt = books.map(() => ({})); // German edition's own numbering where it differs
const MARKER = /\[(\d+(?::\d+|[ab]))\]/g;
// Recorded one by one, like the source project does (scripts/data/lib/source-defects.ts there).
const DEFECTS = [{ book: 'JDG', chapter: 11, verse: 25, remove: ' 518heeft' }];
let markerCount = 0;

for (const line of readZipMember(lutherZip, byId.luther1912.member).split(/\r?\n/)) {
  if (!line.trim()) continue;
  const m = /^(\S{3}) (\d+):(\d+) (.*)$/.exec(line);
  if (!m) throw new Error(`Luther: unexpected line "${line.slice(0, 60)}"`);
  const [, code, c, v, raw] = m;
  const b = codeIndex.get(code);
  if (b === undefined) throw new Error(`Luther: unknown book ${code}`);
  const chapter = Number(c);
  const verse = Number(v);
  let text = raw;
  for (const d of DEFECTS) {
    if (d.book === code && d.chapter === chapter && d.verse === verse) {
      if (!text.includes(d.remove)) throw new Error(`Luther: defect fix for ${code} ${chapter}:${verse} no longer applies`);
      text = text.replace(d.remove, '');
    }
  }
  const own = [...text.matchAll(MARKER)].map((x) => x[1]);
  if (own.length) {
    markerCount += own.length;
    alt[b][`${chapter}:${verse}`] = own.join(' ');
    text = text.replace(MARKER, ' ');
  }
  text = text.replace(/¶\s*/g, '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`Luther: empty verse ${code} ${chapter}:${verse}`);
  const chapters = verses[b];
  while (chapters.length < chapter) chapters.push([]);
  const list = chapters[chapter - 1];
  if (list.length !== verse - 1) throw new Error(`Luther: verses out of order at ${code} ${chapter}:${verse}`);
  list.push(text);
}

const versification = books.map((book, i) => {
  if (!verses[i].length) throw new Error(`Luther: book ${book.code} missing`);
  return verses[i].map((ch) => ch.length);
});
const verseTotal = versification.flat().reduce((a, n) => a + n, 0);
if (verseTotal !== 31102) throw new Error(`Versification has ${verseTotal} verses, expected 31,102 (KJV)`);

// global verse index: books in canonical order, chapters, verses
const bookStart = [];
const chapterStart = [];
{
  let n = 0;
  versification.forEach((chapters, b) => {
    bookStart[b] = n;
    chapterStart[b] = chapters.map((count) => {
      const s = n;
      n += count;
      return s;
    });
  });
}
const verseIndex = (b, c, v) => {
  const counts = versification[b];
  if (c < 1 || c > counts.length || v < 1 || v > counts[c - 1]) return undefined;
  return chapterStart[b][c - 1] + v - 1;
};

books.forEach((book, b) => {
  writeJson(join(OUT_DIR, 'text', 'lut1912', `${book.code}.json`), {
    book: book.code,
    chapters: verses[b],
    alt: alt[b],
  });
});
writeJson(join(OUT_DIR, 'versification.json'), {
  id: 'kjv',
  verses: verseTotal,
  books: books.map((b, i) => ({ code: b.code, first: bookStart[i], chapters: versification[i] })),
});

// ── OpenBible.info cross-references ────────────────────────────────────

const osisIndex = new Map(books.map((b, i) => [b.osis, i]));
const REMAP = new Map([['3John.1.15', '3John.1.14']]); // modern editions split 3 John 1:14
const remapped = [];
function resolve(id, lineNo) {
  const mapped = REMAP.get(id);
  if (mapped) remapped.push(`${lineNo}: ${id} → ${mapped}`);
  const [osis, c, v] = (mapped ?? id).split('.');
  const b = osisIndex.get(osis);
  const index = b === undefined ? undefined : verseIndex(b, Number(c), Number(v));
  if (index === undefined) throw new Error(`OpenBible line ${lineNo}: unknown verse ${id}`);
  return index;
}

const xrefText = readZipMember(openbibleZip, byId.openbible.member);
const [header, ...rows] = xrefText.replace(/^﻿/, '').split(/\r?\n/);
if (!header.startsWith('From Verse\tTo Verse\tVotes')) throw new Error('OpenBible: unexpected header');
const snapshot = /\d{4}-\d{2}-\d{2}/.exec(header)?.[0] ?? null;
const links = [];
const seen = new Set();
let duplicates = 0;
rows.forEach((row, i) => {
  if (!row.trim()) return;
  const lineNo = i + 2;
  const [from, to, votesText, ...rest] = row.split('\t');
  const votes = Number(votesText);
  if (rest.length || !Number.isInteger(votes)) throw new Error(`OpenBible line ${lineNo}: malformed`);
  const [a, z = a] = to.split('-');
  const link = { from: resolve(from, lineNo), start: resolve(a, lineNo), end: resolve(z, lineNo), votes };
  if (link.end < link.start) throw new Error(`OpenBible line ${lineNo}: reversed range`);
  const key = `${link.from}:${link.start}:${link.end}`;
  if (seen.has(key)) {
    duplicates++;
    return;
  }
  seen.add(key);
  links.push(link);
});
links.sort((x, y) => x.from - y.from || y.votes - x.votes || x.start - y.start || x.end - y.end);

// one file per source book: offsets index the links of each verse of that book
const bookOfVerse = new Int16Array(verseTotal);
books.forEach((_, b) => bookOfVerse.fill(b, bookStart[b], bookStart[b] + versification[b].reduce((s, n) => s + n, 0)));
const perBook = books.map(() => []);
for (const l of links) perBook[bookOfVerse[l.from]].push(l);
books.forEach((book, b) => {
  const count = versification[b].reduce((s, n) => s + n, 0);
  const offsets = new Array(count + 1).fill(0);
  for (const l of perBook[b]) offsets[l.from - bookStart[b] + 1]++;
  for (let i = 0; i < count; i++) offsets[i + 1] += offsets[i];
  writeJson(join(OUT_DIR, 'xref', `${book.code}.json`), {
    book: book.code,
    first: bookStart[b],
    offsets,
    start: perBook[b].map((l) => l.start),
    span: perBook[b].map((l) => l.end - l.start),
    votes: perBook[b].map((l) => l.votes),
  });
});

// ── Chapter graph and stable layout ────────────────────────────────────

const chapterOfVerse = new Int32Array(verseTotal);
const chapters = [];
versification.forEach((counts, b) =>
  counts.forEach((count, c) => {
    const id = chapters.length;
    chapters.push({ b, c: c + 1, verses: count });
    chapterOfVerse.fill(id, chapterStart[b][c], chapterStart[b][c] + count);
  }),
);
const pairWeight = new Map();
const degree = new Array(chapters.length).fill(0);
for (const l of links) {
  if (l.votes < 4) continue;
  const a = chapterOfVerse[l.from];
  const z = chapterOfVerse[l.start];
  degree[a]++;
  if (a === z) continue;
  const key = a < z ? `${a}:${z}` : `${z}:${a}`;
  pairWeight.set(key, (pairWeight.get(key) ?? 0) + 1);
}
const edges = [...pairWeight].map(([k, w]) => [...k.split(':').map(Number), w]);
const positions = computeLayout({ books, chapters, edges });

// keep the strongest edges per chapter for overview rendering
const top = new Map();
for (const e of edges) {
  for (const n of [e[0], e[1]]) {
    const list = top.get(n) ?? [];
    list.push(e);
    top.set(n, list);
  }
}
const kept = new Set();
for (const list of top.values()) {
  list.sort((x, y) => y[2] - x[2]);
  list.slice(0, 6).forEach((e) => kept.add(e));
}

writeJson(join(OUT_DIR, 'graph.json'), {
  layout: 'force-directed, deterministic (scripts/data/layout.mjs)',
  minVotes: 4,
  chapters: chapters.map((ch, i) => [ch.b, ch.c, ch.verses, Math.round(positions[i].x), Math.round(positions[i].y), degree[i]]),
  edges: [...kept].sort((x, y) => x[0] - y[0] || x[1] - y[1]),
});

const strong = links.filter((l) => l.votes >= 4).length;
writeJson(join(OUT_DIR, 'meta.json'), {
  generated: new Date().toISOString(),
  versification: 'KJV (31.102 Verse)',
  verses: verseTotal,
  links: links.length,
  linksMin4: strong,
  linksNegative: links.filter((l) => l.votes < 0).length,
  duplicatesDropped: duplicates,
  remapped,
  markersMoved: markerCount,
  snapshot,
  sources: sources.map(({ id, url, license, licenseUrl, homepage, attribution, snapshot: s, retrievedAt, via }) => ({
    id,
    url,
    license,
    licenseUrl,
    homepage,
    attribution,
    snapshot: s,
    retrievedAt,
    via,
  })),
});
writeJson(stampPath, { stamp });

console.log(
  `data: ${verseTotal} verses, ${links.length} links (${strong} with ≥4 votes), ` +
    `${markerCount} German verse markers moved, ${chapters.length} chapters laid out ` +
    `in ${((Date.now() - started) / 1000).toFixed(1)} s`,
);
