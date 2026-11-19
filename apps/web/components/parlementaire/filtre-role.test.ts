import { describe, expect, it } from 'vitest';
import { libelleRole, roleParDefaut } from './filtre-role';

describe('roleParDefaut', () => {
  it('ouvre sur les amendements déposés', () => {
    expect(roleParDefaut({ votes: 10, interventions: 3, amendements: 57690, amendementsDeposes: 4995 })).toBe('depose');
  });

  it('ouvre sur les cosignés pour qui n’a fait que cosigner', () => {
    expect(roleParDefaut({ votes: 10, interventions: 3, amendements: 412, amendementsDeposes: 0 })).toBe('cosigne');
  });

  it('garde les déposés sans la taille des listes (réponse en cache)', () => {
    expect(roleParDefaut(undefined)).toBe('depose');
    expect(roleParDefaut({ votes: 1, interventions: 0, amendements: 5 })).toBe('depose');
  });
});

describe('libelleRole', () => {
  it('accorde en nombre', () => {
    expect(libelleRole('depose', 1)).toBe('déposé');
    expect(libelleRole('depose', 2)).toBe('déposés');
    expect(libelleRole('cosigne', 0)).toBe('cosigné');
  });
});
