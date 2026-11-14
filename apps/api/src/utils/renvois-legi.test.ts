// =============================================================================
// Tests — renvois au droit en vigueur dans le dispositif des amendements
// =============================================================================

import { describe, it, expect } from 'vitest';
import { avecRenvois, renvoisDuDispositif, urlLegifrance } from './renvois-legi';

const DISPOSITIF = 'L’article L. 242‑1 du code de la sécurité sociale est ainsi modifié :';
const DEPOT = new Date('2024-10-13T00:00:00.000Z');
// Tel que l'ingestion l'écrit (amendement AN 17e, CSS).
const ARTICLE_CSS = {
  debut: 0, fin: 50, type: 'article', article: 'LEGIARTI000051218352',
  cid: 'LEGITEXT000006073189', nature: 'CODE',
};

describe('urlLegifrance', () => {
  it('article de code : chemin des codes, version en vigueur au dépôt', () => {
    // Sans la date, Légifrance montre la version d'aujourd'hui (793 bis CGI : 600 000 € au lieu de 300 000 €).
    expect(urlLegifrance({ type: 'article', article: 'LEGIARTI000046868402', cid: 'LEGITEXT000006069577', nature: 'CODE' }, DEPOT))
      .toBe('https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046868402/2024-10-13');
  });

  it('article d’une loi, de la Constitution : chemin des textes non codifiés', () => {
    expect(urlLegifrance({ type: 'article', article: 'LEGIARTI000006527594', cid: 'JORFTEXT000000571356', nature: 'CONSTITUTION' }, DEPOT))
      .toBe('https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006527594/2024-10-13');
    expect(urlLegifrance({ type: 'article', article: 'LEGIARTI000048697305', cid: 'JORFTEXT000000169492', nature: null }, DEPOT))
      .toBe('https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000048697305/2024-10-13');
  });

  it('texte : code par son LEGITEXT, autre texte par son identifiant', () => {
    expect(urlLegifrance({ type: 'texte', cid: 'LEGITEXT000006074096', nature: 'CODE' }, DEPOT))
      .toBe('https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006074096/2024-10-13');
    expect(urlLegifrance({ type: 'texte', cid: 'JORFTEXT000000877119', nature: 'LOI' }, DEPOT))
      .toBe('https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000877119/2024-10-13');
    expect(urlLegifrance({ type: 'texte', cid: 'LEGITEXT000006070933', nature: 'DECRET' }, DEPOT))
      .toBe('https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006070933/2024-10-13');
  });

  it('sans date de dépôt : version d’aujourd’hui', () => {
    expect(urlLegifrance({ type: 'texte', cid: 'JORFTEXT000000877119', nature: 'LOI' }, null))
      .toBe('https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000877119');
  });

  it('identifiant inattendu : pas de lien', () => {
    expect(urlLegifrance({ type: 'article', cid: 'LEGITEXT000006073189', nature: 'CODE' }, DEPOT)).toBeNull();
    expect(urlLegifrance({ type: 'article', article: 'LEGIARTI0000/../x', cid: 'LEGITEXT000006073189', nature: 'CODE' }, DEPOT)).toBeNull();
    expect(urlLegifrance({ type: 'texte', cid: 'CELEX32016R0679', nature: null }, DEPOT)).toBeNull();
  });
});

describe('renvoisDuDispositif', () => {
  it('sert les renvois avec leur adresse, dans l’ordre du texte', () => {
    const texte = { debut: 30, fin: 50, type: 'texte', cid: 'LEGITEXT000006073189', nature: 'CODE' };
    const article = { ...ARTICLE_CSS, fin: 18 };
    const renvois = renvoisDuDispositif(DISPOSITIF, DEPOT, [texte, article]);
    expect(renvois).toEqual([
      {
        debut: 0, fin: 18, type: 'article', article: 'LEGIARTI000051218352', texte: 'LEGITEXT000006073189',
        nature: 'CODE', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051218352/2024-10-13',
      },
      {
        debut: 30, fin: 50, type: 'texte', article: null, texte: 'LEGITEXT000006073189',
        nature: 'CODE', url: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006073189/2024-10-13',
      },
    ]);
  });

  it('écarte un renvoi qui dépasse le dispositif (texte raccourci depuis le calcul)', () => {
    expect(renvoisDuDispositif(DISPOSITIF, DEPOT, [{ ...ARTICLE_CSS, fin: DISPOSITIF.length + 1 }])).toEqual([]);
    expect(renvoisDuDispositif(DISPOSITIF, DEPOT, [{ ...ARTICLE_CSS, fin: DISPOSITIF.length }])).toHaveLength(1);
  });

  it('dispositif effacé depuis le calcul : aucun renvoi', () => {
    expect(renvoisDuDispositif(null, DEPOT, [ARTICLE_CSS])).toEqual([]);
  });

  it('écarte les chevauchements, les positions vides et les lignes mal formées', () => {
    const renvois = renvoisDuDispositif(DISPOSITIF, DEPOT, [
      ARTICLE_CSS,
      { ...ARTICLE_CSS, debut: 10, fin: 20 },
      { ...ARTICLE_CSS, debut: 55, fin: 55 },
      { ...ARTICLE_CSS, debut: -1 },
      { debut: '0', fin: 3, type: 'article', cid: 'x' },
      null,
    ]);
    expect(renvois.map((r) => [r.debut, r.fin])).toEqual([[0, 50]]);
  });

  it('JSON inattendu : aucun renvoi', () => {
    expect(renvoisDuDispositif(DISPOSITIF, DEPOT, { renvois: [] })).toEqual([]);
    expect(renvoisDuDispositif(DISPOSITIF, DEPOT, undefined)).toEqual([]);
  });
});

describe('avecRenvois', () => {
  const modifie = new Date('2026-11-11T04:20:00Z');
  const calcule = new Date('2026-11-11T05:10:00Z');

  it('remplace la relation par les renvois servis, sans la date de modification', () => {
    const a = avecRenvois({
      id: 'a', dispositif: DISPOSITIF, dateDepot: DEPOT, updatedAt: modifie,
      renvoisLegi: { renvois: [ARTICLE_CSS], calculeLe: calcule },
    });
    expect(a).not.toHaveProperty('renvoisLegi');
    expect(a).not.toHaveProperty('updatedAt');
    expect(a.dateDepot).toBe(DEPOT);
    expect(a.renvois).toHaveLength(1);
    expect(a.renvois[0]!.url).toMatch(/\/2024-10-13$/);
  });

  it('calcul antérieur à la dernière modification de l’amendement : rien n’est servi', () => {
    const a = avecRenvois({
      id: 'a', dispositif: DISPOSITIF, dateDepot: DEPOT, updatedAt: calcule,
      renvoisLegi: { renvois: [ARTICLE_CSS], calculeLe: modifie },
    });
    expect(a.renvois).toEqual([]);
  });

  it('amendement jamais calculé : tableau vide', () => {
    expect(avecRenvois({ id: 'a', dispositif: DISPOSITIF, dateDepot: DEPOT, updatedAt: modifie, renvoisLegi: null }).renvois)
      .toEqual([]);
  });
});
