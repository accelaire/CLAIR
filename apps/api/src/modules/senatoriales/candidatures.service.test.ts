import { describe, it, expect } from 'vitest';

import {
  indexerCandidaturesParSlug,
  parRang,
  synthetiserCandidatures,
  type Candidat,
  type ListeCandidature,
  type Sortant,
} from './senatoriales.service';

function candidat(partiel: Partial<Candidat> = {}): Candidat {
  return {
    id: partiel.id ?? 'candidature-1',
    nom: partiel.nom ?? 'DUPONT',
    prenom: partiel.prenom ?? 'Jean',
    sexe: partiel.sexe ?? 'M',
    anneeNaissance: partiel.anneeNaissance ?? 1965,
    profession: partiel.profession ?? null,
    ordre: partiel.ordre ?? 1,
    role: partiel.role ?? 'titulaire',
    sortant: partiel.sortant ?? false,
    personne: partiel.personne ?? null,
  };
}

function liste(candidats: Candidat[], departement = '01'): ListeCandidature {
  return {
    id: `liste-${departement}-${candidats.map((c) => c.id).join('-')}`,
    circonscription: { departement, nom: 'Ain' },
    modeScrutin: 'proportionnel',
    libelle: 'UNE LISTE',
    nuance: 'LDVD',
    nuanceLibelle: 'Liste divers droite',
    famille: 'droite',
    candidats,
  };
}

/** Sortant réduit aux seuls champs que lit `synthetiserCandidatures`. */
function sortant(id: string): Sortant {
  return { personne: { id } } as Sortant;
}

describe('synthetiserCandidatures', () => {
  it('rend null tant qu’aucune candidature n’est ingérée', () => {
    // Le fichier du ministère ne paraît qu'une semaine avant le scrutin. D'ici
    // là la page doit se rendre normalement, sans bloc candidats.
    expect(synthetiserCandidatures([], [sortant('p1')])).toBeNull();
  });

  it('compte les sortants qui se représentent, et ceux qui partent', () => {
    const listes = [
      liste([
        candidat({
          id: 'c1',
          sortant: true,
          personne: { slug: 'alice-martin', chambre: 'senat', photoUrl: null },
        }),
        candidat({ id: 'c2' }),
      ]),
    ];

    const resultat = synthetiserCandidatures(listes, [sortant('p1'), sortant('p2'), sortant('p3')]);

    expect(resultat).toMatchObject({
      listes: 1,
      candidats: 2,
      circonscriptions: 1,
      sortantsCandidats: 1,
      sortantsNonCandidats: 2,
    });
  });

  it('ne compte pas deux fois un sortant présent sur deux unités de vote', () => {
    // Un même sortant peut apparaître comme titulaire ici et comme suppléant
    // ailleurs. On compte des personnes, pas des lignes de candidature.
    const personne = { slug: 'alice-martin', chambre: 'senat', photoUrl: null };
    const listes = [
      liste([candidat({ id: 'c1', sortant: true, personne })], '01'),
      liste([candidat({ id: 'c2', sortant: true, personne, role: 'suppleant' })], '02'),
    ];

    const resultat = synthetiserCandidatures(listes, [sortant('p1')]);

    expect(resultat?.sortantsCandidats).toBe(1);
    expect(resultat?.sortantsNonCandidats).toBe(0);
    expect(resultat?.circonscriptions).toBe(2);
  });

  it('distingue les anciens parlementaires des sortants', () => {
    // Un ancien député qui se présente au Sénat n'est pas un sortant : c'est
    // l'autre moitié de l'intérêt du rattachement.
    const listes = [
      liste([
        candidat({
          id: 'c1',
          sortant: true,
          personne: { slug: 'alice-martin', chambre: 'senat', photoUrl: null },
        }),
        candidat({
          id: 'c2',
          sortant: false,
          personne: { slug: 'bob-durand', chambre: 'assemblee', photoUrl: null },
        }),
        candidat({ id: 'c3' }),
      ]),
    ];

    const resultat = synthetiserCandidatures(listes, [sortant('p1')]);

    expect(resultat).toMatchObject({
      sortantsCandidats: 1,
      anciensParlementaires: 1,
      candidats: 3,
    });
  });

  it('ne compte aucun ancien parlementaire quand personne n’est rattaché', () => {
    const listes = [liste([candidat({ id: 'c1' }), candidat({ id: 'c2' })])];

    expect(synthetiserCandidatures(listes, [sortant('p1')])).toMatchObject({
      sortantsCandidats: 0,
      sortantsNonCandidats: 1,
      anciensParlementaires: 0,
    });
  });
});

describe('indexerCandidaturesParSlug', () => {
  const personne = { slug: 'alice-martin', chambre: 'senat', photoUrl: null };

  it('rattache une candidature à la personne', () => {
    const listes = [liste([candidat({ id: 'c1', personne, ordre: 3 })], '39')];

    expect(indexerCandidaturesParSlug(listes).get('alice-martin')).toMatchObject({
      circonscription: { departement: '39' },
      nuance: 'LDVD',
      ordre: 3,
      role: 'titulaire',
    });
  });

  it('ignore les candidats non rattachés', () => {
    expect(indexerCandidaturesParSlug([liste([candidat({ id: 'c1' })])]).size).toBe(0);
  });

  it('retient la première candidature rencontrée', () => {
    // Une personne ne peut se présenter qu'une fois. Si elle apparaît deux
    // fois, l'ordre d'entrée fait foi plutôt qu'un écrasement silencieux par
    // la dernière ligne lue.
    const listes = [
      liste([candidat({ id: 'c1', personne })], '39'),
      liste([candidat({ id: 'c2', personne, role: 'suppleant' })], '01'),
    ];

    expect(indexerCandidaturesParSlug(listes).get('alice-martin')).toMatchObject({
      circonscription: { departement: '39' },
      role: 'titulaire',
    });
  });
});

describe('parRang', () => {
  it('place le titulaire avant son suppléant', () => {
    // Trier sur la chaîne `role` donnerait l'inverse, « suppleant » précédant
    // « titulaire » dans l'ordre alphabétique — un piège d'autant plus vicieux
    // qu'il produit un affichage parfaitement plausible.
    const suppleant = candidat({ id: 'c2', role: 'suppleant', ordre: 1 });
    const titulaire = candidat({ id: 'c1', role: 'titulaire', ordre: 1 });

    expect([suppleant, titulaire].sort(parRang).map((c) => c.role)).toEqual([
      'titulaire',
      'suppleant',
    ]);
  });

  it('respecte le rang déposé sur une liste', () => {
    const candidats = [
      candidat({ id: 'c3', ordre: 3 }),
      candidat({ id: 'c1', ordre: 1 }),
      candidat({ id: 'c2', ordre: 2 }),
    ];

    expect(candidats.sort(parRang).map((c) => c.ordre)).toEqual([1, 2, 3]);
  });

  it('départage deux candidats de même rang, pour un ordre stable', () => {
    const a = candidat({ id: 'aaa', ordre: 1 });
    const b = candidat({ id: 'bbb', ordre: 1 });

    expect([b, a].sort(parRang).map((c) => c.id)).toEqual(['aaa', 'bbb']);
  });
});
