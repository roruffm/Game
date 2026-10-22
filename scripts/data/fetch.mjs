// Downloads missing source files and checks every file against its SHA-256 pin.
// Usage: npm run data:fetch

import { ensureSource, loadSources } from './lib.mjs';

for (const source of loadSources()) {
  await ensureSource(source);
  console.log(`✓ ${source.id} (${source.license})`);
}
