import { describe, it, expect } from 'vitest';
import { numeroDuTexte } from './link-interventions-dossiers';

describe('numeroDuTexte', () => {
  it('lit le numéro d’un texte initial', () => {
    expect(numeroDuTexte('PIONANR5L17B1364')).toBe('1364');
  });

  it('lit celui d’un texte de commission, qui porte le même numéro', () => {
    expect(numeroDuTexte('PIONANR5L17BTC1364')).toBe('1364');
  });

  it('ne rend rien quand la référence n’en porte pas', () => {
    expect(numeroDuTexte('PRJLANR5L17PO420120')).toBeNull();
    expect(numeroDuTexte(null)).toBeNull();
    expect(numeroDuTexte('')).toBeNull();
  });

  it('ne se laisse pas prendre par un numéro au milieu de la référence', () => {
    // Le numéro de dépôt est en fin de référence ; ce qui précède est la
    // législature et le type de texte.
    expect(numeroDuTexte('PIONANR5L16BTC2071')).toBe('2071');
  });
});
