import { describe, it, expect } from 'vitest';
import { numeroDuTexte, cleDuTexte } from './link-interventions-dossiers';

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

describe('cleDuTexte', () => {
  it('lie le numéro à sa législature, que le numéro seul ne dit pas', () => {
    // Le texte n° 1364 existe en 15e, en 16e ET en 17e : c'est exactement la
    // collision qui avait rattaché 531 scrutins des 15e/16e à des amendements
    // de la 17e.
    expect(cleDuTexte('15', '1364')).not.toBe(cleDuTexte('17', '1364'));
    expect(cleDuTexte(17, '1364')).toBe(cleDuTexte('17', '1364'));
  });
});
