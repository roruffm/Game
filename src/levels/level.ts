// Levels are drawn as ASCII maps. One character is one 16×16 tile.
//
//   .  sky            ,  cave (dark background)
//   #  earth          R  rock            =  ledge you can jump through from below
//   T  thorns (sky)   t  thorns (cave)
//   P  player start   S  lost sheep      1–9  verse fragment by index
//   C  resting place (checkpoint)        G  gate, opens when touched from the right
//   H  home zone      h  sheep of the herd       N  neighbour (appears at the end)
//   b  bush           W  bush with a tuft of wool (trail to the sheep)

export interface TilePoint {
  tx: number;
  ty: number;
}

export interface Fragment extends TilePoint {
  index: number;
}

export interface LevelData {
  width: number;
  height: number;
  rows: string[];
  start: TilePoint;
  sheep: TilePoint;
  fragments: Fragment[];
  checkpoints: TilePoint[];
  thorns: TilePoint[];
  gate: TilePoint[];
  wool: TilePoint[];
  bushes: TilePoint[];
  home: TilePoint[];
  herd: TilePoint[];
  neighbours: TilePoint[];
}

const SOLID = new Set(['#', 'R']);

export function parseLevel(map: string): LevelData {
  const rows = map
    .split('\n')
    .map((r) => r.trimEnd())
    .filter((r) => r.length > 0);
  const width = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => r.padEnd(width, '.'));

  const level: LevelData = {
    width,
    height: padded.length,
    rows: padded,
    start: { tx: -1, ty: -1 },
    sheep: { tx: -1, ty: -1 },
    fragments: [],
    checkpoints: [],
    thorns: [],
    gate: [],
    wool: [],
    bushes: [],
    home: [],
    herd: [],
    neighbours: [],
  };

  padded.forEach((row, ty) => {
    [...row].forEach((ch, tx) => {
      const p = { tx, ty };
      switch (ch) {
        case 'P':
          level.start = p;
          break;
        case 'S':
          level.sheep = p;
          break;
        case 'C':
          level.checkpoints.push(p);
          break;
        case 'T':
        case 't':
          level.thorns.push(p);
          break;
        case 'G':
          level.gate.push(p);
          break;
        case 'W':
          level.wool.push(p);
          break;
        case 'b':
          level.bushes.push(p);
          break;
        case 'H':
          level.home.push(p);
          break;
        case 'h':
          level.herd.push(p);
          break;
        case 'N':
          level.neighbours.push(p);
          break;
        default:
          if (ch >= '1' && ch <= '9') level.fragments.push({ ...p, index: Number(ch) });
      }
    });
  });
  level.fragments.sort((a, b) => a.index - b.index);
  return level;
}

export function charAt(level: LevelData, tx: number, ty: number): string {
  if (ty < 0) return '.';
  if (ty >= level.height) return '.';
  if (tx < 0 || tx >= level.width) return 'R';
  return level.rows[ty][tx];
}

export function isSolid(level: LevelData, tx: number, ty: number): boolean {
  return SOLID.has(charAt(level, tx, ty));
}

export function isOneWay(level: LevelData, tx: number, ty: number): boolean {
  return charAt(level, tx, ty) === '=';
}

/** Whether a non-solid cell shows the dark cave background instead of the sky. */
export function isCave(level: LevelData, tx: number, ty: number): boolean {
  const ch = charAt(level, tx, ty);
  if (ch === ',' || ch === 't') return true;
  if (ch === '.' || SOLID.has(ch)) return false;
  // Markers take the background of their nearest open neighbour in the row.
  for (let d = 1; d < 4; d++) {
    for (const n of [charAt(level, tx - d, ty), charAt(level, tx + d, ty)]) {
      if (n === ',' || n === 't') return true;
      if (n === '.') return false;
    }
  }
  return false;
}
