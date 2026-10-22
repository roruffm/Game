// Writes the app icons (PNG) from a small pixel drawing. Run: npm run icons
// Uses only Node built-ins: a minimal PNG encoder on top of zlib.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

// 16×16: the shepherd's lantern on a dusk background.
const ART = [
  '................',
  '......kkkk......',
  '.....k....k.....',
  '......kkkk......',
  '.....kHHHHk.....',
  '....kGllllGk....',
  '....kGlllllk....',
  '....kGlleGlk....',
  '....kGllllGk....',
  '....kGGllGGk....',
  '.....kHHHHk.....',
  '......kkkk......',
  '................',
  'vvvvvvvvvvvvvvvv',
  'eeeeeeeeeeeeeeee',
  'eeeeeeeeeeeeeeee',
];
const COLORS = {
  k: [28, 20, 36],
  H: [74, 50, 28],
  G: [227, 154, 59],
  l: [255, 246, 207],
  e: [164, 109, 66],
  v: [125, 148, 64],
};

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      raw.set([r, g, b], y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function icon(size) {
  // the art fills the middle 75% so it survives round "maskable" crops
  const art = Math.floor((size * 0.75) / 16) * 16;
  const cell = art / 16;
  const off = Math.floor((size - art) / 2);
  return png(size, (x, y) => {
    const ax = Math.floor((x - off) / cell);
    const ay = Math.floor((y - off) / cell);
    const ch = ART[ay]?.[ax];
    if (ch && ch !== '.' && x >= off && y >= off) return COLORS[ch];
    // dusk gradient, warm glow around the lantern
    const t = y / size;
    const glow = Math.max(0, 1 - Math.hypot(x - size / 2, y - size * 0.42) / (size * 0.45));
    return [16 + 60 * t + 90 * glow, 13 + 20 * t + 70 * glow, 34 + 40 * t + 20 * glow].map((v) => Math.min(255, Math.round(v)));
  });
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/icons/${name}`, icon(size));
}
console.log('icons written to public/icons');
