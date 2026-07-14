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
  deriveMandatureSenat,
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
