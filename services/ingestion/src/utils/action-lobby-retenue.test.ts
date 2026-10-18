import { describe, it, expect } from 'vitest';
import { actionRetenue, type ActionCandidate } from './action-lobby-retenue';

const action = (o: Partial<ActionCandidate>): ActionCandidate => ({
  datePublication: null,
  cible: null,
  cibleTypeId: null,
  texteVise: null,
  texteViseNom: null,
  ...o,
});

describe('actionRetenue', () => {
  it("retient la publication la plus récente, quel que soit l'ordre", () => {
    const ancienne = action({ datePublication: new Date('2025-01-01'), cible: 'ministre' });
    const recente = action({ datePublication: new Date('2025-06-01'), cible: 'parlementaire' });
    expect(actionRetenue(ancienne, recente)).toBe(recente);
    expect(actionRetenue(recente, ancienne)).toBe(recente);
  });

  it('préfère une date connue à une date absente', () => {
    const datee = action({ datePublication: new Date('2020-01-01'), cible: 'b' });
    const sansDate = action({ cible: 'a' });
    expect(actionRetenue(sansDate, datee)).toBe(datee);
    expect(actionRetenue(datee, sansDate)).toBe(datee);
  });

  it('départage deux activités de même date sur leurs valeurs, dans les deux sens', () => {
    const a = action({ datePublication: new Date('2025-01-01'), cible: 'administration', cibleTypeId: 3 });
    const b = action({ datePublication: new Date('2025-01-01'), cible: 'ministre', cibleTypeId: 1 });
    expect(actionRetenue(a, b)).toBe(actionRetenue(b, a));
  });

  it('donne la même activité quel que soit le rang dans un lot de trois', () => {
    const lot = [
      action({ cible: 'ministre', texteVise: 'PLF' }),
      action({ cible: 'administration' }),
      action({ cible: 'parlementaire', cibleTypeId: 7 }),
    ];
    const reduire = (l: ActionCandidate[]) => l.reduce((acc, c) => actionRetenue(acc, c));
    const attendu = reduire(lot);
    expect(reduire([lot[2]!, lot[0]!, lot[1]!])).toBe(attendu);
    expect(reduire([lot[1]!, lot[2]!, lot[0]!])).toBe(attendu);
  });
});
