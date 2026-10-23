// Small shared pieces of the interface.

import { useEffect, useState, type ReactNode } from 'react';
import type { Range, Verse } from '../bible/bible';
import { director } from '../director';

export type IconName = 'map' | 'journal' | 'sound' | 'mute' | 'settings' | 'close' | 'plus' | 'minus' | 'travel' | 'read' | 'leave' | 'search' | 'pulse';

const PATHS: Record<IconName, string> = {
  map: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  journal: 'M6 4h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 4h7M8 11h7M8 14h5',
  sound: 'M4 10v4h3l5 4V6L7 10H4Zm12-1.5a4 4 0 0 1 0 7M18.5 6a7.5 7.5 0 0 1 0 12',
  mute: 'M4 10v4h3l5 4V6L7 10H4Zm12 0 5 5m0-5-5 5',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0-6v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  travel: 'M4 12c4-6 12-6 16 0M14 8l6 4-6 4',
  read: 'M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4V5Zm16 0h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6V5Z',
  leave: 'M14 7l-5 5 5 5M9 12h11M4 4v16',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4',
  pulse: 'M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM8.5 8.5a5 5 0 0 0 0 7m7-7a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8m12.8-12.8a9 9 0 0 1 0 12.8',
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Sheet({ title, kicker, onClose, children, wide = false }: { title: string; kicker?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-label={title}>
      <header className="sheet-head">
        <div>
          {kicker && <p className="kicker">{kicker}</p>}
          <h2>{title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Schließen" title="Schließen (Esc)">
          <Icon name="close" />
        </button>
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  );
}

/** Loads verse texts for a range (Lutherbibel 1912). */
export function useVerses(range: Range | null): Verse[] | null {
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const start = range?.start;
  const end = range?.end;
  useEffect(() => {
    if (start === undefined || end === undefined) return;
    let live = true;
    setVerses(null);
    director.bible.verses({ start, end }).then((v) => live && setVerses(v));
    return () => {
      live = false;
    };
  }, [start, end]);
  return verses;
}

export function VerseText({ verses, highlight = [], numbers = true }: { verses: Verse[]; highlight?: Range[]; numbers?: boolean }) {
  return (
    <p className="scripture">
      {verses.map((v) => {
        const lit = highlight.some((h) => v.index >= h.start && v.index <= h.end);
        return (
          <span key={v.index} className={lit ? 'lit' : undefined}>
            {numbers && (
              <sup className="vn" title={v.germanNumber ? `In deutschen Ausgaben: ${v.germanNumber.replace(':', ',')}` : undefined}>
                {v.ref.v}
                {v.germanNumber ? <span className="alt"> (dt. {v.germanNumber.replace(':', ',')})</span> : null}
              </sup>
            )}
            {v.text}{' '}
          </span>
        );
      })}
    </p>
  );
}

export function SourceLine({ children }: { children: ReactNode }) {
  return <p className="source-line">{children}</p>;
}
