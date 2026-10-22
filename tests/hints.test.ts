import { describe, expect, it } from 'vitest';
import { sharedWords } from '../src/xref/hints';

describe('automatic hints', () => {
  it('finds words two passages share, ignoring small words', () => {
    const a = 'Und er stand auf und bedrohte den Wind und sprach zu dem Meer: Schweig und verstumme!';
    const b = 'Du herrschest über das ungestüme Meer; du stillest seine Wellen, wenn sie sich erheben.';
    expect(sharedWords(a, b)).toEqual(['Meer']);
  });

  it('matches simple word forms', () => {
    expect(sharedWords('die Wellen schlugen', 'eine Welle kam')).toEqual(['Wellen']);
  });
});
