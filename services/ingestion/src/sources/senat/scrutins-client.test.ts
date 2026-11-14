import { describe, it, expect } from 'vitest';
import { dateDuScrutinSenat, typeVoteSenat, votesConcordentAvecTotaux, votesDuJsonScrutin } from './scrutins-client';
import { delegantsDesScrutins, statutVotant } from './dosleg-client';

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

// Extrait de https://www.senat.fr/scrutin-public/2026/scr2026-1.json (17/10/2026).
const JSON_SCRUTIN = {
  votes: [
    { matricule: '21071F', vote: 'c', siege: 97 },
    { matricule: '21686H', vote: 'p', siege: 114 },
    { matricule: '20684B', vote: 'n', siege: 301 },
    { matricule: '21714T', vote: 'a', siege: 271 },
  ],
};

describe('votesDuJsonScrutin', () => {
  it('lit matricule et position, la non-participation comme DOSLEG', () => {
    expect(votesDuJsonScrutin(JSON_SCRUTIN)).toEqual([
      { matricule: '21071F', position: 'contre', parDelegation: false },
      { matricule: '21686H', position: 'pour', parDelegation: false },
      { matricule: '20684B', position: 'absent', parDelegation: false },
      { matricule: '21714T', position: 'abstention', parDelegation: false },
    ]);
  });

  it("écarte un vote au code inconnu ou sans matricule plutôt que de le deviner", () => {
    expect(votesDuJsonScrutin({ votes: [{ matricule: '21071F', vote: 'x' }, { vote: 'p' }, { matricule: '', vote: 'p' }] }))
      .toEqual([]);
  });

  it("rend une liste vide sur une réponse qui n'est pas un scrutin", () => {
    expect(votesDuJsonScrutin(null)).toEqual([]);
    expect(votesDuJsonScrutin('<html>')).toEqual([]);
    expect(votesDuJsonScrutin({ votes: 'non' })).toEqual([]);
  });
});

describe('votesConcordentAvecTotaux', () => {
  const votes = votesDuJsonScrutin(JSON_SCRUTIN);

  it('accepte des votes qui retombent sur les totaux, absents non comptés', () => {
    expect(votesConcordentAvecTotaux(votes, { nombrePour: 1, nombreContre: 1, nombreAbstention: 1 })).toBe(true);
  });

  it("refuse des votes qui ne retombent pas sur les totaux", () => {
    expect(votesConcordentAvecTotaux(votes, { nombrePour: 111, nombreContre: 198, nombreAbstention: 33 })).toBe(false);
    expect(votesConcordentAvecTotaux([], { nombrePour: 1, nombreContre: 0, nombreAbstention: 0 })).toBe(false);
  });
});

describe('typeVoteSenat', () => {
  const delegue = { parDelegation: true };
  const groupe = { parDelegation: false };

  it('marque solennel un scrutin avec au moins une délégation personnelle', () => {
    expect(typeVoteSenat('2024-2025', [groupe, delegue, groupe])).toBe('solennel');
  });

  it('laisse ordinaire un scrutin voté par groupe', () => {
    expect(typeVoteSenat('2024-2025', [groupe, groupe])).toBe('ordinaire');
  });

  it("ne déduit rien avant 2014, DOSLEG n'y publie aucune délégation", () => {
    expect(typeVoteSenat('2013-2014', [delegue])).toBe('ordinaire');
  });
});

describe('statutVotant', () => {
  it('lit président de séance et membre du gouvernement', () => {
    expect(statutVotant('8')).toBe('president_seance');
    expect(statutVotant('9')).toBe('gouvernement');
  });

  it('laisse sans statut les positions systématiques et le code 0', () => {
    expect(statutVotant('0')).toBeNull();
    expect(statutVotant('3')).toBeNull();
    expect(statutVotant(null)).toBeNull();
  });
});

describe('delegantsDesScrutins', () => {
  it("marque l'absent, nommé sur la ligne de celui qui vote pour lui", () => {
    // Budget 2025 (2024-175) : « Pascal Allizard à Laurent Duplomb ».
    const delegants = delegantsDesScrutins([
      { sesann: 2024, scrnum: 175, senmatdel: null }, // Allizard, absent
      { sesann: 2024, scrnum: 175, senmatdel: '14133K' }, // Duplomb, porte le vote d'Allizard
      { sesann: 2024, scrnum: 176, senmatdel: null },
    ]);
    expect([...(delegants.get('2024-175') ?? [])]).toEqual(['14133K']);
    expect(delegants.has('2024-176')).toBe(false);
  });
});
