// Sources, licences and what the data means.

import { TRACKS } from '../../audio/tracks';
import { director } from '../../director';
import { Sheet } from '../common';

const nf = new Intl.NumberFormat('de-DE');

export function Credits({ onClose }: { onClose: () => void }) {
  const m = director.meta;
  return (
    <Sheet title="Quellen und Lizenzen" onClose={onClose}>
      <h3>Querverweise</h3>
      <p>
        {nf.format(m.links)} Verbindungen zwischen Bibelversen von{' '}
        <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noreferrer">
          OpenBible.info
        </a>
        , Stand {m.snapshot}, lizenziert unter{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
        . Sie stammen überwiegend aus dem gemeinfreien „Treasury of Scripture Knowledge“. {nf.format(m.linksMin4)} davon haben mindestens 4 Stimmen.
      </p>
      <p className="fine">{m.sources.find((s) => s.id === 'openbible')?.attribution}</p>
      <p className="fine">
        Import und Aufbereitung folgen dem Vorgehen des Projekts{' '}
        <a href="https://github.com/trekhleb/bible-cross-references" target="_blank" rel="noreferrer">
          Bible Cross-References
        </a>{' '}
        von Oleksii Trekhleb (Code unter MIT-Lizenz): dieselbe, per SHA-256 festgelegte Rohdatei, dieselbe KJV-Verszählung und derselbe Standardfilter.
      </p>
      <h3>Bibeltext</h3>
      <p>
        Lutherbibel 1912, gemeinfrei, in der Ausgabe von{' '}
        <a href="https://ebible.org/Scriptures/details.php?id=deu1912" target="_blank" rel="noreferrer">
          eBible.org
        </a>
        . Sie ist nach der Verszählung der Querverweise geordnet; an {m.markersMoved} Stellen weicht die Zählung deutscher Ausgaben ab, dort wird die deutsche Nummer
        zusätzlich angezeigt. Die Luther-Ausgaben 1984 und 2017 sind urheberrechtlich geschützt und werden nicht verwendet.
      </p>
      <p className="fine">{m.sources.find((s) => s.id === 'luther1912')?.attribution}</p>
      <h3>Was die Verbindungen bedeuten</h3>
      <p>
        Ein Querverweis zeigt einen möglichen Zusammenhang, den Menschen beim Lesen gesehen haben: gemeinsame Themen, Wörter, Personen oder Ereignisse. Er bedeutet
        nicht, dass die eine Stelle die andere beweist. Im Spiel sind drei Dinge immer getrennt beschriftet:
      </p>
      <ul className="plain">
        <li>
          <strong>Im Datensatz</strong> – die Verbindung und ihre Stimmen, unverändert aus OpenBible.info.
        </li>
        <li>
          <strong>Automatischer Hinweis</strong> – vom Spiel berechnete gemeinsame Wörter, ohne Deutung.
        </li>
        <li>
          <strong>Redaktionelle Erklärung</strong> – für ausgewählte Verbindungen geschrieben und am Text geprüft; eine Auslegung.
        </li>
      </ul>
      <p>Die Themen-Konstellationen sind ebenfalls redaktionell und werden getrennt von den Querverweis-Daten gepflegt.</p>
      <h3>Musik</h3>
      <p>
        Instrumentale Lobpreis-Stücke für Klavier von{' '}
        <a href="https://pixabay.com/music/" target="_blank" rel="noreferrer">
          Pixabay
        </a>
        , verwendet unter der{' '}
        <a href="https://pixabay.com/service/license-summary/" target="_blank" rel="noreferrer">
          Pixabay-Inhaltslizenz
        </a>
        . Für das Spiel gekürzt, ein- und ausgeblendet und in der Lautstärke angeglichen.
      </p>
      <ul className="plain">
        {TRACKS.map((t) => (
          <li key={t.id}>
            <a href={t.url} target="_blank" rel="noreferrer">
              {t.title}
            </a>{' '}
            – {t.artist}
          </li>
        ))}
      </ul>
      <h3>Software und Schriften</h3>
      <p className="fine">
        PixiJS und React (MIT-Lizenz). Schriften: Cormorant Garamond, Source Serif 4 und Albert Sans (SIL Open Font License), über Fontsource.
      </p>
    </Sheet>
  );
}
