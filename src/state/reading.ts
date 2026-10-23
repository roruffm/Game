// The pace at which verses unfold beside the organism, line by line, like a thought. The
// encounters use the same numbers to decide how long a verse stays before the next one.

/** Roughly how many characters fit a line of a thought. */
export const LINE_CHARS = 38;

/** Seconds after which each line appears: every line waits until the one before can be read. */
export function lineStarts(lines: string[], first = 0.25): number[] {
  const out: number[] = [];
  let t = first;
  for (const line of lines) {
    out.push(t);
    t += 0.35 + line.length / 24;
  }
  return out;
}

/** How long a verse stays before the next one: time to unfold, and a moment to finish reading. */
export function readingHold(text: string): number {
  const lines = Math.max(1, Math.ceil(text.length / LINE_CHARS));
  return Math.max(3, Math.min(14, 0.25 + lines * 0.35 + text.length / 24 + 1.6));
}

/**
 * Seconds after which a verse, unfolding line by line, has been read and may become food: the
 * last line has had its time, and a moment more.
 */
export function ripeAfter(lines: string[]): number {
  if (!lines.length) return 0;
  const starts = lineStarts(lines);
  const last = lines[lines.length - 1];
  return starts[starts.length - 1] + 0.35 + last.length / 24 + 2.2;
}

/**
 * Breaks words into lines no wider than `maxWidth`, measured by `measure` (canvas text width
 * in the browser). Returns the indices of the words on each line.
 */
export function breakLines(words: string[], maxWidth: number, measure: (text: string) => number): number[][] {
  const lines: number[][] = [];
  let current: number[] = [];
  let text = '';
  words.forEach((word, i) => {
    const next = text ? `${text} ${word}` : word;
    if (current.length && measure(next) > maxWidth) {
      lines.push(current);
      current = [i];
      text = word;
    } else {
      current.push(i);
      text = next;
    }
  });
  if (current.length) lines.push(current);
  return lines;
}

/** Small words that carry little meaning of their own; they do not become seed. */
const STOP = new Set(
  (
    'und oder aber denn doch so wie als wenn ob daß dass da nun auch noch nur schon ja gar sehr nicht kein keine ' +
    'der die das des dem den ein eine einem einen einer eines es er sie ihn ihm ihr ihnen sich man ' +
    'ich du wir ihr mich mir dich dir uns euch mein meine dein deine sein seine seinen seiner seinem seines ' +
    'ihre ihren ihrem ihres unser unsere euer eure dies diese dieser dieses jene jener welche welcher welches ' +
    'auf an in im ins zu zum zur von vom mit aus bei nach über unter um für durch gegen ohne bis vor hinter ' +
    'ist sind war waren ward wird werden worden sei hat haben hatte hatten habe ' +
    'etliches etliche etlicher indem darum darnach dieweil also hin her dannen mitten alle alles allen aller was wer'
  ).split(' '),
);

/**
 * The words of a verse that carry its meaning (nouns, verbs, adjectives), in order and each
 * once: what the sower sows in the dive. Punctuation around a word is dropped.
 */
export function keyWords(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\s+/)) {
    const word = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    const key = word.toLowerCase();
    if (word.length < 3 || STOP.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out;
}
