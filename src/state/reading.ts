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
