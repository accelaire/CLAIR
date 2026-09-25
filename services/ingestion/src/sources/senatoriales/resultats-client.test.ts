import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { controlerCirconscription, rattacherLigne, urlDeSecours } from './resultats-client';
import type { UniteConnue } from './resultats-client';
import { analyserPageCirconscription } from './resultats-parser';
import type { LigneResultat } from './resultats-parser';

const FIXTURES = path.join(__dirname, '__fixtures__', 'resultats-2023');
const lire = (fichier: string) => readFileSync(path.join(FIXTURES, fichier), 'utf-8');

const ligne = (surcharge: Partial<LigneResultat>): LigneResultat => ({
  libelle: '',
  civilite: null,
  nuance: null,
  numeroDepot: null,
  voix: 0,
  pctInscrits: null,
  pctExprimes: null,
  sieges: null,
  elu: null,
  ...surcharge,
});

const liste = (numeroDepot: number, libelle: string, nuance = 'LDVD'): UniteConnue => ({
  sourceUid: `senatoriales-2026:38:p:d${numeroDepot}`,
  modeScrutin: 'proportionnel',
  numeroDepot,
  libelle,
  nuance,
  titulaire: null,
});

const binome = (numeroDepot: number, prenom: string, nom: string): UniteConnue => ({
  sourceUid: `senatoriales-2026:61:m:d${numeroDepot}`,
  modeScrutin: 'majoritaire',
  numeroDepot,
  libelle: null,
  nuance: 'DVD',
  titulaire: { prenom, nom },
});

describe('rattacherLigne', () => {
  const listes = [liste(1, "L'Isère au Sénat 2023"), liste(10, '(Re)donnons des couleurs au Sénat', 'LUG')];

  it('rattache une liste par son libellé exact, à accents et casse près', () => {
    expect(rattacherLigne(ligne({ libelle: "L'ISERE AU SENAT 2023" }), listes)?.numeroDepot).toBe(1);
  });

  it('préfère le libellé au numéro de dépôt quand les deux se contredisent', () => {
    // Une numérotation différente entre les deux sites ne doit pas déplacer des voix.
    expect(
      rattacherLigne(ligne({ numeroDepot: 10, libelle: "L'Isère au Sénat 2023", nuance: 'LDVD' }), listes)?.numeroDepot
    ).toBe(1);
  });

  it('se rabat sur le numéro de dépôt si le libellé a été réécrit, à condition que la nuance concorde', () => {
    expect(rattacherLigne(ligne({ numeroDepot: 10, libelle: 'Libellé réécrit', nuance: 'LUG' }), listes)?.numeroDepot).toBe(10);
    expect(rattacherLigne(ligne({ numeroDepot: 10, libelle: 'Libellé réécrit', nuance: 'LDVD' }), listes)).toBeNull();
  });

  const binomes = [
    binome(1, 'Nathalie', 'GOULET'),
    binome(2, 'Anne-Marie', 'NÉDÉLEC'),
    binome(3, 'Pierre Jean', 'ROCHETTE'),
    binome(4, 'Paul', 'MARTIN'),
    binome(5, 'Pierre', 'MARTIN'),
  ];

  it('rattache un candidat par prénom et nom, à tirets et accents près', () => {
    expect(rattacherLigne(ligne({ libelle: 'Anne Marie NEDELEC' }), binomes)?.numeroDepot).toBe(2);
    expect(rattacherLigne(ligne({ libelle: 'Pierre-Jean ROCHETTE' }), binomes)?.numeroDepot).toBe(3);
  });

  it('accepte un prénom d\'usage si le nom est unique dans la circonscription', () => {
    expect(rattacherLigne(ligne({ libelle: 'Nathalie-Anne GOULET' }), binomes)?.numeroDepot).toBe(1);
  });

  it('refuse de choisir entre deux homonymes', () => {
    expect(rattacherLigne(ligne({ libelle: 'Jacques MARTIN' }), binomes)).toBeNull();
    expect(rattacherLigne(ligne({ libelle: 'Paul MARTIN' }), binomes)?.numeroDepot).toBe(4);
  });
});

describe('controlerCirconscription', () => {
  it('accepte les pages réelles de 2023', () => {
    expect(controlerCirconscription(analyserPageCirconscription(lire('isere-proportionnel.html')), 'proportionnel', 5)).toEqual([]);
    expect(controlerCirconscription(analyserPageCirconscription(lire('orne-majoritaire.html')), 'majoritaire', 2)).toEqual([]);
  });

  it('refuse une page qui n\'attribue pas les sièges attendus', () => {
    const anomalies = controlerCirconscription(analyserPageCirconscription(lire('isere-proportionnel.html')), 'proportionnel', 6);
    expect(anomalies.join(' ')).toMatch(/5 sièges attribués pour 6/);
  });

  it('refuse des voix qui ne font pas les exprimés au proportionnel', () => {
    const page = analyserPageCirconscription(lire('isere-proportionnel.html'));
    page.tours[0]!.lignes[0]!.voix += 1;
    expect(controlerCirconscription(page, 'proportionnel', 5).join(' ')).toMatch(/somme des voix/);
  });

  it('refuse une participation incohérente', () => {
    const page = analyserPageCirconscription(lire('orne-majoritaire.html'));
    page.tours[1]!.participation.votants -= 1;
    expect(controlerCirconscription(page, 'majoritaire', 2).join(' ')).toMatch(/votants/);
  });

  it('refuse un 2nd tour qui ne pourvoit pas tous les sièges', () => {
    const page = analyserPageCirconscription(lire('orne-majoritaire.html'));
    page.tours[1]!.lignes.forEach((l) => (l.elu = false));
    expect(controlerCirconscription(page, 'majoritaire', 2).join(' ')).toMatch(/1 élus pour 2 sièges/);
  });
});

describe('urlDeSecours', () => {
  const base = 'https://www.resultats-elections.interieur.gouv.fr/senatoriales2026/';
  it('reconstruit le chemin région/département, l\'outre-mer et l\'étranger', () => {
    expect(urlDeSecours(base, '38')).toBe(`${base}ensemble_geographique/84/38/index.html`);
    expect(urlDeSecours(base, '973')).toBe(`${base}ensemble_geographique/03/973/index.html`);
    expect(urlDeSecours(base, '987')).toBe(`${base}ensemble_geographique/987/index.html`);
    expect(urlDeSecours(base, '997')).toBe(`${base}ensemble_geographique/ZZ/index.html`);
  });
});
