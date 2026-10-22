import { describe, expect, it } from 'vitest';
import { loadBible } from './helpers';

const { bible } = loadBible();

describe('Bible Data Service', () => {
  it('uses the KJV versification of the cross-reference data', () => {
    expect(bible.versification.verses).toBe(31102);
    expect(bible.chapterCount).toBe(1189);
  });

  it('converts between references and global verse indices', () => {
    const i = bible.index({ b: 40, c: 4, v: 39 }); // Markus 4,39
    expect(bible.ref(i)).toEqual({ b: 40, c: 4, v: 39 });
    expect(bible.ref(0)).toEqual({ b: 0, c: 1, v: 1 });
    expect(bible.ref(31101)).toEqual({ b: 65, c: 22, v: 21 });
  });

  it('formats German references', () => {
    expect(bible.format(bible.range('MAR 4:35-41'))).toBe('Markus 4,35–41');
    expect(bible.format(bible.range('PSA 107:29'))).toBe('Psalm 107,29');
    expect(bible.format(bible.range('LUK 15:11-32'), 'short')).toBe('Lk 15,11–32');
    expect(bible.formatChapter(bible.chapterOf(bible.range('GEN 22:18').start))).toBe('1. Mose 22');
  });

  it('understands what people type', () => {
    const cases: [string, string][] = [
      ['Mk 4,35-41', 'Markus 4,35–41'],
      ['Markus 4:39', 'Markus 4,39'],
      ['1. Mose 22,18', '1. Mose 22,18'],
      ['1Mo 22,18', '1. Mose 22,18'],
      ['Joh 3,16', 'Johannes 3,16'],
      ['röm 8,28', 'Römer 8,28'],
      ['Psalm 23', 'Psalm 23,1–6'],
      ['Offb 21,1–5', 'Offenbarung 21,1–5'],
    ];
    for (const [input, out] of cases) expect(bible.format(bible.parse(input)!)).toBe(out);
    expect(bible.parse('Markus 17')).toBeNull();
    expect(bible.parse('Hallo')).toBeNull();
    expect(bible.parse('Joh 3,99')).toBeNull();
  });

  it('loads the Lutherbibel 1912 text with German verse numbers where they differ', async () => {
    const [v] = await bible.verses(bible.range('MAR 4:39'));
    expect(v.text).toBe('Und er stand auf und bedrohte den Wind und sprach zu dem Meer: Schweig und verstumme! Und der Wind legte sich, und es ward eine große Stille.');
    const [jona] = await bible.verses(bible.range('JON 1:17'));
    expect(jona.germanNumber).toBe('2:1');
    expect(jona.text.startsWith('Aber der HERR verschaffte einen großen Fisch')).toBe(true);
  });
});
