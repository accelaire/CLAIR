import { describe, it, expect } from 'vitest';
import { booleenDeRequete } from './requete';

describe('booleenDeRequete', () => {
  it('lit « false » comme faux, que la valeur soit une chaîne ou un booléen', () => {
    expect(booleenDeRequete.parse('false')).toBe(false);
    expect(booleenDeRequete.parse(false)).toBe(false);
    expect(booleenDeRequete.parse('true')).toBe(true);
    expect(booleenDeRequete.parse(true)).toBe(true);
  });

  it('refuse les autres valeurs', () => {
    expect(() => booleenDeRequete.parse('oui')).toThrow();
    expect(() => booleenDeRequete.parse('')).toThrow();
  });

  it('garde sa valeur par défaut quand le paramètre est absent', () => {
    expect(booleenDeRequete.default(true).parse(undefined)).toBe(true);
  });
});
