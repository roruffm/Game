// After an encounter: understand (the key verse, the whole text, a question) and
// connect (the strongest cross-references out of the passage).

import { useEffect, useState } from 'react';
import { TRANSLATION } from '../../bible/bible';
import { encounterById, type EncounterId } from '../../content/encounters';
import { EDITORIAL } from '../../content/editorial';
import { director } from '../../director';
import { persist } from '../../state/save';
import type { TargetGroup } from '../../xref/crossrefs';
import { Icon, Sheet, VerseText, useVerses } from '../common';

export function EncounterEnd({ id }: { id: EncounterId }) {
  const info = encounterById(id);
  const bible = director.bible;
  const range = bible.range(info.range);
  const key = bible.range(info.keyVerse);
  const keyVerse = useVerses(key);
  const [full, setFull] = useState(false);
  const passage = useVerses(full ? range : null);
  const [note, setNote] = useState(director.save.notes[id] ?? '');
  const [groups, setGroups] = useState<TargetGroup[]>([]);
  const editorial = EDITORIAL.filter((e) => {
    const from = bible.range(e.from).start;
    return from >= range.start && from <= range.end;
  });

  useEffect(() => {
    director.xrefs
      .from(range, director.save.settings.minVotes)
      .then((links) => setGroups(director.xrefs.groupByChapter(links, (ch) => ch === bible.chapterOf(range.start)).slice(0, 8)));
  }, [range.start, range.end]);

  const back = () => director.returnToWorld();

  return (
    <Sheet title={info.title} kicker={`Begegnung · ${bible.format(range)}`} onClose={back} wide>
      {keyVerse && (
        <blockquote className="key-verse">
          <VerseText verses={keyVerse} numbers={false} />
          <cite>
            {bible.format(key)} · {TRANSLATION}
          </cite>
        </blockquote>
      )}
      <button className="btn small" onClick={() => setFull(!full)}>
        <Icon name="read" /> {full ? 'Text ausblenden' : `Ganzen Text lesen (${bible.format(range, 'short')})`}
      </button>
      {full && passage && (
        <div className="reader">
          <VerseText verses={passage} />
        </div>
      )}

      <h3>Zum Nachdenken</h3>
      <p>{info.question}</p>
      <label className="field">
        <span>Deine Gedanken (freiwillig, ohne Bewertung, nur auf diesem Gerät gespeichert)</span>
        <textarea
          id={`note-${id}`}
          rows={3}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            director.save.notes[id] = e.target.value;
            persist(director.save);
          }}
        />
      </label>

      <h3>Neue Verbindungen</h3>
      <p className="muted">Aus diesem Abschnitt führen Querverweise zu anderen Stellen. In der Welt leuchten sie jetzt als Lichtfäden und ferne Lichter.</p>
      <ul className="links">
        {groups.map((g) => {
          const best = g.links[0];
          return (
            <li key={g.chapter}>
              <button
                className="link-row"
                onClick={() =>
                  director.setPanel({
                    type: 'link',
                    a: { start: best.from, end: best.from },
                    b: { start: best.start, end: Math.min(best.end, bible.chapterRange(g.chapter).end) },
                    fromChapter: bible.chapterOf(range.start),
                    toChapter: g.chapter,
                  })
                }
              >
                <span className={`dot ${bible.book(g.range.start).t === 'OT' ? 'ot' : 'nt'}`} />
                <span className="grow">{bible.format(g.range, 'short')}</span>
                <span className="votes">{g.votes} Stimmen</span>
              </button>
            </li>
          );
        })}
      </ul>
      {editorial.length > 0 && (
        <>
          <h3>Ausgewählt und erklärt</h3>
          <ul className="links">
            {editorial.map((e) => {
              const a = bible.range(e.from);
              const b = bible.range(e.to);
              return (
                <li key={e.from + e.to}>
                  <button
                    className="link-row"
                    onClick={() => director.setPanel({ type: 'link', a, b, fromChapter: bible.chapterOf(a.start), toChapter: bible.chapterOf(b.start) })}
                  >
                    <span className={`dot ${bible.book(b.start).t === 'OT' ? 'ot' : 'nt'}`} />
                    <span className="grow">
                      {e.title} <em>{bible.format(a, 'short')} → {bible.format(b, 'short')}</em>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="row">
        <button className="btn primary" id="return-world" onClick={back}>
          Zurück in den Wortstrom
        </button>
      </div>
    </Sheet>
  );
}
