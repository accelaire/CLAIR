import { describe, it, expect } from 'vitest';
import { choisirAmendement, type CandidatAmendement } from './amendement-scrutin';

const amdt = (
  id: string,
  articleVise: string | null,
  dossierId: string | null = null,
  uid = `AMANR5L17PO838901B2697P0D1N00000${id.length}`,
): CandidatAmendement => ({ id, articleVise, dossierId, uid });

const TITRE_8429 =
  "l'amendement n° 1 du Gouvernement de rétablissement de l'article 11 (supprimé) du projet de loi relatif à la protection des enfants (seconde délibération) (première lecture).";

describe('choisirAmendement', () => {
  it('rend le seul candidat quand il n’y a pas d’homonyme', () => {
    const seul = amdt('a', 'ART. PREMIER');
    expect(choisirAmendement([seul], TITRE_8429, null)).toBe(seul);
  });

  it('départage deux homonymes par l’article nommé dans le libellé', () => {
    const article11 = amdt('bon', 'ART. 11');
    const articlePremier = amdt('mauvais', 'ART. PREMIER');
    expect(choisirAmendement([articlePremier, article11], TITRE_8429, null)).toBe(article11);
  });

  it('ne dépend pas de l’ordre des candidats', () => {
    const article11 = amdt('bon', 'ART. 11');
    const articlePremier = amdt('mauvais', 'ART. PREMIER');
    expect(choisirAmendement([article11, articlePremier], TITRE_8429, null)).toBe(article11);
  });

  it('accepte les deux graphies du premier article', () => {
    const titre = "l'amendement n° 3 de M. X à l'article premier du projet de loi.";
    const un = amdt('bon', 'ART. 1');
    const deux = amdt('mauvais', 'ART. 2');
    expect(choisirAmendement([un, deux], titre, null)).toBe(un);
  });

  it('distingue « à l’article » de « après l’article »', () => {
    const titre = "l'amendement n° 7 de M. X après l'article 6 du projet de loi.";
    const apres = amdt('bon', 'APRÈS ART. 6');
    const sur = amdt('mauvais', 'ART. 6');
    expect(choisirAmendement([apres, sur], titre, null)).toBe(apres);
    const titreSur = "l'amendement n° 7 de M. X à l'article 6 du projet de loi.";
    expect(choisirAmendement([apres, sur], titreSur, null)).toBe(sur);
  });

  it('conserve les suffixes d’ordre', () => {
    const titre = "l'amendement n° 12 de Mme Y à l'article 5 undecies du projet de loi.";
    const undecies = amdt('bon', 'ART. 5 UNDECIES');
    const cinq = amdt('mauvais', 'ART. 5');
    expect(choisirAmendement([undecies, cinq], titre, null)).toBe(undecies);
  });

  it('écarte un candidat dont le dossier contredit celui du scrutin', () => {
    const bon = amdt('bon', 'ART. 11', 'dossier-A');
    const autreDossier = amdt('mauvais', 'ART. 11', 'dossier-B');
    expect(choisirAmendement([bon, autreDossier], TITRE_8429, 'dossier-A')).toBe(bon);
  });

  it('ne tranche pas quand le libellé ne nomme aucun article', () => {
    const titre = "l'amendement n° 8 du Gouvernement au projet de loi d'urgence.";
    expect(choisirAmendement([amdt('a', 'ART. 1'), amdt('b', 'ART. 2')], titre, null)).toBeNull();
  });

  it('ne tranche pas quand deux homonymes visent le même article', () => {
    expect(choisirAmendement([amdt('a', 'ART. 11'), amdt('b', 'ART. 11')], TITRE_8429, null)).toBeNull();
  });

  it('ne tranche pas quand aucun homonyme ne vise l’article du libellé', () => {
    expect(choisirAmendement([amdt('a', 'ART. 3'), amdt('b', 'ART. 4')], TITRE_8429, null)).toBeNull();
  });

  it('ne rend rien quand le dossier écarte tout le monde', () => {
    expect(choisirAmendement([amdt('a', 'ART. 11', 'dossier-B')], TITRE_8429, 'dossier-A')).toBeNull();
  });
});

describe('choisirAmendement — délibérations d’un même article', () => {
  const premiere = amdt('D1', 'ART. UNIQUE', null, 'AMANR5L17PO838901B2697P0D1N000003');
  const seconde = amdt('D2', 'ART. UNIQUE', null, 'AMANR5L17PO838901B2697P0D2N000003');
  const TITRE =
    "l'amendement n° 3 de la commission des lois et les amendements identiques suivants à l'article unique du projet de loi constitutionnelle pour une Corse autonome au sein de la République (première lecture).";

  it('prend la première délibération par défaut', () => {
    expect(choisirAmendement([seconde, premiere], TITRE, null)).toBe(premiere);
  });

  it('prend la seconde quand le libellé la nomme', () => {
    const titre = TITRE.replace('(première lecture)', '(seconde délibération) (première lecture)');
    expect(choisirAmendement([premiere, seconde], titre, null)).toBe(seconde);
  });

  it('ne tranche pas si aucun candidat ne porte la délibération visée', () => {
    const autreSeconde = amdt('D2bis', 'ART. UNIQUE', null, 'AMANR5L17PO838901B2697P0D2N000009');
    expect(choisirAmendement([seconde, autreSeconde], TITRE, null)).toBeNull();
  });

  it('ne tranche pas quand l’uid ne suit pas le schéma AN', () => {
    const a = amdt('x', 'ART. UNIQUE', null, 'uid-inconnu-1');
    const b = amdt('y', 'ART. UNIQUE', null, 'uid-inconnu-2');
    expect(choisirAmendement([a, b], TITRE, null)).toBeNull();
  });
});
