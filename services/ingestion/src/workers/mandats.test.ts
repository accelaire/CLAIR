// =============================================================================
// Tests — dérivation des mandats (multi-législatures AN / multi-mandatures Sénat)
// Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
//
// Le cœur du sujet : le renouvellement sénatorial du 27 sept. 2026 (série 2) ne
// doit JAMAIS écraser le mandat 2020 d'un sénateur réélu.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  deriveMandatContextAN,
  deriveMandatContextSenat,
  deriveMandatContextSenatOdsen,
  deriveMandatureSenat,
  inferSerieSenatDepuisDate,
  senatMandatFinTheorique,
  senatMandatureDebut,
  isLegislatureCourante,
} from './mandats';

describe('Sénat — calendrier des renouvellements', () => {
  it('place la prise de fonction au 1er octobre', () => {
    expect(senatMandatureDebut(2026).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('clôt un mandat à la veille du renouvellement suivant de sa série (6 ans)', () => {
    // Mandat ouvert en 2020 → fin de droit le 30 sept. 2026 (veille du 1er oct. 2026).
    expect(senatMandatFinTheorique(2020).toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(senatMandatFinTheorique(2023).toISOString()).toBe('2029-09-30T00:00:00.000Z');
  });
});

describe('deriveMandatureSenat', () => {
  it("dérive la mandature courante de chaque série à aujourd'hui", () => {
    const aujourdhui = new Date('2026-07-14T00:00:00Z');
    expect(deriveMandatureSenat('1', aujourdhui)).toBe(2023);
    expect(deriveMandatureSenat('2', aujourdhui)).toBe(2020);
  });

  it('ne bascule PAS la série 2 avant la prise de fonction du 1er oct. 2026', () => {
    expect(deriveMandatureSenat('2', new Date('2026-09-30T23:59:59Z'))).toBe(2020);
  });

  it('bascule la série 2 sur la mandature 2026 dès la prise de fonction', () => {
    expect(deriveMandatureSenat('2', new Date('2026-10-01T00:00:00Z'))).toBe(2026);
    expect(deriveMandatureSenat('2', new Date('2026-10-02T00:00:00Z'))).toBe(2026);
  });

  it("laisse la série 1 intacte au renouvellement de la série 2 (renouvellement par moitiés)", () => {
    expect(deriveMandatureSenat('1', new Date('2026-10-02T00:00:00Z'))).toBe(2023);
  });

  it('gère le renouvellement suivant de la série 1 (2029)', () => {
    expect(deriveMandatureSenat('1', new Date('2029-10-02T00:00:00Z'))).toBe(2029);
    expect(deriveMandatureSenat('2', new Date('2029-10-02T00:00:00Z'))).toBe(2026);
  });

  it('recule correctement sur une date antérieure à l’ancre', () => {
    expect(deriveMandatureSenat('1', new Date('2018-01-01T00:00:00Z'))).toBe(2017);
    expect(deriveMandatureSenat('2', new Date('2018-01-01T00:00:00Z'))).toBe(2014);
  });

  it('renvoie null pour la série 3 (héritage pré-2011) et pour une série absente', () => {
    expect(deriveMandatureSenat('3', new Date('2026-07-14T00:00:00Z'))).toBeNull();
    expect(deriveMandatureSenat(null)).toBeNull();
  });
});

describe('deriveMandatContextSenat', () => {
  it('ouvre le mandat courant (dateFin null) et le date au 1er octobre de la mandature', () => {
    const ctx = deriveMandatContextSenat('2', new Date('2026-07-14T00:00:00Z'));
    expect(ctx).toMatchObject({ legislature: null, mandature: 2020, serie: '2', dateFin: null });
    expect(ctx.dateDebut.toISOString()).toBe('2020-10-01T00:00:00.000Z');
  });

  it('produit une mandature DIFFÉRENTE après le renouvellement 2026 → nouveau mandat, pas un écrasement', () => {
    const avant = deriveMandatContextSenat('2', new Date('2026-09-01T00:00:00Z'));
    const apres = deriveMandatContextSenat('2', new Date('2026-10-02T00:00:00Z'));

    // Clé naturelle du mandat = [personne, chambre, legislature, mandature].
    // La mandature change → l'upsert créera une NOUVELLE ligne au lieu d'écraser.
    expect(avant.mandature).toBe(2020);
    expect(apres.mandature).toBe(2026);
    expect(apres.mandature).not.toBe(avant.mandature);
    expect(apres.dateDebut.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('inferSerieSenatDepuisDate (anciens sénateurs, série absente de la source)', () => {
  it('infère la série d’un mandat plein (prise de fonction 1er-3 octobre d’un renouvellement)', () => {
    expect(inferSerieSenatDepuisDate(new Date('2017-10-01T00:00:00Z'))).toBe('1');
    expect(inferSerieSenatDepuisDate(new Date('2017-10-02T00:00:00Z'))).toBe('1'); // 1re séance le 2 oct.
    expect(inferSerieSenatDepuisDate(new Date('2023-10-01T00:00:00Z'))).toBe('1');
    expect(inferSerieSenatDepuisDate(new Date('2020-10-01T00:00:00Z'))).toBe('2');
    expect(inferSerieSenatDepuisDate(new Date('2014-10-01T00:00:00Z'))).toBe('2');
  });

  it('renvoie null pour un début qui n’est pas une prise de fonction de renouvellement', () => {
    expect(inferSerieSenatDepuisDate(new Date('2019-03-15T00:00:00Z'))).toBeNull(); // remplacement
    expect(inferSerieSenatDepuisDate(new Date('2017-10-20T00:00:00Z'))).toBeNull(); // trop tard en oct.
    expect(inferSerieSenatDepuisDate(new Date('2018-10-01T00:00:00Z'))).toBeNull(); // pas une année de renouvellement
  });
});

describe('deriveMandatContextSenatOdsen (dates réelles ODSEN + correction fraîcheur ELUSEN)', () => {
  const maintenant = new Date('2026-07-14T00:00:00Z');

  it('conserve une date de fin réelle telle quelle', () => {
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2014-10-01T00:00:00Z'), dateFin: new Date('2020-09-30T00:00:00Z'), serie: '2' },
      maintenant,
    );
    expect(ctx).toMatchObject({ legislature: null, mandature: 2014, serie: '2' });
    expect(ctx.dateFin?.toISOString()).toBe('2020-09-30T00:00:00.000Z');
  });

  it('normalise une fin tombant sur un renouvellement (1er oct.) à la veille (30 sept.)', () => {
    // Convention Sénat : la fin réelle du sortant = la prise de fonction de l'entrant.
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2017-10-01T00:00:00Z'), dateFin: new Date('2023-10-01T00:00:00Z'), serie: '1' },
      maintenant,
    );
    expect(ctx.dateFin?.toISOString()).toBe('2023-09-30T00:00:00.000Z');
  });

  it('CLÔT un mandat série 1 « ouvert » périmé (export figé avant sept. 2023) à sa fin de droit', () => {
    // ELUSEN montre le mandat 2017 encore ouvert ; il s'est en réalité terminé le 30 sept. 2023.
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2017-10-01T00:00:00Z'), dateFin: null, serie: '1' },
      maintenant,
    );
    expect(ctx.mandature).toBe(2017);
    expect(ctx.dateFin?.toISOString()).toBe('2023-09-30T00:00:00.000Z');
  });

  it('laisse ouvert le mandat de la mandature COURANTE (série 2, 2020)', () => {
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2020-10-01T00:00:00Z'), dateFin: null, serie: '2' },
      maintenant,
    );
    expect(ctx.mandature).toBe(2020);
    expect(ctx.dateFin).toBeNull();
  });

  it('série inconnue : mandature stable via le renouvellement série-indépendant (pas l’année brute)', () => {
    // Remplacement au 1er oct. 2021 (hors année de renouvellement) → cohorte 2020, PAS 2021.
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2021-10-01T00:00:00Z'), dateFin: new Date('2024-08-16T00:00:00Z'), serie: null },
      maintenant,
    );
    expect(ctx.mandature).toBe(2020);
  });

  it('rattache un remplacement en cours de mandat à sa cohorte (renouvellement précédent)', () => {
    // Remplacement démarré le 15 mars 2019 → cohorte (mandature) 2017, date réelle conservée.
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2019-03-15T00:00:00Z'), dateFin: new Date('2023-09-30T00:00:00Z'), serie: '1' },
      maintenant,
    );
    expect(ctx.mandature).toBe(2017);
    expect(ctx.dateDebut.toISOString()).toBe('2019-03-15T00:00:00.000Z'); // date RÉELLE conservée
  });

  it('série inconnue : mandature = année de début et mandat ouvert clos à sa fin de droit', () => {
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2017-10-01T00:00:00Z'), dateFin: null, serie: null },
      maintenant,
    );
    expect(ctx.mandature).toBe(2017);
    expect(ctx.dateFin?.toISOString()).toBe('2023-09-30T00:00:00.000Z');
  });
});

describe('AN — législatures (non-régression)', () => {
  it('dérive les bornes des législatures', () => {
    expect(deriveMandatContextAN(17)).toMatchObject({ legislature: 17, mandature: null, dateFin: null });
    expect(deriveMandatContextAN(16).dateFin?.toISOString()).toBe('2024-06-09T00:00:00.000Z');
  });

  it('identifie la législature courante', () => {
    expect(isLegislatureCourante(17)).toBe(true);
    expect(isLegislatureCourante(16)).toBe(false);
  });
});
