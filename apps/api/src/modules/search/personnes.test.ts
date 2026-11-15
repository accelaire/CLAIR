import { describe, expect, it } from 'vitest';
import { classerPersonnes, comptesParRole, meilleur, pertinenceDuNom, type Personne } from './personnes';

const personne = (prenom: string, nom: string, o: Partial<Personne> = {}): Personne => ({
  cle: `parlementaire:${prenom}-${nom}`.toLowerCase(),
  prenom,
  nom,
  sexe: null,
  photoUrl: null,
  enFonction: true,
  parlementaire: null,
  gouvernement: null,
  roles: ['deputes'],
  ...o,
});

const ancien = (prenom: string, nom: string, fin: string) =>
  personne(prenom, nom, {
    enFonction: false,
    parlementaire: {
      slug: `${prenom}-${nom}`.toLowerCase(),
      chambre: 'assemblee',
      actif: false,
      groupe: null,
      circonscription: null,
      dernierMandat: { chambre: 'assemblee', legislature: 16, mandature: null, dateFin: new Date(`${fin}T00:00:00Z`) },
    },
  });

describe('pertinenceDuNom', () => {
  const lecornu = { prenom: 'Sébastien', nom: 'Lecornu' };
  it('distingue nom complet, nom, début du nom et le reste', () => {
    expect(pertinenceDuNom(lecornu, 'sebastien lecornu')).toBe(3);
    expect(pertinenceDuNom(lecornu, 'Lecornu Sébastien')).toBe(3);
    expect(pertinenceDuNom(lecornu, 'LECORNU')).toBe(2);
    expect(pertinenceDuNom(lecornu, 'lecor')).toBe(1);
    expect(pertinenceDuNom(lecornu, 'eure')).toBe(0);
  });

  it('lit les noms composés sans tenir aux tirets', () => {
    expect(pertinenceDuNom({ prenom: 'Agnès', nom: 'Pannier-Runacher' }, 'pannier runacher')).toBe(2);
  });
});

describe('classerPersonnes', () => {
  it('le nom exact, puis en fonction, puis les anciens partis le plus récemment', () => {
    const ordre = classerPersonnes(
      [
        ancien('Paul', 'Martinez', '2017-06-20'),
        personne('Alice', 'Martin'),
        ancien('Jean', 'Martin', '2022-06-21'),
        personne('Bruno', 'Martinet'),
        ancien('Zoé', 'Martineau', '2024-06-09'),
      ],
      'martin',
    ).map((p) => `${p.prenom} ${p.nom}`);
    expect(ordre).toEqual(['Alice Martin', 'Jean Martin', 'Bruno Martinet', 'Zoé Martineau', 'Paul Martinez']);
  });
});

describe('meilleur', () => {
  const resultat = (personnes: Array<Personne & { pertinence: number }>, approximatif = false) => ({ personnes, approximatif });
  const gouvernements = [
    { nom: 'Borne', slug: 'borne' },
    { nom: 'Lecornu I', slug: 'lecornu' },
    { nom: 'Lecornu II', slug: 'lecornu-2' },
  ];

  it('retient la seule personne au nom exact', () => {
    const r = resultat([{ ...personne('Sébastien', 'Lecornu'), pertinence: 2 }]);
    expect(meilleur(r, gouvernements, 'lecornu', true)).toEqual({ categorie: 'personnes', cle: 'parlementaire:sébastien-lecornu' });
  });

  it('préfère le gouvernement quand la recherche le nomme', () => {
    const r = resultat([{ ...personne('Élisabeth', 'Borne'), pertinence: 2 }]);
    expect(meilleur(r, gouvernements, 'gouvernement Borne', true)).toEqual({ categorie: 'gouvernements', cle: 'borne' });
    expect(meilleur(r, gouvernements, 'borne', true)?.categorie).toBe('personnes');
    expect(meilleur(resultat([]), gouvernements, 'lecornu 2', true)).toEqual({ categorie: 'gouvernements', cle: 'lecornu-2' });
  });

  it('ne tranche pas entre deux homonymes, ni sur des noms approchants', () => {
    const deux = resultat([
      { ...personne('Jean', 'Martin'), pertinence: 2 },
      { ...personne('Alice', 'Martin'), pertinence: 2 },
    ]);
    expect(meilleur(deux, gouvernements, 'martin', true)).toBeNull();
    expect(meilleur(resultat([{ ...personne('Sébastien', 'Lecornu'), pertinence: 0 }], true), gouvernements, 'lekornu', false)).toBeNull();
  });
});

describe('comptesParRole', () => {
  it('compte une personne dans chacun de ses rôles', () => {
    expect(comptesParRole([personne('Sébastien', 'Lecornu', { roles: ['senateurs', 'gouvernement'] }), personne('A', 'B')])).toEqual({
      deputes: 1,
      senateurs: 1,
      gouvernement: 1,
    });
  });
});
