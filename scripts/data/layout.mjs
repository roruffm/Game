// Stable world layout for all 1,189 chapters.
//
// The New Testament forms the core: the four Gospels are spiral arms around the centre,
// Acts continues Luke's arm outward, the letters and Revelation sit in outer clusters.
// A deterministic force simulation then pulls chapters that share many cross-references
// (≥4 votes) towards each other, so the Synoptic parallels drift together while every
// book keeps its shape. The Old Testament lies in a ring around it, in canonical order:
// the "Quellgrund" the New Testament draws on. No randomness: same data, same map.

const TAU = Math.PI * 2;

export function computeLayout({ books, chapters, edges }) {
  const byBook = books.map(() => []);
  chapters.forEach((ch, i) => byBook[ch.b].push(i));
  const pos = chapters.map(() => ({ x: 0, y: 0 }));
  const anchor = chapters.map(() => ({ x: 0, y: 0 }));
  const nt = new Set();

  const place = (i, x, y) => {
    pos[i] = { x, y };
    anchor[i] = { x, y };
  };
  const code = (c) => books.findIndex((b) => b.code === c);

  // Gospels: four spiral arms
  const arms = { MAT: -0.35, MAR: 1.25, LUK: 2.85, JOH: 4.45 };
  for (const [c, base] of Object.entries(arms)) {
    const list = byBook[code(c)];
    list.forEach((i, k) => {
      const t = k / Math.max(1, list.length - 1);
      const r = 150 + t * 820;
      const a = base + t * 1.5;
      place(i, Math.cos(a) * r, Math.sin(a) * r);
      nt.add(i);
    });
  }
  // Acts continues Luke's arm outward
  byBook[code('ACT')].forEach((i, k, list) => {
    const t = k / (list.length - 1);
    const r = 1030 + t * 520;
    const a = arms.LUK + 1.5 + t * 0.9;
    place(i, Math.cos(a) * r, Math.sin(a) * r);
    nt.add(i);
  });
  // letters and Revelation: one small cluster per book on an outer arc
  const cluster = (codes, from, to, radius) => {
    codes.forEach((c, n) => {
      const a = from + ((to - from) * n) / Math.max(1, codes.length - 1);
      const cx = Math.cos(a) * radius;
      const cy = Math.sin(a) * radius;
      const list = byBook[code(c)];
      list.forEach((i, k) => {
        const ring = 22 + list.length * 7;
        const b = (k / list.length) * TAU + a;
        place(i, cx + Math.cos(b) * (list.length > 1 ? ring : 0), cy + Math.sin(b) * (list.length > 1 ? ring : 0));
        nt.add(i);
      });
    });
  };
  cluster(['ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHI', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM'], 4.95, 6.6, 1520);
  cluster(['HEB', 'JAM', '1PE', '2PE', '1JO', '2JO', '3JO', 'JUD'], 0.55, 1.75, 1560);
  byBook[code('REV')].forEach((i, k, list) => {
    const t = k / (list.length - 1);
    const a = 2.1 + t * 0.55;
    const r = 1480 + Math.sin(t * Math.PI) * 120;
    place(i, Math.cos(a) * r, Math.sin(a) * r);
    nt.add(i);
  });

  // Old Testament ring
  const GAP = 5;
  const ot = books.map((b, i) => (b.t === 'OT' ? i : -1)).filter((i) => i >= 0);
  const slots = ot.reduce((n, b) => n + byBook[b].length + GAP, 0);
  const ringOffset = { law: 0, history: 150, wisdom: -120, prophets: 90 };
  let slot = 0;
  for (const b of ot) {
    const list = byBook[b];
    list.forEach((i, k) => {
      const a = -Math.PI / 2 + ((slot + k) / slots) * TAU;
      const r = 2450 + ringOffset[books[b].group] + Math.sin(k * 0.37 + b) * 26 + Math.sin(k * 0.13) * 40;
      place(i, Math.cos(a) * r, Math.sin(a) * r);
    });
    slot += list.length + GAP;
  }

  // force simulation over the New Testament, using each chapter's three strongest links
  const strongest = new Map();
  for (const e of edges) {
    if (!nt.has(e[0]) || !nt.has(e[1])) continue;
    for (const n of [e[0], e[1]]) strongest.set(n, [...(strongest.get(n) ?? []), e]);
  }
  const ntEdges = [...new Set([...strongest.values()].flatMap((list) => list.sort((x, y) => y[2] - x[2]).slice(0, 3)))];
  const chain = [];
  byBook.forEach((list, b) => {
    if (books[b].t !== 'NT') return;
    for (let k = 1; k < list.length; k++) chain.push([list[k - 1], list[k]]);
  });
  const ids = [...nt];
  const force = chapters.map(() => ({ x: 0, y: 0 }));
  const spring = (a, z, rest, k) => {
    const dx = pos[z].x - pos[a].x;
    const dy = pos[z].y - pos[a].y;
    const d = Math.hypot(dx, dy) || 0.01;
    const f = (d - rest) * k;
    force[a].x += (dx / d) * f;
    force[a].y += (dy / d) * f;
    force[z].x -= (dx / d) * f;
    force[z].y -= (dy / d) * f;
  };
  for (let iter = 0; iter < 420; iter++) {
    const cool = 1 - iter / 480;
    for (const i of ids) force[i] = { x: (anchor[i].x - pos[i].x) * 0.03, y: (anchor[i].y - pos[i].y) * 0.03 };
    for (const [a, z] of chain) spring(a, z, 58, 0.06);
    for (const [a, z, w] of ntEdges) spring(a, z, 200, 0.004 * Math.log2(1 + w));
    for (let p = 0; p < ids.length; p++) {
      for (let q = p + 1; q < ids.length; q++) {
        const a = ids[p];
        const z = ids[q];
        const dx = pos[z].x - pos[a].x;
        const dy = pos[z].y - pos[a].y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d > 120) continue;
        const f = (120 - d) * 0.08;
        force[a].x -= (dx / d) * f;
        force[a].y -= (dy / d) * f;
        force[z].x += (dx / d) * f;
        force[z].y += (dy / d) * f;
      }
    }
    for (const i of ids) {
      const fx = Math.max(-18, Math.min(18, force[i].x)) * cool;
      const fy = Math.max(-18, Math.min(18, force[i].y)) * cool;
      pos[i] = { x: pos[i].x + fx, y: pos[i].y + fy };
    }
  }
  return pos;
}
