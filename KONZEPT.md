# Lichtpfad – Konzept

Ein Jump'n'Run in Pixelgrafik für das Smartphone. Man spielt die Gleichnisse Jesu, entdeckt dabei Bibelverse und setzt sich mit ihnen auseinander.

> „Ich bin das Licht der Welt; wer mir nachfolgt, der wird nicht wandeln in der Finsternis, sondern wird das Licht des Lebens haben.“ – Johannes 8,12

## Eckpunkte

| | Entscheidung |
|---|---|
| Zielgruppe | Jugendliche und Erwachsene |
| Bibeltexte | nur Neues Testament |
| Übersetzung (Prototyp) | Lutherbibel 1912 (gemeinfrei) |
| Plattform | Web-App (PWA) fürs Handy im Querformat, später per Capacitor in die App-Stores |
| Technik | Phaser 3, TypeScript, Vite |
| Steuerung | frei laufen (◀ ▶) und springen (▲), halten = höher springen |
| Ton | nachdenklich und atmosphärisch, eher *Celeste* oder *GRIS* als Kinderspiel |

## Kernprinzip: Jedes Level ist ein spielbares Gleichnis

Man **erlebt** den Text zuerst als Spielmechanik und liest den Vers am Ende vollständig. Das soll zu einem Aha-Moment führen: „Darum ging es in diesem Level!“

**Leitplanke:** Verse sind Zuspruch, keine Zaubersprüche. Die Mechanik veranschaulicht den Text, sie „aktiviert“ ihn nicht.

## Ablauf eines Levels

```
Laufen & Springen → Versfragmente sammeln → Vers zusammensetzen
      ↑                                              ↓
 Nächstes Level  ←  Versbuch  ←  Hintergrund + Frage zum Nachdenken
```

1. **Entdecken:** Im Level liegen die Fragmente des Kernverses, manche abseits des Weges.
2. **Ordnen:** Am Ende tippt man die Fragmente in die richtige Reihenfolge.
3. **Verstehen:** Eine kurze Hintergrundkarte erklärt, wer was wann und warum gesagt hat.
4. **Nachdenken:** Eine offene, persönliche Frage, dazu eine optionale Notiz, die nur auf dem Gerät bleibt.
5. **Sammeln:** Der Vers kommt ins Versbuch. Fehlende Fragmente kann man beim nächsten Durchgang finden.

Gestaltungsregeln:
- **Gewaltfrei:** Man weicht nur aus, es gibt keine Gegner zu besiegen. Hindernisse sind Dornen und Abgründe.
- **Kein Game Over:** Nach einem Fehler geht es am letzten Rastplatz weiter. Rastplätze sind Brunnen (Mt 11,28).
- **Kurze Level:** 2–4 Minuten.
- **Fragen statt Moral:** Die Fragen bleiben offen und moralisieren nicht.

## Welt 1: „Verloren und gefunden“ (Lukas 15)

Jesus erzählt die drei Gleichnisse als Antwort auf das Murren der Pharisäer: „Dieser nimmt die Sünder an und isset mit ihnen“ (Lk 15,2).

- **Es wird persönlicher:** 1 von 100 Schafen, dann 1 von 10 Münzen, dann 1 von 2 Söhnen.
- **Die Perspektive kippt:** In Level 1 und 2 sucht man, in Level 3 ist man selbst der Verlorene.
- **Kehrvers:** „Freuet euch mit mir; denn ich habe … gefunden“ kommt in jedem Level wieder.

| | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| Gleichnis | Das verlorene Schaf (Lk 15,3–7) | Der verlorene Groschen (Lk 15,8–10) | Der verlorene Sohn (Lk 15,11–32) |
| Rolle | Hirte, sucht | Frau, sucht | Sohn, ist verloren |
| Anzeige | 99/100 Schafe | 9/10 Groschen | Erbteil schrumpft |
| Mechanik | Spuren lesen, Tragen | Lampe, Fegen | Umkehren, Gnade |
| Kernvers | Lk 15,6 | Lk 15,9 | Lk 15,24 |
| Status | **spielbar** | geplant | geplant |

### Level 1 – Das verlorene Schaf (umgesetzt)

- **Start im Schafstall:** Die Anzeige steht auf 99/100. Ein Gatter versperrt einen Höhlengang, es ist „von der anderen Seite verriegelt“.
- **Hinweg über die Hochebene:** Stufen von 3 Kacheln, Dornen, Abgründe und Felsvorsprünge. Wollfetzen in den Büschen zeigen die Spur. Alle paar Sekunden blökt das Schaf. Ist es außer Sicht, erscheint eine Sprechblase am Bildschirmrand in seiner Richtung, und der Ton kommt im Stereo aus der passenden Seite.
- **Die Schlucht:** Das Schaf steckt am Grund fest.
- **Tragen:** „…so legt er's auf seine Achseln mit Freuden“ (Lk 15,5). Mit dem Schaf springt man nur noch 2 statt 3 Kacheln hoch, der Weg nach oben ist also versperrt. **Trotzdem wird die Musik fröhlicher.**
- **Heimweg durch die Höhle:** Das Gatter lässt sich von innen öffnen.
- **Fest:** Die Nachbarn kommen, die Anzeige springt auf 100/100. Danach folgen Vers-Puzzle, Hintergrund und die Frage *„Wann hat dich zuletzt jemand gesucht – oder hast du gemerkt, dass niemand sucht?“*

### Level 2 – Der verlorene Groschen (geplant)

- **Ort:** Ein dunkles Haus über mehrere Ebenen: Keller, Wohnraum, Flachdach. Es ist ruhiger und eher ein Rätsel-Level.
- **Lampe:** Der Lichtkreis ist begrenzt. Münzen blitzen kurz auf, wenn der Rand des Lichts sie streift.
- **Fegen:** Wenn man Staubhaufen wegfegt, kommen Fragmente und Durchgänge zum Vorschein (*„kehrte das Haus und suchte mit Fleiß“*).
- **Frage:** „Fühlst du dich eher wie eine der neun sicheren Münzen oder wie die eine verlorene?“

### Level 3 – Der verlorene Sohn (geplant)

1. **Aufbruch:** Man startet mit vollem Erbteil. Der Weg ins „ferne Land“ führt schnell und glitzernd bergab.
2. **Absturz:** Partys kosten Münzen, die Plattformen bröckeln, die Farben verblassen, am Ende steht man im Schweinestall. *„Da schlug er in sich“*: Der einzige Ausweg ist **umzukehren**.
3. **Heimweg:** Es geht bergauf und regnet. Die gesammelten Fragmente sind die Entschuldigung, die sich der Sohn zurechtlegt. **Vor dem schwersten Abschnitt rennt einem der Vater entgegen** (V. 20), den Abschnitt muss man nie spielen. So wird Gnade zur Mechanik. Das Fragment „mache mich zu einem deiner Tagelöhner“ findet man zwar, kann es aber nie einsetzen, weil der Vater einen unterbricht (V. 19 im Vergleich zu V. 21).
4. **Epilog (optional):** Man spielt den älteren Bruder vor der offenen Tür. Ob er hineingeht, bleibt offen.

### Rahmen der Welt

Die Weltkarte ist der Tisch aus Lk 15,1–2: Jesus isst mit Zöllnern und Sündern. Nach jedem Level sitzen mehr Gäste am Tisch, am Ende wird daraus das Fest aus Level 3.

## Ideen für spätere Welten (Neues Testament)

| Welt | Gleichnisse | Mechanik |
|---|---|---|
| Saat und Wachstum (Mt 13) | Sämann, Senfkorn, Unkraut im Weizen, Schatz im Acker | Samen wachsen je nach Boden zu Plattformen. Man darf nichts ausreißen. Am Ende gibt man alles her. |
| Bereit sein (Mt 7, Mt 25) | Haus auf Fels und Sand, Zehn Jungfrauen, Anvertraute Talente | Sand bröckelt. Öl ist der Vorrat für das Licht. Wer Münzen vergräbt, gewinnt nichts. |
| Einzelne Level | Barmherziger Samariter, Arbeiter im Weinberg | Helfen macht langsamer. Alle bekommen den gleichen Lohn, das unterläuft bewusst die Highscore-Logik. |

## Bibeltext und Rechte

- **Lutherbibel 1912:** Gemeinfrei. Der Text stammt wörtlich aus der Ausgabe von eBible.org (`deu1912`). In Joh 8,12 wurde ein offensichtlicher Tippfehler der Digitalisierung („wir“ statt „wird“) korrigiert.
- **Moderne Übersetzungen:** Luther 2017, BasisBibel und Hoffnung für alle sind geschützt. Vor einer Veröffentlichung damit braucht es die Erlaubnis des jeweiligen Verlags.

## Nächste Schritte

1. Level 1 auf echten Handys testen: Sprunggefühl, Schwierigkeit, Lesbarkeit
2. Level 2 „Der verlorene Groschen“ mit Lampe und Fegen
3. Level 3 „Der verlorene Sohn“ mit Umkehr und Gnade
4. Weltkarte (der Tisch), Speicherstand über mehrere Level
5. Musik und Sound verfeinern, Barrierefreiheit (Schriftgröße, Kontrast, einfacher Modus)
