import { describe, it, expect } from 'vitest';
import {
  cleDeNom,
  indexerOrateurs,
  resoudreOrateur,
  prenomEtNom,
  sourceUidCommission,
} from './interventions-commission';

const JOUR = new Date('2026-09-08');
/** Un mandat en cours au jour de la réunion. */
const EN_COURS = [{ debut: new Date('2024-07-07'), fin: null }];
/** Un mandat clos sept ans avant elle. */
const ANCIEN = [{ debut: new Date('2012-06-20'), fin: new Date('2017-06-20') }];

describe('cleDeNom', () => {
  it('efface les accents, la casse et la ponctuation', () => {
    expect(cleDeNom('Pieyre-Alexandre ANGLADE')).toBe('pieyre alexandre anglade');
    expect(cleDeNom('Éric Coquerel')).toBe('eric coquerel');
    expect(cleDeNom('Mme Nathalie Colin-Oesterlé')).toBe('mme nathalie colin oesterle');
  });

  it('rapproche les deux apostrophes', () => {
    expect(cleDeNom('Hervé de l’Épine')).toBe(cleDeNom("Hervé de l'Épine"));
  });
});

describe('resoudreOrateur', () => {
  const index = indexerOrateurs([
    { id: 'a', prenom: 'Thibault', nom: 'Bazin' },
    { id: 'b', prenom: 'Éric', nom: 'Coquerel' },
    { id: 'c', prenom: 'Charles', nom: 'de Courson' },
    // Deux Martin : le patronyme seul ne doit plus rien désigner.
    { id: 'd', prenom: 'Jean', nom: 'Martin' },
    { id: 'e', prenom: 'Claire', nom: 'Martin' },
  ]);

  it('résout un nom complet', () => {
    expect(resoudreOrateur('Thibault Bazin', index)).toBe('a');
    expect(resoudreOrateur('eric coquerel', index)).toBe('b');
  });

  it('résout un patronyme seul quand il est unique', () => {
    expect(resoudreOrateur('Bazin', index)).toBe('a');
  });

  it('refuse de choisir entre deux homonymes', () => {
    expect(resoudreOrateur('Martin', index)).toBeNull();
    // Les noms complets, eux, restent distincts.
    expect(resoudreOrateur('Jean Martin', index)).toBe('d');
    expect(resoudreOrateur('Claire Martin', index)).toBe('e');
  });

  it('garde la particule', () => {
    expect(resoudreOrateur('Charles de Courson', index)).toBe('c');
  });

  // Le piège qui a coûté 46 018 amendements mal attribués : chercher un nom
  // en sous-chaîne. Ici, une clé partielle ne doit RIEN rendre.
  it('ne résout pas sur une sous-chaîne', () => {
    expect(resoudreOrateur('Bazin Thibault Untel', index)).toBeNull();
    expect(resoudreOrateur('Thibault', index)).toBeNull();
    expect(resoudreOrateur('Coquerel Éric', index)).toBeNull();
  });

  it('rend null sur un orateur sans nom', () => {
    expect(resoudreOrateur(null, index)).toBeNull();
    expect(resoudreOrateur('', index)).toBeNull();
  });

  it('ne résout pas une homonymie parfaite', () => {
    const jumeaux = indexerOrateurs([
      { id: 'x', prenom: 'Jean', nom: 'Dupont' },
      { id: 'y', prenom: 'Jean', nom: 'Dupont' },
    ]);
    expect(resoudreOrateur('Jean Dupont', jumeaux)).toBeNull();
  });
});

describe('prenomEtNom', () => {
  it('sépare au premier espace', () => {
    expect(prenomEtNom('Thibault Bazin')).toEqual({ prenom: 'Thibault', nom: 'Bazin' });
    expect(prenomEtNom('Charles de Courson')).toEqual({ prenom: 'Charles', nom: 'de Courson' });
  });

  it('accepte un nom seul', () => {
    expect(prenomEtNom('Bazin')).toEqual({ prenom: null, nom: 'Bazin' });
    expect(prenomEtNom(null)).toEqual({ prenom: null, nom: null });
  });
});

describe('sourceUidCommission', () => {
  it('rend la réingestion idempotente', () => {
    expect(sourceUidCommission('CRCANR5L17S2026PO59051N090', 3)).toBe(
      'CRCANR5L17S2026PO59051N090#3'
    );
  });
});

// =============================================================================
// Départager les homonymes par ce que la réunion sait
// =============================================================================
//
// L'index porte 2 134 fiches, toutes législatures et deux chambres confondues :
// 124 patronymes y sont partagés, et 5 noms complets entrent en collision. La
// date de la réunion ramène ces derniers à 0 et les premiers à 38 ; la
// commission qui siège et la liste des présents tranchent le reste.

describe('resoudreOrateur — les cercles de la réunion', () => {
  const homonymes = indexerOrateurs([
    { id: 'ancien', prenom: 'Jean', nom: 'Dupont', mandats: ANCIEN },
    { id: 'siegeant', prenom: 'Jean', nom: 'Dupont', mandats: EN_COURS },
  ]);

  it('sans contexte, une homonymie parfaite ne résout rien', () => {
    expect(resoudreOrateur('Jean Dupont', homonymes)).toBeNull();
  });

  it('la date de la réunion désigne celui qui siégeait', () => {
    expect(resoudreOrateur('Jean Dupont', homonymes, { date: JOUR })).toBe('siegeant');
  });

  it('la commission qui siège tranche ce que la date laisse ouvert', () => {
    const index = indexerOrateurs([
      { id: 'lois', prenom: 'Claire', nom: 'Martin', mandats: EN_COURS },
      { id: 'finances', prenom: 'Claire', nom: 'Martin', mandats: EN_COURS },
    ]);
    expect(resoudreOrateur('Claire Martin', index, { date: JOUR })).toBeNull();
    expect(
      resoudreOrateur('Claire Martin', index, { date: JOUR, membres: new Set(['finances']) })
    ).toBe('finances');
  });

  // Le point important : ces cercles départagent, ils n'écartent jamais. Un
  // ancien député auditionné comme expert reste la même personne.
  it('une fiche unique est retenue même hors mandat', () => {
    const index = indexerOrateurs([{ id: 'parti', prenom: 'Jean', nom: 'Dupont', mandats: ANCIEN }]);
    expect(resoudreOrateur('Jean Dupont', index, { date: JOUR })).toBe('parti');
  });

  it("un cercle qui ne laisserait personne est ignoré plutôt qu'appliqué", () => {
    const index = indexerOrateurs([
      { id: 'a', prenom: 'Jean', nom: 'Dupont', mandats: ANCIEN },
      { id: 'b', prenom: 'Paul', nom: 'Dupont', mandats: EN_COURS },
    ]);
    // Aucun des deux n'est membre : on ne choisit pas au hasard pour autant.
    expect(
      resoudreOrateur('Jean Dupont', index, { date: JOUR, membres: new Set(['z']) })
    ).toBe('a');
  });

  it('une fiche sans mandat connu ne devient pas inéligible', () => {
    const index = indexerOrateurs([{ id: 'muet', prenom: 'Jean', nom: 'Dupont' }]);
    expect(resoudreOrateur('Jean Dupont', index, { date: JOUR })).toBe('muet');
  });
});

describe('resoudreOrateur — la liste des présents', () => {
  const index = indexerOrateurs([
    { id: 'gerard', prenom: 'Gérard', nom: 'Leseul', mandats: EN_COURS },
    { id: 'marie', prenom: 'Marie', nom: 'Leseul', mandats: EN_COURS },
  ]);

  it('rend son prénom à un patronyme nu', () => {
    expect(resoudreOrateur('Leseul', index, { date: JOUR })).toBeNull();
    expect(
      resoudreOrateur('Leseul', index, {
        date: JOUR,
        presents: ['Mme Karen Erodi', 'M. Gérard Leseul'],
      })
    ).toBe('gerard');
  });

  it('ne tranche pas si deux présents portent le patronyme', () => {
    expect(
      resoudreOrateur('Leseul', index, {
        date: JOUR,
        presents: ['M. Gérard Leseul', 'Mme Marie Leseul'],
      })
    ).toBeNull();
  });

  it('ignore la civilité et les accents de la liste', () => {
    const seul = indexerOrateurs([{ id: 'x', prenom: 'Élina', nom: 'Fiévet', mandats: EN_COURS }]);
    expect(resoudreOrateur('Fievet', seul, { presents: ['Mme Elina Fievet'] })).toBe('x');
  });

  // La règle qui ne bouge pas : jamais de sous-chaîne, même avec un contexte.
  it("la présence d'un contexte n'ouvre pas la porte aux correspondances partielles", () => {
    expect(
      resoudreOrateur('Leseul Gérard Untel', index, {
        date: JOUR,
        presents: ['M. Gérard Leseul'],
        membres: new Set(['gerard']),
      })
    ).toBeNull();
  });
});
