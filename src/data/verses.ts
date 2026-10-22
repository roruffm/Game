// Bible text: Lutherbibel 1912 (public domain), taken verbatim from the eBible.org edition.

export const TRANSLATION = 'Lutherbibel 1912';

export interface Verse {
  id: string;
  ref: string;
  /** The whole verse. */
  text: string;
  /** The part the player collects, in order. Joined with spaces they end `text`. */
  fragments: string[];
  /** Short background for teenagers and adults, one paragraph per entry. */
  context: string[];
  question: string;
}

export const VERSES: Record<string, Verse> = {
  'lk15-6': {
    id: 'lk15-6',
    ref: 'Lukas 15,6',
    text:
      'Und wenn er heimkommt, ruft er seine Freunde und Nachbarn und spricht zu ihnen: ' +
      'Freuet euch mit mir; denn ich habe mein Schaf gefunden, das verloren war.',
    fragments: ['Freuet euch', 'mit mir;', 'denn ich habe', 'mein Schaf gefunden,', 'das verloren war.'],
    context: [
      'Jesus erzählt dieses Gleichnis, weil sich Pharisäer und Schriftgelehrte über ihn beschweren: „Dieser nimmt die Sünder an und isset mit ihnen“ (Lk 15,2). Seine Antwort sind drei Geschichten über Verlorenes, das gefunden wird.',
      'Hirten hatten damals keinen guten Ruf. Ausgerechnet einen Hirten macht Jesus zum Bild dafür, wie Gott sucht.',
      'Der Hirte lässt neunundneunzig Schafe „in der Wüste“ zurück – für ein einziges. Als er es findet, gibt es keine Strafpredigt. Er trägt es heim, „auf seinen Achseln mit Freuden“ (Lk 15,5), und feiert mit allen.',
    ],
    question: 'Wann hat dich zuletzt jemand gesucht – oder hast du gemerkt, dass niemand sucht?',
  },
};

/** Verses the player will find in later levels, shown as locked entries in the verse book. */
export const UPCOMING = [
  { ref: 'Lukas 15,9', title: 'Der verlorene Groschen' },
  { ref: 'Lukas 15,24', title: 'Der verlorene Sohn' },
];

export const QUOTES = {
  title: {
    ref: 'Johannes 8,12',
    text: 'Ich bin das Licht der Welt; wer mir nachfolgt, der wird nicht wandeln in der Finsternis, sondern wird das Licht des Lebens haben.',
  },
  world1: {
    ref: 'Lukas 15,1–3',
    text:
      'Es nahten aber zu ihm allerlei Zöllner und Sünder, daß sie ihn hörten. Und die Pharisäer und Schriftgelehrten murrten und sprachen: ' +
      'Dieser nimmt die Sünder an und isset mit ihnen. Er sagte aber zu ihnen dies Gleichnis und sprach:',
  },
  carry: { ref: 'Lukas 15,5', text: 'Und wenn er’s gefunden hat, so legt er’s auf seine Achseln mit Freuden.' },
  rest: { ref: 'Matthäus 11,28', text: 'Kommet her zu mir alle, die ihr mühselig und beladen seid; ich will euch erquicken.' },
  joy: { ref: 'Lukas 15,7', text: 'Ich sage euch: Also wird auch Freude im Himmel sein über einen Sünder, der Buße tut, vor neunundneunzig Gerechten, die der Buße nicht bedürfen.' },
};
