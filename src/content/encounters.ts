// The playable encounters: passage, phases, question. The interactive part lives in
// src/encounters/<id>.ts; this file is the content every other system reads.

export type EncounterId = 'saemann' | 'storm' | 'prodigal' | 'emmaus';

export interface EncounterInfo {
  id: EncounterId;
  title: string;
  /** The whole passage, data notation. */
  range: string;
  /** The verse the encounter closes on. */
  keyVerse: string;
  color: number;
  accent: number;
  question: string;
  themes: string[];
  /** A short framing sentence in the game's own words (shown as "Hinführung"). */
  intro: string;
  phases: { title: string; verses: string }[];
  /** The encounter makes seed of its verses itself (the dive), so read verses do not also spill as food. */
  ownFood?: boolean;
}

export const ENCOUNTERS: EncounterInfo[] = [
  {
    // a dive: each kind of ground in the parable is a layer, one below the other
    id: 'saemann',
    title: 'Vom Sämann',
    range: 'LUK 8:4-15',
    keyVerse: 'LUK 8:15',
    color: 0xb8e07a,
    accent: 0xffe2a8,
    question: 'Wo fällt ein gutes Wort bei dir gerade auf guten Boden – und was macht es ihm schwer?',
    themes: ['glaube', 'hoffnung'],
    intro: 'Viel Volk ist zusammengekommen. Jesus erzählt ein Gleichnis vom Säen und von dem Boden, auf den die Saat fällt.',
    phases: [
      { title: 'Das Volk', verses: 'V. 4' },
      { title: 'Der Weg', verses: 'V. 5' },
      { title: 'Der Fels', verses: 'V. 6' },
      { title: 'Die Dornen', verses: 'V. 7' },
      { title: 'Gutes Land', verses: 'V. 8' },
      { title: 'Der Same ist das Wort', verses: 'V. 9–15' },
    ],
    ownFood: true,
  },
  {
    id: 'storm',
    title: 'Jesus stillt den Sturm',
    range: 'MAR 4:35-41',
    keyVerse: 'MAR 4:41',
    color: 0x4fd6ff,
    accent: 0xbff4ff,
    question: 'Wo erlebst du gerade so etwas wie einen Sturm – und was würdest du fragen, wenn du mit im Boot säßest?',
    themes: ['glaube', 'identitaet'],
    intro: 'Abends auf dem See Genezareth. Jesus und seine Jünger wollen ans andere Ufer.',
    phases: [
      { title: 'Der See', verses: 'V. 35–36' },
      { title: 'Der Sturm', verses: 'V. 37–38' },
      { title: 'Jesu Worte', verses: 'V. 39' },
      { title: 'Wer ist der?', verses: 'V. 40–41' },
    ],
  },
  {
    id: 'prodigal',
    title: 'Der verlorene Sohn',
    range: 'LUK 15:11-32',
    keyVerse: 'LUK 15:24',
    color: 0xffc865,
    accent: 0xb48cff,
    question: 'In wem erkennst du dich in dieser Geschichte am ehesten wieder: im jüngeren Sohn, im älteren – oder im Vater?',
    themes: ['gnade', 'umkehr', 'liebe'],
    intro: 'Jesus erzählt ein Gleichnis, weil sich manche darüber beschweren, dass er mit „Sündern“ isst (Lukas 15,1–3).',
    phases: [
      { title: 'Entfernung', verses: 'V. 11–16' },
      { title: 'Rückkehr', verses: 'V. 17–19' },
      { title: 'Der Vater', verses: 'V. 20–24' },
      { title: 'Der ältere Bruder', verses: 'V. 25–32' },
    ],
  },
  {
    id: 'emmaus',
    title: 'Die Emmausjünger',
    range: 'LUK 24:13-35',
    keyVerse: 'LUK 24:32',
    color: 0xffa98a,
    accent: 0xffe2a8,
    question: 'Gab es Momente, in denen dir ein Zusammenhang erst im Nachhinein aufgegangen ist?',
    themes: ['hoffnung', 'identitaet'],
    intro: 'Am dritten Tag nach der Kreuzigung. Zwei Jünger gehen von Jerusalem nach Emmaus.',
    phases: [
      { title: 'Unterwegs', verses: 'V. 13–24' },
      { title: 'Die Schrift verstehen', verses: 'V. 25–27' },
      { title: 'Das Wiedererkennen', verses: 'V. 28–32' },
      { title: 'Zurück nach Jerusalem', verses: 'V. 33–35' },
    ],
  },
];

export const encounterById = (id: EncounterId) => ENCOUNTERS.find((e) => e.id === id)!;
