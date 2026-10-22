// Pixel art as text. Each character is one pixel, '.' is transparent.
// Characters map to colours through PALETTE; NPCs reuse the shepherd with swapped colours.

export const PALETTE: Record<string, string> = {
  k: '#1c1424', // outline
  c: '#e6d3a3', // head cloth
  C: '#b39466', // head cloth shade
  d: '#34508a', // head band
  s: '#c68a5e', // skin
  S: '#93603f', // skin shade
  B: '#4a2f22', // beard
  b: '#b5533c', // robe
  o: '#7e3427', // robe shade
  g: '#d9a441', // sash
  y: '#8a5a2e', // staff
  w: '#f4eedd', // wool
  W: '#c9bfa8', // wool shade
  f: '#3a2f3f', // sheep face and legs
  m: '#d98a8a', // mouth
  p: '#f1deb0', // parchment
  P: '#c9a66b', // parchment shade
  q: '#8a6a3c', // writing
  G: '#ffd66b', // glow gold
  l: '#fff6cf', // glow light
  n: '#5a3e2e', // thorn branch
  N: '#3a2722', // thorn branch dark
  x: '#b83a3a', // thorn berry
  v: '#6f8f3a', // leaf
  V: '#4b6a2a', // leaf dark
  u: '#93ad4f', // leaf light
  a: '#2d5d8f', // water
  A: '#7fd3ff', // water lit
  e: '#ffffff', // sparkle
  r: '#8a8396', // stone
  R: '#5f5a6e', // stone shade
};

export type Pixels = string[];

const SHEPHERD_UPPER: Pixels = [
  '................',
  '.....kkkkkk..yy.',
  '....kccccccky..y',
  '....kcdddddk...y',
  '....kccssesk...y',
  '....kccssssk...y',
  '....kcCsBBBk...y',
  '.....kCkBBk....y',
  '....kbbbbbbk...y',
  '...kbbbbbbbbkssy',
  '...kbbbbbbbok..y',
  '...kggggggggk..y',
  '...kbbbbbbbok..y',
  '....kbbbbbok...y',
];

const LEGS = {
  stand: ['....kSk..kSk...y', '....kkk..kkk...y'],
  stride: ['...kSk....kSk..y', '..kkk.....kkk..y'],
  pass: ['.....kSSk......y', '.....kkkk......y'],
  tuck: ['....kSkkSk.....y', '...............y'],
  dangle: ['....kSk..kSk...y', '....kk....kk...y'],
};

function shepherdFrame(legs: keyof typeof LEGS, bob = false): Pixels {
  const upper = bob ? ['................', ...SHEPHERD_UPPER.slice(0, 12), SHEPHERD_UPPER[13]] : SHEPHERD_UPPER;
  return [...upper, ...LEGS[legs]];
}

/** 0–1 idle, 2–3 run, 4 jump, 5 fall. */
export const SHEPHERD_FRAMES: Pixels[] = [
  shepherdFrame('stand'),
  shepherdFrame('stand', true),
  shepherdFrame('stride'),
  shepherdFrame('pass', true),
  shepherdFrame('tuck'),
  shepherdFrame('dangle'),
];

/** Neighbours are the shepherd without a staff: idle, idle, jump. */
export const NEIGHBOUR_FRAMES: Pixels[] = [0, 1, 4].map((i) =>
  SHEPHERD_FRAMES[i].map((row) => (row.slice(0, 13) + '...').replace(/y/g, '.')),
);

/** Colour overrides that turn the shepherd into different neighbours. */
export const NEIGHBOUR_PALETTES: Record<string, string>[] = [
  { b: '#3e6e8e', o: '#29495f', c: '#d8c7e0', C: '#a593b0', d: '#7a3b5e', B: '#5a3a2a' },
  { b: '#5f7d3a', o: '#3f5626', c: '#f0e2c0', C: '#c2ab7e', d: '#a13d2d', s: '#a86f48', S: '#7a4d31', B: '#a86f48' },
  { b: '#8a4f8f', o: '#5e3462', c: '#e9d9b0', C: '#b8a274', d: '#2d6b6b', s: '#e0ab80', S: '#b07c55', B: '#e0ab80' },
];

export const SHEEP_FRAMES: Pixels[] = [
  [
    '................',
    '...kkkkkkk......',
    '..kwwwwwwwk.kkk.',
    '.kwwwwwwwwwkfffk',
    'kwwwwwwwwwwkfefk',
    'kwwWwwwwwwwkfffk',
    'kwwwwwWwwwwwkfk.',
    '.kWwwwwwwwWWk...',
    '..kWWWWWWWWk....',
    '..kfk.kfk.kfk...',
    '..kfk.kfk.kfk...',
    '..kkk.kkk.kkk...',
  ],
  [
    '............kkk.',
    '...kkkkkkk.kfffk',
    '..kwwwwwwwkkfefk',
    '.kwwwwwwwwwkfffk',
    'kwwwwwwwwwwkfmfk',
    'kwwWwwwwwwwwkmk.',
    'kwwwwwWwwwwwkk..',
    '.kWwwwwwwwWWk...',
    '..kWWWWWWWWk....',
    '..kfk.kfk.kfk...',
    '..kfk.kfk.kfk...',
    '..kkk.kkk.kkk...',
  ],
  // grazing
  [
    '................',
    '...kkkkkkk......',
    '..kwwwwwwwk.....',
    '.kwwwwwwwwwk....',
    'kwwwwwwwwwwk....',
    'kwwWwwwwwwwkkkk.',
    'kwwwwwWwwwwkfffk',
    '.kWwwwwwwwWkfefk',
    '..kWWWWWWWWkfffk',
    '..kfk.kfk.kfkkk.',
    '..kfk.kfk.kfk...',
    '..kkk.kkk.kkk...',
  ],
];

/** The sheep lying across the shepherd's shoulders, drawn behind him. */
export const CARRIED_SHEEP: Pixels = [
  '.....kkkkkkkkkkkk.....',
  '...kkwwwwwwwwwwwwkkkk.',
  '..kwwwwwwwwwwwwwwkfffk',
  '.kwwWwwwwwwwwwwwWkfefk',
  'kfkwwwwwwwwwwwwwwkfffk',
  'kfkWwwwwwwwwwwwwWWkfk.',
  'kfk.kWWWWWWWWWWWWk.k..',
  'kkk..kkkkkkkkkkkk.....',
];

export const FRAGMENT: Pixels = [
  '............',
  '.kk......kk.',
  'kPPkkkkkkPPk',
  'kPpppppppPPk',
  'kPpqqqqqpPPk',
  'kPpppppppPPk',
  'kPpqqqqppPPk',
  'kPpppppppPPk',
  'kPpqqqqqpPPk',
  'kPPkkkkkkPPk',
  '.kk......kk.',
  '............',
];

const WELL = (water: string): Pixels => [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.krrRrrrRrrrRrk.',
  water,
  '.krRrrRrrrRrrrk.',
  '.kRrrrRrrRrrRrk.',
  '.krrRrrrRrrrRrk.',
  '.kRrrRrrrrRrrRk.',
  '..kkkkkkkkkkkk..',
];
/** Resting place: dark water until you reach it, then it lights up. */
export const WELL_FRAMES: Pixels[] = [WELL('.kRaaaaaaaaaaRk.'), WELL('.kRAAeAAAAeAARk.')];

export const THORNS: Pixels = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......n........',
  '..n...nNn...n...',
  '..Nn.n.N.n.nN...',
  '...NnN.N.NnN..n.',
  '.n..NNxNNN...nN.',
  '.Nn..NNNNx..nN..',
  '..NnNNnNNNnNN...',
  '.x.NNNNNNNNN.n..',
  '..nNNNxNNNNNnN..',
  '.nNNNNNNNNNNNNn.',
  'NNNNNNNNNNNNNNNN',
];

export const BUSH: Pixels = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....kkkk.......',
  '...kkuvvvkkk....',
  '..kuuvvvVvvvk...',
  '.kuvvvVvvvVvvk..',
  '.kvvVvvvvVVvvVk.',
  'kuvvvvVvvvvVvvVk',
  'kvVvvVVvvVvvVVVk',
  '.kVVVVnVVVnVVVk.',
  '..kkkknkkknkkk..',
];

export const WOOL_TUFT: Pixels = ['..ww..', '.wwWw.', 'wWwwww', '.wWww.'];

export const BUBBLE: Pixels = [
  '.kkkkkkkkk.',
  'kwwwwkwwwwk',
  'kwwwwkwwwwk',
  'kwwwwkwwwwk',
  'kwwwwwwwwwk',
  'kwwwwkwwwwk',
  '.kkkwwkkkk.',
  '....kwk....',
  '.....k.....',
];

export const NOTE: Pixels = ['..kk', '..kG', '..kG', 'kkkG', 'kGGk', '.kk.'];

export const ICON_SHEEP: Pixels = SHEEP_FRAMES[0];

export function validate(name: string, px: Pixels) {
  const w = px[0].length;
  px.forEach((row, i) => {
    if (row.length !== w) throw new Error(`${name}: row ${i} has ${row.length} pixels, expected ${w}`);
    for (const ch of row) if (ch !== '.' && !PALETTE[ch]) throw new Error(`${name}: unknown colour '${ch}'`);
  });
}

export function drawPixels(
  ctx: CanvasRenderingContext2D,
  px: Pixels,
  ox = 0,
  oy = 0,
  palette: Record<string, string> = PALETTE,
  scale = 1,
) {
  px.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = palette[ch] ?? PALETTE[ch];
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  });
}

/** A data URL of a sprite, for crisp icons in the HTML interface. */
export function spriteDataUrl(px: Pixels, scale = 4): string {
  const c = document.createElement('canvas');
  c.width = px[0].length * scale;
  c.height = px.length * scale;
  drawPixels(c.getContext('2d')!, px, 0, 0, PALETTE, scale);
  return c.toDataURL();
}
