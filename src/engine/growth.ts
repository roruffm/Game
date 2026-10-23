// How the organism grows from what it takes in. Like the creatures of flOw it eats: the words of
// verses it has read. Every word adds a little: the body lengthens and grows, and at certain
// points a new kind of form unfolds. Pure numbers, so it can be tested without graphics.

export interface Growth {
  /** Number of body segments. */
  segments: number;
  /** Small cilia around the head. */
  cilia: number;
  /** 0–1: how far each kind of form has unfolded. */
  fins: number;
  tail: number;
  crown: number;
  pattern: number;
  veil: number;
  /** Overall size (1 at the start). */
  scale: number;
  /** How many stages have been reached (0 at the start). */
  stage: number;
}

/** The stages, by the number of words eaten. One encounter, read and eaten, is about 150–500 words. */
export const STAGES = [
  { at: 40, form: 'fins', name: 'Flossen' },
  { at: 120, form: 'tail', name: 'einen Schweif aus Lichtfäden' },
  { at: 250, form: 'crown', name: 'eine Krone aus Licht' },
  { at: 420, form: 'pattern', name: 'wandernde Leuchtmuster' },
  { at: 650, form: 'veil', name: 'zwei Schwingen aus Licht' },
] as const;

/** A new form unfolds gradually over this many words. */
const UNFOLD = 30;

const unfold = (words: number, at: number) => Math.max(0, Math.min(1, (words - at) / UNFOLD));

export function growth(words: number): Growth {
  const n = Math.max(0, Math.floor(words));
  const at = (form: (typeof STAGES)[number]['form']) => STAGES.find((s) => s.form === form)!.at;
  return {
    segments: Math.min(26, 6 + Math.floor(n / 25)),
    cilia: Math.min(28, 12 + Math.floor(n / 40)),
    fins: unfold(n, at('fins')),
    tail: unfold(n, at('tail')),
    crown: unfold(n, at('crown')),
    pattern: unfold(n, at('pattern')),
    veil: unfold(n, at('veil')),
    scale: 1 + Math.min(0.7, n / 1400),
    stage: STAGES.filter((s) => n >= s.at).length,
  };
}
