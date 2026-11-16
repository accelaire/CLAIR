import { describe, expect, it } from 'vitest';
import { heureDeSeance, jourDeSeance, libelleDeSeance } from './debats';

describe('jourDeSeance / heureDeSeance', () => {
  it("sépare le jour et l'heure, l'heure en espaces insécables", () => {
    expect(jourDeSeance('2026-07-20T21:30:00Z')).toBe('lundi 20 juillet 2026');
    expect(heureDeSeance('2026-07-20T21:30:00Z')).toBe('21 h 30');
    expect(heureDeSeance('2026-07-20T15:00:00Z')).toBe('15 heures');
    expect(heureDeSeance('2026-07-20T01:00:00Z')).toBe('1 heure');
  });

  it("minuit pile : heure inconnue, le libellé n'a que le jour", () => {
    expect(heureDeSeance('2026-07-20T00:00:00Z')).toBe('');
    expect(libelleDeSeance('2026-07-20T00:00:00Z')).toBe('lundi 20 juillet 2026');
    expect(libelleDeSeance('2026-07-20T21:30:00Z')).toBe('lundi 20 juillet 2026, 21 h 30');
  });

  it('date invalide : vide', () => {
    expect(jourDeSeance('pas une date')).toBe('');
    expect(heureDeSeance('pas une date')).toBe('');
  });
});
