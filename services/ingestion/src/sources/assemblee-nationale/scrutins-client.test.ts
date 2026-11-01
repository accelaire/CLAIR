import { describe, it, expect } from 'vitest';
import { extraireVotesAN, statutVotantAN, type ANScrutin } from './scrutins-client';

function scrutin(decompteNominatif: Record<string, unknown>): ANScrutin {
  return {
    ventilationVotes: { organe: { organeRef: 'PO1', groupes: { groupe: [{ vote: { decompteNominatif } }] } } },
  } as unknown as ANScrutin;
}

describe('statutVotantAN', () => {
  it('lit les causes de non-vote publiées par l’Assemblée', () => {
    expect(statutVotantAN('PAN')).toBe('president_assemblee');
    expect(statutVotantAN('PSE')).toBe('president_seance');
    expect(statutVotantAN('MG')).toBe('gouvernement');
    expect(statutVotantAN(undefined)).toBeNull();
  });
});

describe('extraireVotesAN', () => {
  it('écrit les non-votants de droit en « absent » avec leur cause (#108)', () => {
    const votes = extraireVotesAN(
      scrutin({
        pours: { votant: { acteurRef: 'PA1', mandatRef: 'PM1', parDelegation: 'false' } },
        nonVotants: {
          votant: [
            { acteurRef: 'PA2', mandatRef: 'PM2', parDelegation: 'false', causePositionVote: 'PAN' },
            { acteurRef: 'PA3', mandatRef: 'PM3', parDelegation: 'false', causePositionVote: 'PSE' },
          ],
        },
      }),
    );
    expect(votes).toEqual([
      { acteurRef: 'PA2', position: 'absent', parDelegation: false, statutVotant: 'president_assemblee' },
      { acteurRef: 'PA3', position: 'absent', parDelegation: false, statutVotant: 'president_seance' },
      { acteurRef: 'PA1', position: 'pour', parDelegation: false },
    ]);
  });

  it("n'écrit pas un non-votant sans cause connue", () => {
    const votes = extraireVotesAN(
      scrutin({ nonVotants: { votant: { acteurRef: 'PA9', mandatRef: 'PM9', parDelegation: 'false' } } }),
    );
    expect(votes).toEqual([]);
  });
});
