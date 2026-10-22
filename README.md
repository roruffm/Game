# Lichtpfad

Ein Pixel-Jump'n'Run fürs Smartphone, in dem man die Gleichnisse Jesu spielt und Bibelverse entdeckt.
Dieser Prototyp enthält **Welt 1, Level 1: „Das verlorene Schaf“** (Lukas 15,3–7). Idee und Planung stehen in [KONZEPT.md](KONZEPT.md).

## Starten

Du brauchst Node.js 22.

```bash
npm install
npm run dev        # Entwicklungsserver, auch im WLAN erreichbar (Adresse steht in der Konsole)
npm test           # Tests, inklusive Prüfung, ob das Level durchspielbar ist
npm run build      # Typprüfung und fertige Web-App in dist/
npm run preview    # die gebaute Version ansehen
```

Zum Testen auf dem Handy startest du `npm run dev`, öffnest die angezeigte „Network“-Adresse im Handy-Browser (gleiches WLAN) und drehst das Handy quer.

## Steuerung

| | Touch | Tastatur |
|---|---|---|
| Laufen | ◀ ▶ unten links | ← → oder A D |
| Springen (halten = höher) | ▲ unten rechts | Leertaste, ↑ oder W |
| Pause | ❚❚ oben rechts | Esc oder P |

## Aufbau

```
src/
  main.ts              Start, Phaser-Einstellungen, Bildgröße
  game/GameScene.ts    das Level: Physik, Schaf, Gatter, Rastplätze, Fest
  game/physics.ts      Sprunghöhen und Tempo (normal 3 Kacheln, mit Schaf 2)
  game/input.ts        Tastatur und Touch in einem Zustand
  levels/level.ts      ASCII-Karten einlesen (Legende in der Datei)
  levels/level1.ts     die Karte von Level 1
  levels/solver.ts     prüft in den Tests, ob das Level ohne Sackgassen schaffbar ist
  data/verses.ts       Bibeltexte (Lutherbibel 1912), Hintergrund, Fragen
  gfx/sprites.ts       Pixelgrafik als Text, ein Zeichen pro Pixel
  gfx/textures.ts      erzeugt daraus und aus Code alle Texturen (keine Bilddateien)
  audio/sound.ts       Chiptune-Musik und Effekte per Web Audio (keine Audiodateien)
  ui/ui.ts             HTML-Oberfläche: Titel, Vers-Puzzle, Versbuch, Touch-Knöpfe
  save.ts              Fortschritt und Notizen im Browser (localStorage)
public/                Manifest, Service Worker (offline), App-Icons
scripts/make-icons.mjs erzeugt die App-Icons (npm run icons)
tests/                 Tests für Level und Verse
```

### Ein Level bauen

Level sind ASCII-Karten, ein Zeichen ist eine 16×16-Kachel. Die Legende steht in `src/levels/level.ts`. Die Tests in `tests/level1.test.ts` simulieren die Spielphysik und prüfen:

- Das Schaf ist vom Start aus erreichbar, ohne dass man irgendwo stecken bleibt.
- Mit dem Schaf kommt man nach Hause, aber nicht über die Hochebene.
- Alle Versfragmente sind einsammelbar.

### Test-Abkürzungen

Diese Adressen helfen beim Ausprobieren einzelner Stellen:

- `?dev&play`: springt direkt ins Spiel
- `?dev&play&at=140,20`: startet an Kachel x=140, y=20
- `?dev&play&at=19,21&carry`: startet mit dem Schaf auf den Schultern (kurz vor dem Gatter)
- `&bodies`: zeigt die Hitboxen

## Veröffentlichen

`.github/workflows/pages.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie auf GitHub Pages. Dafür einmalig in den Repository-Einstellungen unter *Settings → Pages → Source* „GitHub Actions“ wählen. Auf dem Handy lässt sich die Seite dann über „Zum Startbildschirm hinzufügen“ wie eine App installieren und läuft auch offline.

## Bibeltext

Lutherbibel 1912, gemeinfrei, aus der Ausgabe von [eBible.org](https://ebible.org/find/details.php?id=deu1912).
