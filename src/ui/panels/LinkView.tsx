// One connection, examined: both passages side by side, the data behind the link, an
// automatic hint (shared words) and, where it exists, a checked editorial explanation.
// The three kinds are always labelled apart.

import { useEffect, useState } from 'react';
import { TRANSLATION, type Range } from '../../bible/bible';
import { EDITORIAL, type EditorialNote } from '../../content/editorial';
import { director } from '../../director';
import { XREF_SOURCE, type XLink } from '../../xref/crossrefs';
import { sharedWords } from '../../xref/hints';
import { Icon, Sheet, VerseText, useVerses } from '../common';

function findEditorial(from: number, b: Range): EditorialNote | undefined {
  return EDITORIAL.find((e) => {
    const src = director.bible.range(e.from);
    const dst = director.bible.range(e.to);
    return src.start === from && dst.start <= b.end && b.start <= dst.end;
  });
}

export function LinkView({ a, b, fromChapter, toChapter, onClose }: { a: Range; b: Range; fromChapter: number; toChapter: number; onClose: () => void }) {
  const [current, setCurrent] = useState({ a, b });
  const [links, setLinks] = useState<XLink[] | null>(null);
  const [others, setOthers] = useState<XLink[]>([]);
  const va = useVerses(current.a);
  const vb = useVerses(current.b);
  const bible = director.bible;

  useEffect(() => setCurrent({ a, b }), [a, b]);

  useEffect(() => {
    let live = true;
    director.xrefs.between(current.a, current.b, -1000).then((l) => live && setLinks(l));
    return () => {
      live = false;
    };
  }, [current]);

  useEffect(() => {
    // other links between the same two chapters, in either direction
    let live = true;
    Promise.all([
      director.xrefs.between(bible.chapterRange(fromChapter), bible.chapterRange(toChapter), director.save.settings.minVotes),
    ]).then(([l]) => live && setOthers(l.slice(0, 8)));
    return () => {
      live = false;
    };
  }, [fromChapter, toChapter, bible]);

  const direct = links?.find((l) => l.from === current.a.start) ?? links?.[0];
  const editorial = findEditorial(current.a.start, current.b) ?? (links ? findEditorial(current.b.start, current.a) : undefined);
  const words = va && vb ? sharedWords(va.map((v) => v.text).join(' '), vb.map((v) => v.text).join(' ')) : [];
  const targetKnown = director.model.isKnown(toChapter);
  const ot = bible.book(current.b.start).t === 'OT';

  return (
    <Sheet title="Verbindung" kicker={ot ? 'Quellfaden ins Alte Testament' : 'Lichtfaden'} onClose={onClose} wide>
      <div className="compare">
        <article>
          <h3>{bible.format(current.a)}</h3>
          {va ? <VerseText verses={va} numbers={false} /> : <p className="muted">…</p>}
        </article>
        <div className="bridge" aria-hidden="true" />
        <article>
          <h3>{bible.format(current.b)}</h3>
          {vb ? <VerseText verses={vb} numbers={false} /> : <p className="muted">…</p>}
        </article>
      </div>
      <p className="source-line">Bibeltext: {TRANSLATION}</p>

      <div className="tier data">
        <p className="tier-label">Im Datensatz</p>
        {direct ? (
          <p>
            {XREF_SOURCE.name} verbindet {bible.format({ start: direct.from, end: direct.from }, 'short')} mit {bible.format({ start: direct.start, end: direct.end }, 'short')}.{' '}
            <strong>{direct.votes} Stimmen</strong> von Leserinnen und Lesern halten diese Verbindung für hilfreich.
          </p>
        ) : (
          <p className="muted">{links ? 'Für genau diese Verse ist im Datensatz keine direkte Verbindung verzeichnet.' : 'Wird geprüft …'}</p>
        )}
        <p className="fine">
          Quelle: {XREF_SOURCE.name} ({XREF_SOURCE.license}), überwiegend aus dem gemeinfreien „Treasury of Scripture Knowledge“. Ein Querverweis
          bedeutet: Hier besteht ein möglicher, gedeuteter Zusammenhang – nicht, dass die eine Stelle die andere beweist.
        </p>
      </div>

      {words.length > 0 && (
        <div className="tier auto">
          <p className="tier-label">Automatischer Hinweis</p>
          <p>
            Beide Stellen teilen Wörter: <strong>{words.join(', ')}</strong>.
          </p>
          <p className="fine">Vom Spiel berechnet. Ein gemeinsames Wort ist ein Anhaltspunkt zum Vergleichen, keine Auslegung.</p>
        </div>
      )}

      {editorial && (
        <div className="tier editorial">
          <p className="tier-label">Redaktionelle Erklärung</p>
          <h4>{editorial.title}</h4>
          <p>{editorial.text}</p>
          <p className="fine">Für dieses Spiel geschrieben und an den Texten geprüft. Eine Auslegung – sie kann helfen, ersetzt aber nicht das eigene Lesen.</p>
        </div>
      )}

      <div className="row">
        {inWorld() && (
          <button className="btn primary" onClick={() => director.travelTo(toChapter)}>
            <Icon name="travel" /> {targetKnown ? 'Hinschweben' : 'Dem Faden folgen'}
          </button>
        )}
        <button className="btn" onClick={() => director.openReader(toChapter, [current.b])}>
          <Icon name="read" /> Ganzes Kapitel lesen
        </button>
      </div>

      {others.length > 1 && (
        <>
          <h3>Weitere Verweise zwischen {bible.formatChapter(fromChapter, 'short')} und {bible.formatChapter(toChapter, 'short')}</h3>
          <ul className="links">
            {others.map((l) => {
              const reversed = bible.chapterOf(l.from) !== fromChapter;
              const from = { start: l.from, end: l.from };
              const to = { start: l.start, end: l.end };
              return (
                <li key={`${l.from}-${l.start}-${l.end}`}>
                  <button className="link-row" onClick={() => setCurrent(reversed ? { a: to, b: from } : { a: from, b: to })}>
                    <span className="grow">
                      {bible.format(from, 'short')} → {bible.format(to, 'short')}
                    </span>
                    <span className="votes">{l.votes} Stimmen</span>
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

function inWorld() {
  return director.encounter === null;
}
