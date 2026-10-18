import { describe, it, expect } from 'vitest';
import { libelleRetenu } from './libelle-secteur';

describe('libelleRetenu', () => {
  it('préfère la graphie accentuée, dans les deux ordres', () => {
    const a = 'Education, enseignement, formation';
    const b = 'Éducation, enseignement, formation';
    expect(libelleRetenu([a, b])).toBe(b);
    expect(libelleRetenu([b, a])).toBe(b);
  });

  it("départage deux graphies aussi accentuées par l'ordre lexical", () => {
    expect(libelleRetenu(['Santé b', 'Santé a'])).toBe('Santé a');
  });

  it('rend le libellé unique tel quel', () => {
    expect(libelleRetenu(['Culture'])).toBe('Culture');
  });
});
