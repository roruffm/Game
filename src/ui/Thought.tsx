// Verses as thoughts: they rise beside the organism, at its eye level, line by line, drift
// along with it like a small cloud and dissolve upwards when the next one comes. No frame and
// no fixed place at the edge of the screen.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { breakLines, lineStarts } from '../state/reading';
import { organismAnchor } from '../state/store';

export interface ThoughtLayout {
  /** Too narrow for text beside the organism: the thought rises above it instead. */
  narrow: boolean;
  width: number;
  fontSize: number;
}

function layoutFor(w: number, h: number): ThoughtLayout {
  if (h < 500) return { narrow: false, width: Math.min(340, w * 0.42), fontSize: 16 };
  const narrow = w < 720;
  return { narrow, width: narrow ? Math.min(360, w - 32) : Math.min(400, Math.max(300, w * 0.34)), fontSize: narrow ? 17 : 19 };
}

export function useThoughtLayout() {
  const [layout, setLayout] = useState(() => layoutFor(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const onResize = () => setLayout(layoutFor(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return layout;
}

let ctx: CanvasRenderingContext2D | null = null;

/** Breaks words into lines that fit the thought, measured in the verse typeface. */
export function useLines(words: string[], layout: ThoughtLayout) {
  return useMemo(() => {
    ctx ??= document.createElement('canvas').getContext('2d');
    if (!ctx) return breakLines(words, 34, (t) => t.length);
    ctx.font = `400 ${layout.fontSize}px "Source Serif 4", Georgia, serif`;
    const c = ctx;
    return breakLines(words, layout.width - 48, (t) => c.measureText(t).width);
  }, [words, layout]);
}

export interface ThoughtItem {
  key: string;
  /** Plain text of each line, for the reading pace. */
  texts: string[];
  /** How each line is drawn. */
  lines: ReactNode[];
  head?: ReactNode;
  /** Shown once every line is there: where the words come from, and what can be done next. */
  foot?: ReactNode;
}

const calm = () => document.body.classList.contains('reduce-motion');

function Unfolding({ item, leaving = false }: { item: ThoughtItem; leaving?: boolean }) {
  const [shown, setShown] = useState(() => (leaving || calm() ? item.lines.length : 0));
  useEffect(() => {
    if (leaving || calm()) return;
    const timers = lineStarts(item.texts).map((t, i) => window.setTimeout(() => setShown((s) => Math.max(s, i + 1)), t * 1000));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // the lines belong to the key; a re-render of the same thought must not restart them
  }, [item.key, leaving]);
  return (
    <div className={`thought-body${leaving ? ' leaving' : ''}`} aria-hidden="true">
      {item.head}
      {item.lines.slice(0, shown).map((line, i) => (
        <div className="tl" key={i}>
          {line}
        </div>
      ))}
      {shown >= item.lines.length && item.foot}
    </div>
  );
}

/**
 * Follows the organism: beside it on wide screens (on the side it is not heading to), above it
 * on narrow ones. The bottom of the thought stays at eye level, so each new line appears close
 * to the organism and lifts the earlier ones.
 */
function useFollow(ref: React.RefObject<HTMLDivElement | null>, narrow: boolean) {
  useEffect(() => {
    let raf = 0;
    let cx = NaN;
    let cy = NaN;
    let side = 1;
    let pending = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const el = ref.current;
      if (el) {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const a = organismAnchor;
        const gap = 54;
        const fitsRight = a.x + gap + w <= W - 12;
        const fitsLeft = a.x - gap - w >= 12;
        let tx: number;
        let ty: number;
        if (narrow || (!fitsRight && !fitsLeft)) {
          tx = Math.max(16, Math.min(W - w - 16, a.x - w / 2));
          ty = a.y - gap - h;
          if (ty < 70) ty = a.y + gap;
        } else {
          // keep the way ahead free; change sides only after the heading has settled
          const want = a.avoid > 0 ? -1 : a.avoid < 0 ? 1 : side;
          pending = want !== side ? pending + dt : 0;
          if (pending > 1.2) {
            side = want;
            pending = 0;
          }
          if (side === 1 && !fitsRight) side = -1;
          else if (side === -1 && !fitsLeft) side = 1;
          tx = side === 1 ? a.x + gap : a.x - gap - w;
          ty = a.y + 26 - h;
        }
        ty = Math.max(64, Math.min(H - h - 12, ty));
        if (Number.isNaN(cx)) {
          cx = tx;
          cy = ty;
        }
        const k = 1 - Math.exp(-dt * 3.2);
        cx += (tx - cx) * k;
        cy += (ty - cy) * k;
        const bob = calm() ? 0 : Math.sin(now / 1700) * 3;
        el.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy + bob)}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ref, narrow]);
}

/** The current thought, with the one before it dissolving upwards. `live` is read out to screen readers. */
export function Thought({ item, layout, className = '', live }: { item: ThoughtItem; layout: ThoughtLayout; className?: string; live: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFollow(ref, layout.narrow);
  const [previous, setPrevious] = useState<ThoughtItem | null>(null);
  const current = useRef(item);
  useEffect(() => {
    if (current.current.key === item.key) {
      current.current = item;
      return;
    }
    setPrevious(current.current);
    current.current = item;
    const t = window.setTimeout(() => setPrevious(null), 1300);
    return () => window.clearTimeout(t);
  }, [item]);
  return (
    <div ref={ref} className={`thought ${className}`} style={{ width: layout.width, fontSize: layout.fontSize }}>
      {previous && <Unfolding key={`${previous.key}:leaving`} item={previous} leaving />}
      <Unfolding key={item.key} item={item} />
      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>
    </div>
  );
}
