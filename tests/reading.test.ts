import { describe, expect, it } from 'vitest';
import { breakLines, lineStarts, readingHold } from '../src/state/reading';

describe('verses unfolding like a thought', () => {
  it('lets every line wait until the one before can be read', () => {
    const starts = lineStarts(['Und an demselben Tage des Abends', 'sprach er zu ihnen: Laßt uns', 'hinüberfahren.']);
    expect(starts[0]).toBeGreaterThan(0);
    expect(starts[1] - starts[0]).toBeGreaterThan(1);
    expect(starts[2]).toBeGreaterThan(starts[1]);
    // a longer line takes longer to read
    const [, short] = lineStarts(['kurz', 'x']);
    const [, long] = lineStarts(['eine deutlich längere Zeile mit Worten', 'x']);
    expect(long).toBeGreaterThan(short);
  });

  it('keeps a verse long enough to read, within bounds', () => {
    const short = readingHold('Schweig und verstumme!');
    expect(short).toBeGreaterThanOrEqual(3);
    expect(short).toBeLessThan(3.5);
    const medium = readingHold('x'.repeat(120));
    expect(medium).toBeGreaterThan(6);
    expect(medium).toBeLessThan(10);
    expect(readingHold('x'.repeat(2000))).toBe(14);
  });

  it('breaks words into lines that fit', () => {
    const words = 'Und es erhob sich ein großer Windwirbel und warf die Wellen in das Schiff'.split(' ');
    const lines = breakLines(words, 20, (t) => t.length);
    expect(lines.flat()).toEqual(words.map((_, i) => i));
    for (const l of lines) {
      const text = l.map((i) => words[i]).join(' ');
      expect(text.length <= 20 || l.length === 1).toBe(true);
    }
    // a single word wider than the line still gets a line of its own
    expect(breakLines(['Windwirbel'], 4, (t) => t.length)).toEqual([[0]]);
    expect(breakLines([], 20, (t) => t.length)).toEqual([]);
  });
});
