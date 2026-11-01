import { describe, expect, it } from 'vitest';
import { libellePresence, presenceDe } from './presence';

describe('presenceDe', () => {
  it('prend la présence aux votes solennels pour un sénateur', () => {
    expect(presenceDe('senat', { presence: 100, presenceSolennel: 73 })).toBe(73);
  });

  it("rend null pour un sénateur sans scrutin solennel, jamais le taux tous scrutins", () => {
    expect(presenceDe('senat', { presence: 100, presenceSolennel: null })).toBeNull();
    expect(presenceDe('senat', { presence: 100 })).toBeNull();
  });

  it('garde le taux tous scrutins pour un député', () => {
    expect(presenceDe('assemblee', { presence: 64, presenceSolennel: 80 })).toBe(64);
  });

  it('rend null sans stats', () => {
    expect(presenceDe('assemblee', null)).toBeNull();
  });
});

describe('libellePresence', () => {
  it('nomme la présence du Sénat', () => {
    expect(libellePresence('senat')).toBe('Présence aux votes solennels');
    expect(libellePresence('assemblee')).toBe('Présence');
  });
});
