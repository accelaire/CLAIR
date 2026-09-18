import { describe, it, expect } from 'vitest';
import { sommaireDeSeance, type DossierBref } from './sommaire-de-seance';

// Les cas ci-dessous reprennent des séances réelles : la séance de
// l'Assemblée du 21 juillet 2026 (414 prises, 3 annonces, 4 scrutins) et la
// journée du Sénat du même jour (317 prises, aucune annonce, 5 scrutins).

const DOSSIERS = new Map<string, DossierBref>([
  ['d-sport', { id: 'd-sport', uid: 'SENAT-ppl24-456', titre: "relative à l'organisation du sport", procedureLibelle: 'Proposition de loi' }],
  ['d-mineurs', { id: 'd-mineurs', uid: 'SENAT-ppl25-304', titre: 'visant à protéger les mineurs', procedureLibelle: 'Proposition de loi' }],
  ['d-enfance', { id: 'd-enfance', uid: 'PRJLANR5L17B1364', titre: "relatif à la protection de l'enfance", procedureLibelle: 'Projet de loi' }],
]);

const vide = { annonces: [], prises: [], scrutins: [], ordreDesVotes: new Map<string, number>(), dossiers: DOSSIERS };

describe('sommaireDeSeance — séance annoncée par la présidence', () => {
  const annonces = [
    { ordre: 6, titre: 'L’ordre du jour appelle les questions au gouvernement' },
    { ordre: 355, titre: 'L’ordre du jour appelle le vote solennel du projet de loi' },
  ];

  it('découpe la séance aux annonces et compte les prises de chaque point', () => {
    const sommaire = sommaireDeSeance({
      ...vide,
      annonces,
      prises: [
        { ordre: 1, dossierId: null },
        { ordre: 6, dossierId: null },
        { ordre: 300, dossierId: null },
        { ordre: 355, dossierId: 'd-enfance' },
        { ordre: 400, dossierId: 'd-enfance' },
      ],
    });

    expect(sommaire.map((e) => [e.cle, e.nbPrises])).toEqual([
      ['annonce:6', 3],
      ['annonce:355', 2],
    ]);
    expect(sommaire[1]!.dossiers.map((d) => d.uid)).toEqual(['PRJLANR5L17B1364']);
  });

  it("verse les formalités d'ouverture au premier point plutôt qu'à un point sans titre", () => {
    const sommaire = sommaireDeSeance({
      ...vide,
      annonces,
      prises: [{ ordre: 1, dossierId: null }, { ordre: 2, dossierId: null }],
    });
    expect(sommaire).toHaveLength(1);
    expect(sommaire[0]!.cle).toBe('annonce:6');
    expect(sommaire[0]!.nbPrises).toBe(2);
  });

  it('pose chaque vote sous le point où il est tombé', () => {
    const sommaire = sommaireDeSeance({
      ...vide,
      annonces,
      prises: [{ ordre: 6, dossierId: null }, { ordre: 360, dossierId: 'd-enfance' }],
      scrutins: [{ id: 's1', dossierId: 'd-enfance' }],
      ordreDesVotes: new Map([['s1', 360]]),
    });
    expect(sommaire.find((e) => e.cle === 'annonce:355')!.scrutins.map((s) => s.id)).toEqual(['s1']);
  });

  it('rattrape par le texte un vote dont on ignore le rang', () => {
    const sommaire = sommaireDeSeance({
      ...vide,
      annonces,
      prises: [{ ordre: 6, dossierId: null }, { ordre: 360, dossierId: 'd-enfance' }],
      scrutins: [{ id: 's1', dossierId: 'd-enfance' }],
    });
    expect(sommaire.find((e) => e.cle === 'annonce:355')!.scrutins.map((s) => s.id)).toEqual(['s1']);
  });

  it("liste à part, plutôt qu'au hasard, un vote qu'aucun point ne réclame", () => {
    const sommaire = sommaireDeSeance({
      ...vide,
      annonces,
      prises: [{ ordre: 6, dossierId: null }],
      scrutins: [{ id: 's1', dossierId: null }],
    });
    const dernier = sommaire[sommaire.length - 1]!;
    expect(dernier.cle).toBe('autres');
    expect(dernier.source).toBe('autres');
    expect(dernier.scrutins.map((s) => s.id)).toEqual(['s1']);
  });

  it("n'annonce « Autres votes » que s'il y en a d'autres", () => {
    const orphelin = { id: 's1', dossierId: null };
    const seul = sommaireDeSeance({
      ...vide,
      annonces,
      prises: [{ ordre: 6, dossierId: null }],
      scrutins: [orphelin],
    });
    expect(seul[seul.length - 1]!.titre).toBe('Votes de la séance');

    const accompagne = sommaireDeSeance({
      ...vide,
      annonces,
      prises: [{ ordre: 6, dossierId: null }, { ordre: 360, dossierId: null }],
      scrutins: [{ id: 's2', dossierId: null }, orphelin],
      ordreDesVotes: new Map([['s2', 360]]),
    });
    expect(accompagne[accompagne.length - 1]!.titre).toBe('Autres votes');
  });
});

describe('sommaireDeSeance — séance sans annonce (Sénat)', () => {
  it('reconstitue un point par texte mis aux voix, dans l’ordre des scrutins', () => {
    const sommaire = sommaireDeSeance({
      ...vide,
      prises: [{ ordre: 1, dossierId: null }, { ordre: 2, dossierId: null }],
      scrutins: [
        { id: 's1', dossierId: 'd-sport' },
        { id: 's2', dossierId: 'd-mineurs' },
      ],
    });
    expect(sommaire.map((e) => [e.cle, e.source, e.scrutins.map((s) => s.id)])).toEqual([
      ['dossier:SENAT-ppl24-456', 'dossier', ['s1']],
      ['dossier:SENAT-ppl25-304', 'dossier', ['s2']],
    ]);
  });

  it('ne prétend pas compter les prises de parole d’un passage qu’il n’a pas délimité', () => {
    const sommaire = sommaireDeSeance({
      ...vide,
      prises: [{ ordre: 1, dossierId: 'd-sport' }],
      scrutins: [{ id: 's1', dossierId: 'd-sport' }],
    });
    expect(sommaire[0]!.nbPrises).toBeNull();
  });

  it('suit le débat quand une prise de parole nomme le texte avant son vote', () => {
    const sommaire = sommaireDeSeance({
      ...vide,
      prises: [
        { ordre: 10, dossierId: 'd-mineurs' },
        { ordre: 20, dossierId: 'd-sport' },
      ],
      scrutins: [
        { id: 's1', dossierId: 'd-sport' },
        { id: 's2', dossierId: 'd-mineurs' },
      ],
    });
    expect(sommaire.map((e) => e.cle)).toEqual([
      'dossier:SENAT-ppl25-304',
      'dossier:SENAT-ppl24-456',
    ]);
  });

  it('ignore un texte qu’on ne sait pas nommer plutôt que d’afficher une ligne vide', () => {
    const sommaire = sommaireDeSeance({
      ...vide,
      prises: [{ ordre: 1, dossierId: 'inconnu' }],
      scrutins: [],
    });
    expect(sommaire).toEqual([]);
  });
});

describe('sommaireDeSeance — séance sans matière', () => {
  it('ne rend rien plutôt qu’un sommaire vide', () => {
    expect(sommaireDeSeance(vide)).toEqual([]);
  });
});
