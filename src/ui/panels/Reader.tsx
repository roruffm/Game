// Bible view: a whole chapter (Lutherbibel 1912) with the discovered verses lit, and the
// connections that lead out of them.

import { useEffect, useState } from 'react';
import { TRANSLATION, type Range } from '../../bible/bible';
import { BOOKS } from '../../bible/books';
import { director } from '../../director';
import type { TargetGroup } from '../../xref/crossrefs';
import { Icon, Sheet, SourceLine, VerseText, useVerses } from '../common';

export function Reader({ chapter, highlight, onClose }: { chapter: number; highlight: Range[]; onClose: () => void }) {
  const range = director.bible.chapterRange(chapter);
  const verses = useVerses(range);
  const book = BOOKS[director.bible.chapter(chapter).b];
  const [groups, setGroups] = useState<TargetGroup[]>([]);
  const known = director.model.isKnown(chapter);

  useEffect(() => {
    setGroups(director.model.outgoing(chapter).slice(0, 12));
  }, [chapter, known]);

  useEffect(() => {
    if (!verses || !highlight.length) return;
    document.getElementById(`v-${highlight[0].start}`)?.scrollIntoView({ block: 'center' });
  }, [verses, highlight]);

  return (
    <Sheet title={director.bible.formatChapter(chapter)} kicker={`${TRANSLATION} · ${book.t === 'OT' ? 'Altes Testament' : 'Neues Testament'}`} onClose={onClose}>
      {highlight.length > 0 && (
        <p className="lead">
          Entdeckt: {highlight.map((h) => director.bible.format(h, 'short')).join(' · ')}
        </p>
      )}
      {!verses ? (
        <p className="muted">Text wird geladen …</p>
      ) : (
        <div className="reader">
          {verses.map((v) => (
            <span key={v.index} id={`v-${v.index}`}>
              <VerseText verses={[v]} highlight={highlight} />
            </span>
          ))}
        </div>
      )}
      <SourceLine>
        Bibeltext: {TRANSLATION}, gemeinfrei. Versnummern nach der Zählung der Querverweis-Daten (KJV); wo deutsche Ausgaben anders zählen, steht die deutsche Nummer dabei.
        {book.code === 'PSA' && ' In Psalmen zählen deutsche Bibeln die Überschrift oft als eigenen Vers; dort liegt die deutsche Nummer meist um eins oder zwei höher.'}
      </SourceLine>
      <div className="row">
        <button className="btn" onClick={() => director.travelTo(chapter)}>
          <Icon name="travel" /> Hinschweben
        </button>
      </div>
      {groups.length > 0 && (
        <>
          <h3>Verbindungen aus diesem Abschnitt</h3>
          <ul className="links">
            {groups.map((g) => {
              const node = director.model.nodes.get(g.chapter);
              const state = node?.kind === 'hint' ? 'fernes Licht' : director.model.isKnown(g.chapter) ? 'entdeckt' : 'unentdeckt';
              const best = g.links[0];
              return (
                <li key={g.chapter}>
                  <button
                    className="link-row"
                    onClick={() =>
                      director.setPanel({
                        type: 'link',
                        a: { start: best.from, end: best.from },
                        b: { start: best.start, end: Math.min(best.end, director.bible.chapterRange(g.chapter).end) },
                        fromChapter: chapter,
                        toChapter: g.chapter,
                      })
                    }
                  >
                    <span className={`dot ${BOOKS[director.bible.chapter(g.chapter).b].t === 'OT' ? 'ot' : 'nt'}`} />
                    <span className="grow">
                      {director.bible.format(g.range, 'short')} <em>{state}</em>
                    </span>
                    <span className="votes">{g.links.length > 1 ? `${g.links.length} Verweise · ` : ''}{g.votes} Stimmen</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Sheet>
  );
}
