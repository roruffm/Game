# WORTSTROM

Ein meditatives Entdeckungsspiel durch das Neue Testament. Ein pulsierender Lichtorganismus gleitet
durch einen dunklen Strom aus Licht. Jeder leuchtende Knoten ist eine biblische Geschichte. Wer eine
Begegnung erlebt, kehrt in die Welt zurück und sieht, wie aus **echten Querverweisen** neue Lichtfäden
wachsen – bis hinein ins Alte Testament, den „Quellgrund“.

```
npm install
npm run dev        # lädt beim ersten Start die Quelldaten und baut public/data/
```

Danach `http://localhost:5173` öffnen. Für eine Produktionsfassung: `npm run build && npm run preview`.

## Spielen

| | Desktop | Smartphone |
|---|---|---|
| Gleiten | Maus zeigt die Richtung, WASD oder Pfeiltasten, Umschalt = schneller | irgendwo auf den Bildschirm legen und ziehen (weicher Joystick) |
| Knoten ansehen | Klick (erster Klick zeigt Titel und schwebt hin) | Tippen |
| Eintreten / Folgen | zweiter Klick oder Enter | zweites Tippen oder Knopf auf der Karte |
| Zoom | Mausrad, + / − | zwei Finger |
| Übersicht, Karte | J, M | Symbole oben rechts |
| Schließen, Begegnung verlassen | Esc | Symbol oben rechts |

Hoch- und Querformat werden unterstützt. In den Einstellungen lassen sich Ton, Lautstärke,
reduzierte Animationen, eine reduzierte Ansicht und die Mindeststimmen der Querverweise einstellen;
dort lässt sich der Spielstand auch zurücksetzen. Der Spielstand liegt nur im Browser (`localStorage`).

### Die drei Begegnungen

| Begegnung | Text | Mechanik |
|---|---|---|
| Jesus stillt den Sturm | Markus 4,35–41 | Dem Boot folgen, im Sturm zum Licht im Heck durchdringen; nach dem Wort „Schweig und verstumme!“ wird die Steuerung kurz still, die Welle der Ruhe breitet sich aus. |
| Der verlorene Sohn | Lukas 15,11–32 | Eine Strömung trägt fort; erst die Umkehr dreht sie. Der Vater läuft entgegen, bevor man ankommt. Danach der ältere Bruder – das Gleichnis bleibt offen, wie bei Lukas. |
| Die Emmausjünger | Lukas 24,13–35 | Auf einem Weg mit einem Unbekannten gehen; „Mose und alle Propheten“ erscheinen als echte Querverweise aus dem Datensatz; Erkennen beim Brotbrechen, dann Rückweg nach Jerusalem. |

Jede Begegnung hat vier Phasen: **Erleben → Verstehen → Verbinden → Zurückkehren**. Am Ende stehen der
Schlüsselvers, der ganze Text, eine offene Frage zum Nachdenken (ohne Bewertung, Antwort nur lokal
gespeichert) und die neu entstandenen Verbindungen.

## Verbindungen: drei klar getrennte Ebenen

1. **Im Datensatz** – Querverweise aus OpenBible.info mit ihren Stimmen. Nur diese werden als
   Datensatztreffer bezeichnet. Standardfilter: ab 4 Stimmen (einstellbar bis „alle“, auch negative).
2. **Automatischer Hinweis** – gemeinsame Wörter beider Stellen in der Lutherbibel 1912. Rein
   maschinell, als solcher gekennzeichnet.
3. **Redaktionelle Erklärung** – 17 kurze Auslegungen (`src/content/editorial.ts`). Jede gehört zu
   einem Link, der im Datensatz mit der angegebenen Stimmenzahl existiert, und jedes Zitat stimmt
   wortgenau mit der Lutherbibel 1912 überein. Beides prüfen die Tests.

Die acht **Themen** (Gnade, Glaube, Liebe, Identität, Umkehr, Gebet, Hoffnung, Geist) sind
redaktionelle Wegweiser und vom Datensatz getrennt. Ein gewähltes Thema leuchtet als Konstellation.

Grundsätze: Bibeltext, Nacherzählung und Auslegung sind sichtbar unterschieden; der volle Text ist
jederzeit lesbar; es gibt keine richtigen oder falschen Antworten, keine Punkte für Glauben und keine
Aussagen über den Glauben der Spielenden. Erklärungen sind nachprüfbar, aber nicht unfehlbar.

## Quellen und Lizenzen

| Quelle | Lizenz | Verwendung |
|---|---|---|
| [OpenBible.info Cross References](https://www.openbible.info/labs/cross-references/), Stand 2026-09-21, 344.799 Verweise; dieselbe Datei wie in [trekhleb/bible-cross-references](https://github.com/trekhleb/bible-cross-references) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | alle Querverweise. Bearbeitet: pro Buch aufgeteilt, 3 Joh 1,15 → 1,14 (KJV-Zählung). Namensnennung im Spiel unter „Quellen“ und an jeder Verbindung. |
| [Lutherbibel 1912](https://ebible.org/Scriptures/details.php?id=deu1912), Ausgabe eBible.org | gemeinfrei | gesamter Bibeltext. Bearbeitet: auf KJV-Verszählung gebracht (deutsche Zählung bleibt als Zusatzangabe sichtbar), Textfehler in Ri 11,25 entfernt. |
| Albert Sans, Cormorant Garamond, Source Serif 4 (Fontsource) | SIL OFL 1.1 | Schriften |
| PixiJS, React | MIT | Bibliotheken |

Warum Luther 1912: Spätere Luther-Revisionen (1984, 2017), Einheitsübersetzung, Elberfelder usw. sind
urheberrechtlich geschützt. Die Lutherbibel 1912 ist gemeinfrei und bleibt nah an dem Wortlaut, den
viele kennen. Ihre Rechtschreibung („daß“, „Mußte“) wird nicht modernisiert.

Die Quelldateien sind per SHA-256 in `data/sources.json` festgelegt. Die OpenBible-Datei liegt im
Repository (`data/raw/`), die Lutherbibel wird beim ersten Datenlauf geladen und geprüft.

## Datenpipeline

`npm run data` (`scripts/data/build.mjs`) erzeugt `public/data/`:

- `versification.json` – KJV-Verszählung, 31.102 Verse, globaler Versindex
- `text/lut1912/<BUCH>.json` – Bibeltext pro Buch, mit deutscher Zählung wo sie abweicht
- `xref/<BUCH>.json` – alle Verweise pro Ausgangsbuch, nach Stimmen sortiert, als kompakte Arrays
- `graph.json` – deterministisches Layout aller 1.189 Kapitel (NT im Kern, AT als äußerer Ring)
- `meta.json` – Zählungen, Umschlüsselungen, Quellen und Namensnennungen

Alle 344.799 Verweise werden importiert; gefiltert wird erst im Spiel. `--if-needed` überspringt den
Lauf, wenn die Ausgabe zur aktuellen Version passt (so laufen `dev` und `build` ohne Zusatzschritt).

## Architektur

TypeScript, Vite, PixiJS 8 (WebGL), React 19 für die Oberfläche, Web Audio, `localStorage`.

```
src/
  bible/        Bible Data Service: Verszählung, Stellen parsen/formatieren, Text laden
  xref/         Cross-Reference Engine: Verweise, Gruppierung nach Kapiteln, Worthinweise
  content/      Redaktionelles: Begegnungen, Themen, Erklärungen (vom Datensatz getrennt)
  engine/       Game Engine: Pixi-App, Kamera, Eingabe, Organismus, Partikel, Rauschen, Texturen
  world/        World Engine: model.ts (Logik, testbar ohne Grafik), scene.ts (Darstellung)
  encounters/   Encounter Engine (kit.ts) und je ein Modul pro Begegnung
  audio/        Audio Engine: Klangflächen je Stimmung, wächst mit der Welt
  state/        Speicher (save.ts) und UI-Zustand (store.ts)
  ui/           React-Oberfläche: HUD, Fokuskarte, Leser, Verbindungen, Übersicht, Einstellungen
  director.ts   verbindet alles: Laden, Szenenwechsel, Entdecken, Panels
```

Neue Begegnungen: einen Eintrag in `src/content/encounters.ts` anlegen und ein Modul in
`src/encounters/` schreiben, das `EncounterScene` erweitert (`start`, `step`, `objective`). Verse
erscheinen über `say(von, bis)`, sie werden in Ruhe nacheinander gezeigt.

## Tests

```
npm test           # Unit-Tests (Vitest): Daten, Bibel-Service, Querverweise, Weltmodell, Redaktion
npm run test:e2e   # Browser-Tests (Playwright, Chromium) gegen den Build: npm run build vorher
```

Die Browser-Tests spielen alle drei Begegnungen vollständig mit der Maus durch, prüfen Bewegung per
Tastatur, Maus und Touch, Suche, Themen, Einstellungen, Speichern und Zurücksetzen, die
Kennzeichnung der drei Verbindungsebenen und das Verhalten auf einem Smartphone-Viewport. In der
CI läuft WebGL in Software, daher die großzügigen Zeitlimits.

Bildrate: Das Spiel misst sie laufend (`window.wortstrom.state().fps`), senkt auf Touch-Geräten die
Partikelzahl und bietet die reduzierte Ansicht an. Ziel sind 60 fps am Desktop und 30 fps mobil; auf
echten Geräten ist das noch zu bestätigen, die Testumgebung rendert ohne GPU.

## Ausbaustufen

- weitere Begegnungen (z. B. Bartimäus, Samariterin am Brunnen, Pfingsten)
- Lesepfade durch ganze Bücher; Vergleich der Evangelien nebeneinander
- weitere gemeinfreie oder lizenzierte Übersetzungen, umschaltbar
- Barrierefreiheit: Bildschirmleser-Modus für die Welt, frei belegbare Tasten
- Installierbar als PWA mit Offline-Daten
