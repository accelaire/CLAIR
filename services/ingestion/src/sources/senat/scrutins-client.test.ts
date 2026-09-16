import { describe, it, expect } from 'vitest';
import { dateDuScrutinSenat } from './scrutins-client';

describe('dateDuScrutinSenat', () => {
  it('lit la date en UTC, pas dans le fuseau local', () => {
    // `new Date(2026, 1, 25)` donnerait minuit à Paris, enregistré
    // `2026-02-24T23:00:00Z` : le scrutin daterait de la veille.
    expect(dateDuScrutinSenat('25', 'février', '2026')?.toISOString()).toBe('2026-02-25T00:00:00.000Z');
  });

  it("ne décale pas davantage en heure d'été", () => {
    expect(dateDuScrutinSenat('24', 'juin', '2026')?.toISOString()).toBe('2026-06-24T00:00:00.000Z');
  });

  it('accepte les mois accentués quelle que soit leur casse', () => {
    expect(dateDuScrutinSenat('10', 'Août', '2025')?.toISOString()).toBe('2025-08-10T00:00:00.000Z');
  });

  it('accepte les jours à un seul chiffre', () => {
    expect(dateDuScrutinSenat('3', 'janvier', '2026')?.toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });

  it('ignore un nom de mois qui ne correspond à rien', () => {
    expect(dateDuScrutinSenat('10', 'joctidor', '2025')).toBeNull();
  });
});
