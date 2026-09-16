import { describe, it, expect } from 'vitest';
import { nomsPropres, departagerParOrdreDuJour } from './sync';

// Les libellés ci-dessous sont réels : titres de fiches de videos.senat.fr et
// ordres du jour tels que l'API d'agenda du Sénat les rend.

describe('nomsPropres', () => {
  it('retient les patronymes et écarte le vocabulaire de procédure', () => {
    const noms = nomsPropres('Audition de M. Jean-Michel Blanquer, ancien ministre');
    expect(noms.has('blanquer')).toBe(true);
    // Le prénom composé reste d'un seul tenant, et c'est mieux : « Jean-Michel »
    // discrimine là où « Jean » seul reviendrait sur toutes les auditions.
    expect(noms.has('jean-michel')).toBe(true);
    expect(noms.has('audition')).toBe(false);
    expect(noms.has('ministre')).toBe(false);
  });

  it('ignore les accents et la casse', () => {
    expect(nomsPropres("audition d'Emmanuel Grégoire").has('gregoire')).toBe(true);
  });

  it('écarte les mots trop courts', () => {
    expect(nomsPropres('M. X et Mme Y').size).toBe(0);
  });
});

describe('departagerParOrdreDuJour', () => {
  // Le cas réel du 14 septembre 2026 : deux auditions de la commission de la
  // culture le même jour, une seule vidéo à placer.
  const candidats = [
    { id: 'matin', odjResume: "Audition de M. Jean-Michel Blanquer, ancien ministre de l'éducation nationale" },
    { id: 'midi', odjResume: 'Audition de Mme Victoire Haffreingue-Moulart, journaliste' },
  ];

  it('place la vidéo sur la réunion que son titre nomme', () => {
    expect(
      departagerParOrdreDuJour('Violences dans le périscolaire : Jean-Michel Blanquer', candidats)
    ).toBe('matin');
    expect(
      departagerParOrdreDuJour('Audition de Victoire Haffreingue-Moulart', candidats)
    ).toBe('midi');
  });

  // La règle qui compte : une ambiguïté qu'on ne sait pas trancher rend null.
  it('ne tranche pas sans nom propre commun', () => {
    expect(departagerParOrdreDuJour('Violences dans le périscolaire', candidats)).toBeNull();
  });

  it('ne tranche pas entre deux ordres du jour identiques', () => {
    expect(
      departagerParOrdreDuJour('Audition de M. Blanquer', [
        { id: 'a', odjResume: 'Audition de M. Blanquer' },
        { id: 'b', odjResume: 'Audition de M. Blanquer' },
      ])
    ).toBeNull();
  });

  it('ne tranche pas sur un ordre du jour absent', () => {
    expect(
      departagerParOrdreDuJour('Audition de M. Blanquer', [
        { id: 'a', odjResume: null },
        { id: 'b', odjResume: null },
      ])
    ).toBeNull();
  });
});
