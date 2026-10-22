// Shared helpers for the data pipeline: paths, pinned sources, ZIP members.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = join(ROOT, 'data');
export const OUT_DIR = join(ROOT, 'public', 'data');

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export function loadSources() {
  return readJson(join(DATA_DIR, 'sources.json')).sources;
}

/** Downloads a pinned source if it is missing and refuses any file whose hash does not match. */
export async function ensureSource(source, { log = console.log } = {}) {
  const path = join(DATA_DIR, source.file);
  if (!existsSync(path)) {
    log(`↓ ${source.id}: ${source.url}`);
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`${source.id}: download failed with HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const got = sha256(buf);
    if (got !== source.sha256) {
      throw new Error(
        `${source.id}: SHA-256 ${got} does not match the pin ${source.sha256}. ` +
          'The upstream file changed; review it and update data/sources.json.',
      );
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, buf);
    return buf;
  }
  const buf = readFileSync(path);
  const got = sha256(buf);
  if (got !== source.sha256) {
    throw new Error(`${source.id}: ${source.file} has SHA-256 ${got}, expected ${source.sha256}.`);
  }
  return buf;
}

export function readZipMember(buf, member) {
  const files = unzipSync(new Uint8Array(buf), { filter: (f) => f.name === member });
  const data = files[member];
  if (!data) throw new Error(`ZIP member ${member} not found`);
  return strFromU8(data);
}
