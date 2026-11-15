import { describe, expect, it } from 'vitest';
import { cumulerBilans, regrouperPostes, type BilanPoste, type FonctionGouvernementale } from './gouvernements';

const poste = (
  uid: string,
  domaine: string | null,
  rang: number,
  dateDebut: string,
  dateFin: string | null,
  gouvernement: string,
  intituleCourt = domaine ?? 'Portefeuille',
  bilan: BilanPoste | null = null,
): FonctionGouvernementale => ({
  type: 'poste_ministeriel',
  uid,
  qualite: rang === 1 ? 'Premier ministre' : 'Ministre',
  intitule: intituleCourt,
  intituleCourt,
  rangProtocolaire: rang,
  domaine,
  dateDebut,
  dateFin,
  gouvernement: { uid: `PO-${gouvernement}`, slug: gouvernement.toLowerCase(), nom: gouvernement },
  membreSlug: 'sebastien-lecornu',
  bilan,
});

const comptes = (portes: number, promulgues: number) => ({
  total: portes,
  portes,
  parNature: { ordinaire: portes, ratification_ordonnance: 0, convention: 0, finances: 0, constitutionnelle: 0, organique: 0 },
  parStadePortes: { promulgue: promulgues, adopte: 0, examine: 0, depose: portes - promulgues },
});

const bilan = (portes: number, promulgues: number, an: number, senat: number): BilanPoste => ({
  textes: { chefDeFile: comptes(portes, promulgues), cosignataire: 1 },
  reponses: { assemblee: an, senat },
  premierMinistre: null,
});

// Postes de Sébastien Lecornu depuis 2022, tels qu'en prod le 13/11/2026.
const lecornu = [
  poste('PM-borne', 'defense', 30, '2022-05-21', '2024-01-09', 'Borne', 'Armées', bilan(3, 2, 40, 10)),
  poste('PM-attal', 'defense', 30, '2024-01-12', '2024-09-05', 'Attal', 'Armées', bilan(1, 0, 12, 3)),
  poste('PM-barnier', 'defense', 30, '2024-09-22', '2024-12-13', 'Barnier', 'Armées et anciens combattants', null),
  poste('PM-bayrou', 'defense', 30, '2024-12-24', '2025-09-09', 'Bayrou', 'Armées', bilan(2, 1, 20, 5)),
  poste('PM-lecornu', 'premier-ministre', 1, '2025-09-10', '2025-10-10', 'Lecornu I'),
  poste('PM-lecornu-2', 'premier-ministre', 1, '2025-10-11', null, 'Lecornu II'),
].reverse(); // l'API les donne du plus récent au plus ancien

describe('regrouperPostes', () => {
  it('fait une seule entrée des postes reconduits (même domaine, même rang, sans interruption)', () => {
    const entrees = regrouperPostes(lecornu);
    expect(entrees.map((e) => e.postes.map((p) => p.uid))).toEqual([
      ['PM-lecornu-2', 'PM-lecornu'],
      ['PM-bayrou', 'PM-barnier', 'PM-attal', 'PM-borne'],
    ]);
    const armees = entrees[1]!;
    expect(armees.dateDebut).toBe('2022-05-21');
    expect(armees.dateFin).toBe('2025-09-09');
    // Gouvernements dans l'ordre du temps, pour « Gouvernements Borne, Attal… ».
    expect(armees.gouvernements.map((g) => g.nom)).toEqual(['Borne', 'Attal', 'Barnier', 'Bayrou']);
    expect(entrees[0]!.dateFin).toBeNull();
  });

  it('ne regroupe pas un changement de domaine, de rang, ou après une longue interruption', () => {
    const entrees = regrouperPostes([
      poste('c', 'defense', 30, '2023-03-01', null, 'C'),
      poste('b', 'defense', 30, '2022-01-01', '2022-06-01', 'B'), // 273 jours d'interruption
      poste('a', 'defense', 20, '2021-01-01', '2021-12-31', 'A'), // autre rang
      poste('z', 'justice', 20, '2020-01-01', '2020-12-31', 'Z'), // autre domaine
      poste('y', null, 20, '2019-01-01', '2019-12-31', 'Y'),
    ]);
    expect(entrees.map((e) => e.postes.length)).toEqual([1, 1, 1, 1, 1]);
  });

  it('ne regroupe jamais une présidence de la République', () => {
    const presidence: FonctionGouvernementale = {
      ...poste('PRES', null, 0, '2017-05-14', null, 'X'),
      type: 'presidence',
      rangProtocolaire: null,
      gouvernement: null,
    };
    const entrees = regrouperPostes([presidence, poste('m', 'economie', 30, '2014-08-26', '2016-08-30', 'Valls II')]);
    expect(entrees).toHaveLength(2);
    expect(entrees[0]!.gouvernements).toEqual([]);
  });

  it('somme les bilans des postes regroupés, sans compter ceux qui n’en ont pas', () => {
    const armees = regrouperPostes(lecornu)[1]!;
    expect(armees.bilan?.textes?.chefDeFile.portes).toBe(6);
    expect(armees.bilan?.textes?.chefDeFile.parStadePortes.promulgue).toBe(3);
    expect(armees.bilan?.textes?.cosignataire).toBe(3);
    expect(armees.bilan?.reponses).toEqual({ assemblee: 72, senat: 18 });
    expect(regrouperPostes(lecornu)[0]!.bilan).toBeNull();
  });
});

describe('cumulerBilans', () => {
  it('rend null sans aucun bilan (postes d’avant juin 2017)', () => {
    expect(cumulerBilans([null, undefined])).toBeNull();
  });

  it('additionne les comptes de Premier ministre et met les listes bout à bout', () => {
    const pm = (engagements: number, motions: number, adoptees: number): BilanPoste => ({
      textes: null,
      reponses: { assemblee: 1, senat: 0 },
      premierMinistre: {
        engagements,
        motions,
        motionsAdoptees: adoptees,
        listeEngagements: Array.from({ length: engagements }, (_, i) => ({
          date: `2025-0${i + 1}-01`,
          dossier: { uid: `D${engagements}${i}`, titre: 'PLF' },
          texte: null,
        })),
      },
    });
    const somme = cumulerBilans([pm(2, 3, 0), pm(1, 2, 1)])!;
    expect(somme.premierMinistre).toMatchObject({ engagements: 3, motions: 5, motionsAdoptees: 1 });
    expect(somme.premierMinistre?.listeEngagements).toHaveLength(3);
    expect(somme.premierMinistre?.listeMotions).toBeUndefined();
    expect(somme.textes).toBeNull();
    expect(somme.reponses).toEqual({ assemblee: 2, senat: 0 });
  });
});
