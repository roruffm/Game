// Loads the generated datasets from public/data (run `npm run data` first).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Bible, type Versification } from '../src/bible/bible';
import { CrossRefs } from '../src/xref/crossrefs';

const DIR = join(__dirname, '..', 'public', 'data');

export const hasData = existsSync(join(DIR, 'meta.json'));

export const fetchJson = async (path: string) => JSON.parse(readFileSync(join(DIR, path), 'utf8'));

export function loadBible() {
  const versification = JSON.parse(readFileSync(join(DIR, 'versification.json'), 'utf8')) as Versification;
  const bible = new Bible(versification, fetchJson);
  return { bible, xrefs: new CrossRefs(bible, fetchJson) };
}

export const readData = (path: string) => JSON.parse(readFileSync(join(DIR, path), 'utf8'));
