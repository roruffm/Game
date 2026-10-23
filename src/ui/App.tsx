// The interface layer over the world: start screen, a nearly invisible HUD, the card of the
// node in focus, the encounter narration, panels and toasts.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../audio/audio';
import { encounterById } from '../content/encounters';
import { director } from '../director';
import { focusAnchor, store, thoughtControl, useStore, type Beat, type Panel } from '../state/store';
import { Icon } from './common';
import { Thought, useLines, useThoughtLayout, type SpilledWord, type ThoughtItem } from './Thought';
import { Credits } from './panels/Credits';
import { EncounterEnd } from './panels/EncounterEnd';
import { Journal } from './panels/Journal';
import { LinkView } from './panels/LinkView';
import { Reader } from './panels/Reader';
import { SettingsPanel } from './panels/Settings';

export function App() {
  const phase = useStore((s) => s.phase);
  const panel = useStore((s) => s.panel);
  const reveal = useStore((s) => s.reveal !== null);
  const error = useStore((s) => s.loadError);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      const onButton = t?.tagName === 'BUTTON';
      const s = store.get();
      if (e.key === 'Escape') {
        if (s.panel) {
          if (s.panel.type === 'encounterEnd') director.returnToWorld();
          else closePanel();
        } else if (s.phase === 'encounter') store.set({ confirmLeave: !s.confirmLeave });
        else if (s.reveal) store.set({ reveal: null });
        else if (s.focus) store.set({ focus: null });
        return;
      }
      if (typing || s.phase === 'start' || s.phase === 'loading') return;
      if (e.key === 'Enter' && !s.panel && s.reveal && s.phase === 'world') {
        e.preventDefault();
        director.openReveal();
        return;
      }
      if (e.key === 'Enter' && !s.panel && s.focus && s.phase === 'world') {
        e.preventDefault();
        director.activate(s.focus.chapter);
      }
      if (s.phase !== 'world' || s.panel) return;
      if (e.key === '+' || e.key === '=') director.game.camera.zoomBy(1.25);
      if (e.key === '-') director.game.camera.zoomBy(0.8);
      if (e.key === 'm' || e.key === 'M') toggleMap();
      if (e.key === ' ' && !onButton) {
        e.preventDefault();
        director.resonate();
      }
      if (e.key === 'j' || e.key === 'J') store.set({ panel: { type: 'journal', tab: 'discovered' } });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (error) return <div className="loading">Die Daten konnten nicht geladen werden: {error}</div>;
  if (phase === 'loading') return <div className="loading">Der Wortstrom sammelt sich …</div>;

  return (
    <>
      {phase === 'start' && <Start />}
      {phase === 'world' && <Hud />}
      {phase === 'world' && !panel && !reveal && <FocusCard />}
      {phase === 'world' && !panel && reveal && <RideReveal />}
      {phase === 'encounter' && <EncounterOverlay />}
      {panel && <PanelHost panel={panel} />}
      <Toasts />
    </>
  );
}

function closePanel() {
  director.setPanel(null);
}

function toggleMap() {
  const cam = director.game.camera;
  cam.targetZoom = cam.targetZoom > 0.2 ? 0.1 : director.game.quality.particles < 1 ? 0.6 : 0.9;
}

function PanelHost({ panel }: { panel: Panel }) {
  switch (panel.type) {
    case 'reader':
      return <Reader chapter={panel.chapter} highlight={panel.highlight} onClose={closePanel} />;
    case 'link':
      return <LinkView a={panel.a} b={panel.b} fromChapter={panel.fromChapter} toChapter={panel.toChapter} onClose={closePanel} />;
    case 'journal':
      return <Journal tab={panel.tab} onClose={closePanel} />;
    case 'settings':
      return <SettingsPanel onClose={closePanel} />;
    case 'credits':
      return <Credits onClose={closePanel} />;
    case 'encounterEnd':
      return <EncounterEnd id={panel.id} />;
  }
}

function Start() {
  const hasSave = useStore((s) => s.hasSave);
  const stats = useStore((s) => s.stats);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="start">
      <div className="start-inner">
        <h1>Wortstrom</h1>
        <p className="tagline">Ein Entdeckungsspiel durch das Neue Testament</p>
        <p className="intro">
          Gleite als kleines Licht durch eine dunkle, lebendige Welt. Hinter jedem hellen Knoten wartet eine biblische Begegnung – und mit jeder Entdeckung leuchten
          neue Verbindungen zwischen Bibelstellen auf.
        </p>
        <div className="row center">
          <button className="btn primary big" id="start" onClick={() => director.begin(false)} autoFocus>
            {hasSave ? 'Weiter erkunden' : 'Eintauchen'}
          </button>
          {hasSave && !confirm && (
            <button className="btn" onClick={() => setConfirm(true)}>
              Neu beginnen
            </button>
          )}
        </div>
        {hasSave && (
          <p className="muted small">
            {stats.discovered} Entdeckungen · {stats.connections} Verbindungen · {stats.encounters} von 3 Begegnungen
          </p>
        )}
        {confirm && (
          <div className="confirm">
            <p>Dein bisheriger Wortstrom wird gelöscht.</p>
            <div className="row tight center">
              <button className="btn danger" onClick={() => director.begin(true)}>
                Neu beginnen
              </button>
              <button className="btn" onClick={() => setConfirm(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
        <p className="muted small">Mit Ton am schönsten (abschaltbar). Maus, Tastatur oder Touch.</p>
        <button className="btn link small" onClick={() => store.set({ panel: { type: 'credits' } })}>
          Quellen und Lizenzen
        </button>
      </div>
    </div>
  );
}

function Hud() {
  const stats = useStore((s) => s.stats);
  useStore((s) => s.settingsRev);
  const sound = director.save.settings.sound;
  return (
    <div className="hud">
      <div className="hud-left">
        <span className="brand">Wortstrom</span>
        <span className="stat" title="Entdeckte Stellen">
          {stats.discovered} entdeckt
        </span>
        <span className="stat" title="Lichtfäden zu verwandten Bibelstellen">
          {stats.threads} Lichtfäden
        </span>
      </div>
      <div className="hud-right">
        <button className="icon-btn" title="Übersicht (J)" aria-label="Übersicht" onClick={() => store.set({ panel: { type: 'journal', tab: 'discovered' } })}>
          <Icon name="journal" />
        </button>
        <button className="icon-btn" title="Karte (M)" aria-label="Karte" onClick={toggleMap}>
          <Icon name="map" />
        </button>
        <button
          className="icon-btn"
          title={sound ? 'Ton aus' : 'Ton an'}
          aria-label={sound ? 'Ton aus' : 'Ton an'}
          onClick={() => {
            audio.unlock();
            void director.updateSettings({ sound: !director.save.settings.sound });
          }}
        >
          <Icon name={sound ? 'sound' : 'mute'} />
        </button>
        <button className="icon-btn" title="Einstellungen" aria-label="Einstellungen" onClick={() => store.set({ panel: { type: 'settings' } })}>
          <Icon name="settings" />
        </button>
      </div>
      {stats.discovered > 0 && (
        <button className="icon-btn resonance" title="Resonanz (Leertaste)" aria-label="Resonanz" onClick={() => director.resonate()}>
          <Icon name="pulse" />
        </button>
      )}
      <div className="zoom">
        <button className="icon-btn" aria-label="Näher" onClick={() => director.game.camera.zoomBy(1.3)}>
          <Icon name="plus" />
        </button>
        <button className="icon-btn" aria-label="Weiter weg" onClick={() => director.game.camera.zoomBy(0.77)}>
          <Icon name="minus" />
        </button>
      </div>
    </div>
  );
}

const KIND = { encounter: 'Begegnung', known: 'Entdeckt', hint: 'Fernes Licht', theme: 'Thema' } as const;

function FocusCard() {
  const focus = useStore((s) => s.focus);
  const traveling = useStore((s) => s.traveling);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    // The card rests while its node only sways a little (the organism breathes, the camera eases),
    // so its buttons stay still under a finger; it glides along once the node really moves.
    let cx = NaN;
    let cy = NaN;
    let gliding = false;
    const loop = () => {
      const el = ref.current;
      if (el) {
        const w = el.offsetWidth;
        const tx = Math.max(12, Math.min(window.innerWidth - w - 12, focusAnchor.x - w / 2));
        const below = focusAnchor.y + 70;
        const ty = Math.max(60, below + el.offsetHeight > window.innerHeight - 12 ? focusAnchor.y - el.offsetHeight - 70 : below);
        const d = Math.hypot(tx - cx, ty - cy);
        if (!focusAnchor.visible || Number.isNaN(d)) {
          cx = tx;
          cy = ty;
        } else {
          if (d > 14) gliding = true;
          if (gliding) {
            cx += (tx - cx) * 0.3;
            cy += (ty - cy) * 0.3;
            if (d < 1) gliding = false;
          }
        }
        el.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px)`;
        el.style.opacity = focusAnchor.visible ? '1' : '0';
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!focus) return <div ref={ref} className="focus-card hidden" />;
  const primary = () => (focus.near ? director.activate(focus.chapter) : director.travelTo(focus.chapter));
  let label: string;
  if (!focus.near) label = traveling ? 'Unterwegs …' : 'Hinschweben';
  else if (focus.kind === 'encounter') label = focus.completed ? 'Erneut erleben' : 'Eintreten';
  else if (focus.kind === 'hint') label = 'Dem Licht folgen';
  else label = 'Lesen';
  return (
    <div ref={ref} className={`focus-card kind-${focus.kind}`} role="dialog" aria-label={focus.title}>
      <p className="kicker">{KIND[focus.kind]}</p>
      <h3>{focus.title}</h3>
      <p className="ref">{focus.subtitle}</p>
      <div className="row tight">
        <button className="btn primary small" id="focus-action" onClick={primary} disabled={!focus.near && traveling}>
          {label}
        </button>
        {focus.kind === 'encounter' && focus.completed && focus.near && (
          <button className="btn small" onClick={() => director.openReader(focus.chapter, director.model.nodes.get(focus.chapter)?.discoveries ?? [])}>
            Text lesen
          </button>
        )}
      </div>
      {focus.near && <p className="keyhint">Enter</p>}
    </div>
  );
}

function EncounterOverlay() {
  const enc = useStore((s) => s.encounter);
  const leaving = useStore((s) => s.confirmLeave);
  const setLeaving = (v: boolean) => store.set({ confirmLeave: v });
  if (!enc) return null;
  const info = encounterById(enc.id);
  const beats = enc.beats;
  const latest = beats[beats.length - 1];
  return (
    <div className="encounter">
      <header className="enc-head">
        <div>
          <p className="kicker">Begegnung</p>
          <h2>{info.title}</h2>
          <ol className="phases">
            {info.phases.map((p, i) => (
              <li key={p.title} className={i === enc.phase ? 'on' : i < enc.phase ? 'done' : ''}>
                <span>{String.fromCharCode(65 + i)}</span> {p.title}
              </li>
            ))}
          </ol>
        </div>
        <div className="row tight">
          <button
            className="icon-btn"
            title="Text lesen"
            aria-label="Text lesen"
            onClick={() => {
              const range = director.bible.range(info.range);
              director.openReader(director.bible.chapterOf(range.start), [range]);
            }}
          >
            <Icon name="read" />
          </button>
          <button className="icon-btn" title="Begegnung verlassen (Esc)" aria-label="Begegnung verlassen" onClick={() => setLeaving(true)}>
            <Icon name="leave" />
          </button>
        </div>
      </header>
      {beats.length === 0 && <p className="hinfuehrung">{info.intro}</p>}
      {latest && <BeatThought beat={latest} />}
      {enc.hint && (
        <p className="enc-hint">
          <span>Hinweis</span> {enc.hint}
        </p>
      )}
      {leaving && (
        <div className="confirm floating">
          <p>Begegnung verlassen? Du kannst sie jederzeit wieder betreten.</p>
          <div className="row tight">
            <button
              className="btn"
              onClick={() => {
                setLeaving(false);
                director.returnToWorld();
              }}
            >
              Verlassen
            </button>
            <button className="btn primary" onClick={() => setLeaving(false)}>
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Draws the words of a line as spans, so each can leave the thought on its own. */
const wordSpans = (line: number[], words: string[], caught?: (i: number) => boolean) =>
  line.map((i, j) => (
    <Fragment key={i}>
      {j > 0 && ' '}
      <span className={caught?.(i) ? 'w caught' : 'w'}>{words[i]}</span>
    </Fragment>
  ));

/** Scripture is food once read; guidance is not. */
const SPILL = (color: number) => (words: SpilledWord[]) => director.spill(words, color);
const spillVerse = SPILL(0xffe2a8);
const spillReveal = SPILL(0xa8e6ff);

/** A verse of the encounter, rising beside the organism. */
function BeatThought({ beat }: { beat: Beat }) {
  const layout = useThoughtLayout();
  const words = useMemo(() => beat.text.split(/\s+/).filter(Boolean), [beat.text]);
  const lines = useLines(words, layout);
  const caption = beat.kind === 'bibel' ? `${beat.label} · Lutherbibel 1912` : beat.label;
  const item = useMemo<ThoughtItem>(() => {
    const texts = lines.map((l) => l.map((i) => words[i]).join(' '));
    return {
      key: `beat-${beat.seq ?? beat.ref}`,
      texts,
      lines: lines.map((l) => wordSpans(l, words)),
      foot: <p className="thought-ref">{caption}</p>,
      ...(beat.kind === 'hinweis' ? {} : { ripe: spillVerse }),
    };
  }, [lines, words, beat.seq, beat.ref, beat.kind, caption]);
  return <Thought item={item} layout={layout} className={beat.kind} live={`${beat.text} – ${caption}`} />;
}

/** The verse a thread of light led to: it rises beside the organism, the words caught on the way in gold. */
function RideReveal() {
  const reveal = useStore((s) => s.reveal);
  const layout = useThoughtLayout();
  const words = useMemo(() => reveal?.words.map((w) => w.text) ?? [], [reveal]);
  const lines = useLines(words, layout);
  const item = useMemo<ThoughtItem | null>(() => {
    if (!reveal) return null;
    return {
      key: `reveal-${reveal.id}`,
      texts: lines.map((l) => l.map((i) => words[i]).join(' ')),
      head: <p className="kicker">Lichtfaden · im Datensatz</p>,
      lines: lines.map((l, k) => (
        <>
          {wordSpans(l, words, (i) => reveal.words[i].caught)}
          {k === lines.length - 1 && reveal.truncated && <span className="w"> …</span>}
        </>
      )),
      ripe: spillReveal,
      foot: (
        <>
          <p className="thought-ref">
            {reveal.label}
            {reveal.note && <span className="alt"> ({reveal.note})</span>} · Lutherbibel 1912
          </p>
          <p className="source-line">
            Querverweis {reveal.linkLabel} · {reveal.votes} Stimmen · OpenBible.info (CC BY 4.0)
          </p>
          <div className="row tight thought-actions">
            <button className="btn primary small" id="reveal-open" onClick={() => director.openReveal()}>
              Verbindung ansehen
            </button>
            <button
              className="btn small"
              onClick={() => {
                thoughtControl.ripen();
                store.set({ reveal: null });
              }}
            >
              Weiter
            </button>
          </div>
        </>
      ),
    };
  }, [reveal, lines, words]);
  if (!reveal || !item) return null;
  return (
    <Thought
      item={item}
      layout={layout}
      className="reveal"
      live={`${words.join(' ')} – ${reveal.label}, Lutherbibel 1912. Querverweis ${reveal.linkLabel}, ${reveal.votes} Stimmen, OpenBible.info.`}
    />
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <p>{t.text}</p>
          {t.sub && <small>{t.sub}</small>}
        </div>
      ))}
    </div>
  );
}
