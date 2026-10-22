// Overview: discovered passages, opened connections, thematic constellations and search.

import { useMemo, useState } from 'react';
import { BOOKS } from '../../bible/books';
import { ENCOUNTERS } from '../../content/encounters';
import { THEMES } from '../../content/themes';
import { director } from '../../director';
import { store, useStore } from '../../state/store';
import { Icon, Sheet } from '../common';

type Tab = 'discovered' | 'links' | 'themes' | 'search';

const KIND_LABEL = { encounter: 'Begegnung', reference: 'über einen Querverweis', search: 'gesucht', theme: 'über ein Thema' } as const;

export function Journal({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const setTab = (t: Tab) => store.set({ panel: { type: 'journal', tab: t } });
  useStore((s) => s.stats);
  return (
    <Sheet title="Übersicht" kicker="Deine Entdeckungen" onClose={onClose} wide>
      <nav className="tabs" role="tablist">
        {(
          [
            ['discovered', 'Entdeckt'],
            ['links', 'Lichtfäden'],
            ['themes', 'Themen'],
            ['search', 'Suchen'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'discovered' && <Discovered />}
      {tab === 'links' && <Links />}
      {tab === 'themes' && <Themes />}
      {tab === 'search' && <Search />}
    </Sheet>
  );
}

function Discovered() {
  const save = director.save;
  const bible = director.bible;
  const discoveries = [...save.discoveries].sort((a, b) => b.at - a.at);
  return (
    <>
      <h3>Begegnungen</h3>
      <ul className="links">
        {ENCOUNTERS.map((e) => {
          const done = save.encounters.includes(e.id);
          const chapter = director.model.encounterChapter(e.id);
          return (
            <li key={e.id}>
              <div className="link-row static">
                <span className="dot" style={{ background: `#${e.color.toString(16).padStart(6, '0')}` }} />
                <span className="grow">
                  {e.title} <em>{bible.format(bible.range(e.range), 'short')}</em>
                </span>
                <span className="votes">{done ? 'erlebt' : 'offen'}</span>
              </div>
              <div className="row tight">
                <button className="btn small" onClick={() => director.travelTo(chapter)}>
                  <Icon name="travel" /> Hinschweben
                </button>
                <button className="btn small" onClick={() => void director.startEncounter(e.id)}>
                  {done ? 'Erneut erleben' : 'Direkt eintreten'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <h3>Entdeckte Stellen ({discoveries.length})</h3>
      {!discoveries.length && <p className="muted">Noch keine. Jede Begegnung und jeder Lichtfaden, dem du folgst, landet hier.</p>}
      <ul className="links">
        {discoveries.map((d) => (
          <li key={`${d.start}-${d.end}`}>
            <button className="link-row" onClick={() => director.openReader(d.chapter, [d])}>
              <span className={`dot ${BOOKS[bible.ref(d.start).b].t === 'OT' ? 'ot' : 'nt'}`} />
              <span className="grow">
                {bible.format(d)} <em>{KIND_LABEL[d.kind]}</em>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Links() {
  const bible = director.bible;
  const threads = director.model.threads.filter((t) => t.kind === 'known');
  if (!threads.length)
    return <p className="muted">Sobald zwei entdeckte Stellen durch einen Querverweis verbunden sind, entsteht ein Lichtfaden. Er erscheint hier.</p>;
  return (
    <ul className="links">
      {threads.map((t) => (
        <li key={t.id}>
          <button className="link-row" onClick={() => director.openThread(t)}>
            <span className={`dot ${t.ot ? 'ot' : 'nt'}`} />
            <span className="grow">
              {bible.formatChapter(t.a, 'short')} ↔ {bible.formatChapter(t.b, 'short')}
            </span>
            <span className="votes">
              {t.links.length} Verweis{t.links.length > 1 ? 'e' : ''} · {t.votes} Stimmen
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Themes() {
  const active = useStore((s) => s.activeTheme);
  const bible = director.bible;
  return (
    <>
      <p className="muted">
        Themen sind redaktionelle Wegweiser, getrennt von den Querverweis-Daten. Eine Stelle kann zu mehreren Themen gehören. Ein gewähltes Thema leuchtet in der Welt
        als Konstellation auf.
      </p>
      <ul className="themes">
        {THEMES.map((t) => (
          <li key={t.id} className={active === t.id ? 'on' : ''}>
            <button className="theme-head" onClick={() => director.setTheme(active === t.id ? null : t.id)} aria-pressed={active === t.id}>
              <span className="dot" style={{ background: `#${t.color.toString(16).padStart(6, '0')}` }} />
              <span className="grow">
                <strong>{t.title}</strong>
                <em>{t.description}</em>
              </span>
              <span className="votes">{active === t.id ? 'leuchtet' : 'zeigen'}</span>
            </button>
            {active === t.id && (
              <div className="theme-members">
                {t.passages.map((p) => {
                  const range = bible.range(p);
                  return (
                    <button key={p} className="chip" onClick={() => void director.readSearch(range, 'theme', t.id)}>
                      {bible.format(range, 'short')}
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function Search() {
  const [query, setQuery] = useState('');
  const result = useMemo(() => (query.trim() ? director.search(query) : null), [query]);
  const bible = director.bible;
  const examples = ['Markus 4,35-41', 'Lk 15', 'Joh 3,16', 'Psalm 107', 'Röm 8', '1. Mose 22,18'];
  return (
    <>
      <label className="field">
        <span>Bibelstelle</span>
        <div className="search">
          <Icon name="search" />
          <input id="search-ref" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="z. B. Lukas 24,13–35" autoFocus />
        </div>
      </label>
      {query.trim() && !result && <p className="muted">Diese Stelle kenne ich nicht. Versuche „Buch Kapitel,Vers“, zum Beispiel „Mk 4,39“.</p>}
      {result && (
        <div className="result">
          <p>
            <strong>{bible.format(result)}</strong>
          </p>
          <div className="row tight">
            <button className="btn primary small" onClick={() => void director.readSearch(result)}>
              <Icon name="read" /> Lesen und aufleuchten lassen
            </button>
            <button className="btn small" onClick={() => director.travelTo(bible.chapterOf(result.start))}>
              <Icon name="travel" /> Hinschweben
            </button>
          </div>
        </div>
      )}
      <div className="row tight">
        {examples.map((e) => (
          <button key={e} className="chip" onClick={() => setQuery(e)}>
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
