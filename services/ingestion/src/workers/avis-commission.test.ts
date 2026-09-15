import { describe, it, expect } from 'vitest';
import { numeroDuTexteDeLaRef, cleAmendement } from './avis-commission';

describe('numeroDuTexteDeLaRef', () => {
  it('lit le numéro d’un texte initial et celui d’un texte de commission', () => {
    expect(numeroDuTexteDeLaRef('PIONANR5L17B1364')).toBe('1364');
    expect(numeroDuTexteDeLaRef('PIONANR5L17BTC1364')).toBe('1364');
  });

  it('ne rend rien quand la référence n’en porte pas', () => {
    expect(numeroDuTexteDeLaRef('PRJLANR5L17PO420120')).toBeNull();
    expect(numeroDuTexteDeLaRef(null)).toBeNull();
  });
});

describe('cleAmendement', () => {
  // Le numéro est la seule chose que le tableau imprime ; la clé doit donc
  // absorber ce que la mise en page y ajoute.
  it('ignore les espaces et la casse', () => {
    expect(cleAmendement('1906', '2848')).toBe(cleAmendement('1906', ' 2848 '));
    expect(cleAmendement('1906', 'I-77')).toBe(cleAmendement('1906', 'i-77'));
  });

  // Ce qui rend la clé sûre : deux textes différents ne se confondent pas,
  // alors qu'ils portent tous deux un amendement n° 1.
  it('sépare deux textes qui partagent un numéro d’amendement', () => {
    expect(cleAmendement('994', '1')).not.toBe(cleAmendement('2525', '1'));
  });
});
