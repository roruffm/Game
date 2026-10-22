// Settings: sound, motion, view, the vote filter, and resetting the world.

import { useState } from 'react';
import { director } from '../../director';
import { store, useStore } from '../../state/store';
import { Sheet } from '../common';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  useStore((st) => st.settingsRev);
  const s = director.save.settings;
  const [confirm, setConfirm] = useState(false);
  const update = (patch: Partial<typeof s>) => director.updateSettings(patch);
  return (
    <Sheet title="Einstellungen" onClose={onClose}>
      <label className="toggle">
        <input type="checkbox" id="set-sound" checked={s.sound} onChange={(e) => void update({ sound: e.target.checked })} />
        <span>Ton</span>
      </label>
      <label className="field">
        <span>Lautstärke</span>
        <input type="range" id="set-volume" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => void update({ volume: Number(e.target.value) })} />
      </label>
      <label className="toggle">
        <input type="checkbox" id="set-motion" checked={s.reducedMotion} onChange={(e) => void update({ reducedMotion: e.target.checked })} />
        <span>Animationen reduzieren</span>
      </label>
      <label className="toggle">
        <input type="checkbox" id="set-view" checked={s.reducedView} onChange={(e) => void update({ reducedView: e.target.checked })} />
        <span>Reduzierte Ansicht (nur Entdecktes und seine Lichtfäden)</span>
      </label>
      <label className="field">
        <span>Querverweise berücksichtigen</span>
        <select id="set-votes" value={s.minVotes} onChange={(e) => void update({ minVotes: Number(e.target.value) })}>
          <option value={10}>nur sehr gut belegte (ab 10 Stimmen)</option>
          <option value={4}>gut belegte (ab 4 Stimmen, Standard)</option>
          <option value={1}>alle positiv bewerteten (ab 1 Stimme)</option>
          <option value={-1000}>alle, auch abgelehnte</option>
        </select>
      </label>
      <p className="fine">
        Die Stimmen stammen von Leserinnen und Lesern auf OpenBible.info. Sie ordnen die Verweise nach Hilfreichkeit; sie beweisen keinen Zusammenhang und
        widerlegen keinen. Standard ist derselbe Filter wie im Projekt Bible Cross-References: mindestens 4 Stimmen.
      </p>
      <h3>Spielstand</h3>
      <p className="muted">Dein Wortstrom wird nur in diesem Browser gespeichert.</p>
      {!confirm ? (
        <button className="btn" onClick={() => setConfirm(true)}>
          Spielstand zurücksetzen
        </button>
      ) : (
        <div className="confirm">
          <p>Alle Entdeckungen, Lichtfäden und Notizen werden gelöscht. Wirklich zurücksetzen?</p>
          <div className="row tight">
            <button className="btn danger" onClick={() => director.reset()}>
              Ja, zurücksetzen
            </button>
            <button className="btn" onClick={() => setConfirm(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
      <div className="row">
        <button className="btn link" onClick={() => store.set({ panel: { type: 'credits' } })}>
          Quellen und Lizenzen
        </button>
      </div>
    </Sheet>
  );
}
