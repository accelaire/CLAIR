// =============================================================================
// Tests unitaires - parseActesLegislatifs
// =============================================================================

import { describe, it, expect } from 'vitest';
import { parseActesLegislatifs, LegislativeStep } from './parse-actes-legislatifs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Cas "1er mai" : SN1 adoptée → AN1 rejetée → SN2 active (navette en cours) */
const FIXTURE_1ER_MAI = {
  actesLegislatifs: {
    acteLegislatif: [
      {
        uid: 'L17-SN1-51987',
        codeActe: 'SN1',
        dateActe: null,
        libelleActe: { libelleCourt: '1ère lecture' },
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'depot1',
              codeActe: 'SN1-DEPOT',
              dateActe: '2025-04-25T00:00:00.000+02:00',
              libelleActe: { libelleCourt: "1er dépôt d'une initiative." },
            },
            {
              uid: 'debats1',
              codeActe: 'SN1-DEBATS',
              dateActe: null,
              actesLegislatifs: {
                acteLegislatif: [
                  {
                    uid: 'dec1',
                    codeActe: 'SN1-DEBATS-DEC',
                    dateActe: '2025-07-03T00:00:00.000+02:00',
                    statutConclusion: { fam_code: 'TSORTF01', libelle: 'adoptée' },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        uid: 'L17-AN1-51987',
        codeActe: 'AN1',
        dateActe: null,
        libelleActe: { libelleCourt: '1ère lecture' },
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'debats2',
              codeActe: 'AN1-DEBATS',
              dateActe: null,
              actesLegislatifs: {
                // Objet unique (non tableau) — teste la normalisation
                acteLegislatif: {
                  uid: 'dec2',
                  codeActe: 'AN1-DEBATS-DEC',
                  dateActe: '2026-04-10T00:00:00.000+02:00',
                  statutConclusion: { fam_code: 'TSORTF07', libelle: 'rejetée' },
                },
              },
            },
          ],
        },
      },
      {
        uid: 'L17-SN2-51987',
        codeActe: 'SN2',
        dateActe: null,
        libelleActe: { libelleCourt: '2ème lecture' },
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'depot3',
              codeActe: 'SN2-DEPOT',
              dateActe: '2026-04-10T00:00:00.000+02:00',
              libelleActe: { libelleCourt: "Dépôt d'une initiative en navette" },
            },
            {
              uid: 'com3',
              codeActe: 'SN2-COM',
              dateActe: null,
              libelleActe: { libelleCourt: 'Travaux des commissions' },
            },
          ],
        },
      },
    ],
  },
};

/** Loi simple : AN1 adoptée conforme → PROM */
const FIXTURE_LOI_SIMPLE = {
  actesLegislatifs: {
    acteLegislatif: [
      {
        uid: 'AN1-simple',
        codeActe: 'AN1',
        dateActe: null,
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'depot-simple',
              codeActe: 'AN1-DEPOT',
              dateActe: '2024-01-10T00:00:00.000+01:00',
            },
            {
              uid: 'debats-simple',
              codeActe: 'AN1-DEBATS',
              dateActe: null,
              actesLegislatifs: {
                acteLegislatif: [
                  {
                    uid: 'dec-simple',
                    codeActe: 'AN1-DEBATS-DEC',
                    dateActe: '2024-02-15T00:00:00.000+01:00',
                    statutConclusion: { fam_code: 'TSORTF03', libelle: 'adoptée conforme' },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        uid: 'PROM-simple',
        codeActe: 'PROM',
        dateActe: '2024-03-01T00:00:00.000+01:00',
      },
    ],
  },
};

/** CMP accord : SN1 → AN1 → CMP accord → PROM */
const FIXTURE_CMP_ACCORD = {
  actesLegislatifs: {
    acteLegislatif: [
      {
        uid: 'SN1-cmp',
        codeActe: 'SN1',
        dateActe: null,
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'depot-cmp',
              codeActe: 'SN1-DEPOT',
              dateActe: '2024-03-01T00:00:00.000+01:00',
            },
            {
              uid: 'debats-sn1-cmp',
              codeActe: 'SN1-DEBATS',
              dateActe: null,
              actesLegislatifs: {
                acteLegislatif: [
                  {
                    uid: 'dec-sn1-cmp',
                    codeActe: 'SN1-DEBATS-DEC',
                    dateActe: '2024-04-10T00:00:00.000+02:00',
                    statutConclusion: { fam_code: 'TSORTF02', libelle: 'adoptée avec modifications' },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        uid: 'AN1-cmp',
        codeActe: 'AN1',
        dateActe: null,
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'debats-an1-cmp',
              codeActe: 'AN1-DEBATS',
              dateActe: null,
              actesLegislatifs: {
                acteLegislatif: [
                  {
                    uid: 'dec-an1-cmp',
                    codeActe: 'AN1-DEBATS-DEC',
                    dateActe: '2024-05-20T00:00:00.000+02:00',
                    statutConclusion: { fam_code: 'TSORTF02', libelle: 'adoptée avec modifications' },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        uid: 'CMP-accord',
        codeActe: 'CMP',
        dateActe: null,
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'cmp-dec',
              codeActe: 'CMP-DEC',
              dateActe: '2024-06-05T00:00:00.000+02:00',
              statutConclusion: { fam_code: 'TCCMP01', libelle: 'accord' },
            },
          ],
        },
      },
      {
        uid: 'PROM-cmp',
        codeActe: 'PROM',
        dateActe: '2024-07-14T00:00:00.000+02:00',
      },
    ],
  },
};

/** Lecture unique ANLUNI rejetée en commission (TMRC01) */
const FIXTURE_ANLUNI_REJET_COMMISSION = {
  actesLegislatifs: {
    acteLegislatif: [
      {
        uid: 'ANLUNI-rejet',
        codeActe: 'ANLUNI',
        dateActe: null,
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'depot-anluni',
              codeActe: 'ANLUNI-DEPOT',
              dateActe: '2024-09-01T00:00:00.000+02:00',
            },
            {
              uid: 'com-cae-dec',
              codeActe: 'ANLUNI-COM-CAE-DEC',
              dateActe: '2024-10-15T00:00:00.000+02:00',
              statutConclusion: { fam_code: 'TMRC01', libelle: 'rejet en commission' },
            },
          ],
        },
      },
    ],
  },
};

/** Un seul acteLegislatif (objet, pas tableau) au niveau racine */
const FIXTURE_SINGLE_ACTE = {
  actesLegislatifs: {
    // Objet unique au lieu d'un tableau
    acteLegislatif: {
      uid: 'AN1-single',
      codeActe: 'AN1',
      dateActe: null,
      actesLegislatifs: {
        acteLegislatif: [
          {
            uid: 'depot-single',
            codeActe: 'AN1-DEPOT',
            dateActe: '2024-11-01T00:00:00.000+01:00',
          },
          {
            uid: 'debats-single',
            codeActe: 'AN1-DEBATS',
            dateActe: null,
            actesLegislatifs: {
              acteLegislatif: [
                {
                  uid: 'dec-single',
                  codeActe: 'AN1-DEBATS-DEC',
                  dateActe: '2024-11-20T00:00:00.000+01:00',
                  statutConclusion: { fam_code: 'TSORTF01', libelle: 'adoptée' },
                },
              ],
            },
          },
        ],
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseActesLegislatifs', () => {
  describe('entrées invalides', () => {
    it('devrait retourner [] pour null', () => {
      expect(parseActesLegislatifs(null)).toEqual([]);
    });

    it('devrait retourner [] pour undefined', () => {
      expect(parseActesLegislatifs(undefined)).toEqual([]);
    });

    it('devrait retourner [] pour une chaîne vide', () => {
      expect(parseActesLegislatifs('')).toEqual([]);
    });

    it('devrait retourner [] pour un nombre', () => {
      expect(parseActesLegislatifs(42)).toEqual([]);
    });

    it('devrait retourner [] pour un objet sans actesLegislatifs', () => {
      expect(parseActesLegislatifs({})).toEqual([]);
    });

    it('devrait retourner [] pour actesLegislatifs vide', () => {
      expect(parseActesLegislatifs({ actesLegislatifs: {} })).toEqual([]);
    });

    it('devrait retourner [] pour acteLegislatif null', () => {
      expect(
        parseActesLegislatifs({ actesLegislatifs: { acteLegislatif: null } }),
      ).toEqual([]);
    });

    it('devrait retourner [] pour acteLegislatif tableau vide', () => {
      expect(
        parseActesLegislatifs({ actesLegislatifs: { acteLegislatif: [] } }),
      ).toEqual([]);
    });
  });

  describe('cas 1er mai (navette : SN1 → AN1 rejetée → SN2 active)', () => {
    let steps: LegislativeStep[];

    it('devrait retourner exactement 5 étapes (avec PROM pending prospectif)', () => {
      steps = parseActesLegislatifs(FIXTURE_1ER_MAI);
      expect(steps).toHaveLength(5);
    });

    it('première étape : Dépôt (done, senat)', () => {
      steps = parseActesLegislatifs(FIXTURE_1ER_MAI);
      const depot = steps[0]!;
      expect(depot.code).toBe('DEPOT');
      expect(depot.label).toBe('Dépôt');
      expect(depot.chambre).toBe('senat');
      expect(depot.status).toBe('done');
      expect(depot.outcome).toBeNull();
      expect(depot.date).toBe('2025-04-25T00:00:00.000+02:00');
    });

    it('deuxième étape : SN1 (done, adopted)', () => {
      steps = parseActesLegislatifs(FIXTURE_1ER_MAI);
      const sn1 = steps[1]!;
      expect(sn1.code).toBe('SN1');
      expect(sn1.chambre).toBe('senat');
      expect(sn1.status).toBe('done');
      expect(sn1.outcome).toBe('adopted');
      expect(sn1.date).toBe('2025-07-03T00:00:00.000+02:00');
      expect(sn1.detail).toBe('Adoptée');
    });

    it('troisième étape : AN1 (done, rejected)', () => {
      steps = parseActesLegislatifs(FIXTURE_1ER_MAI);
      const an1 = steps[2]!;
      expect(an1.code).toBe('AN1');
      expect(an1.chambre).toBe('assemblee');
      expect(an1.status).toBe('done');
      expect(an1.outcome).toBe('rejected');
      expect(an1.date).toBe('2026-04-10T00:00:00.000+02:00');
    });

    it('quatrième étape : SN2 (active, null outcome)', () => {
      steps = parseActesLegislatifs(FIXTURE_1ER_MAI);
      const sn2 = steps[3]!;
      expect(sn2.code).toBe('SN2');
      expect(sn2.chambre).toBe('senat');
      expect(sn2.status).toBe('active');
      expect(sn2.outcome).toBeNull();
      expect(sn2.date).toBeNull();
    });

    it('les étapes sont triées chronologiquement (null dates en dernier)', () => {
      steps = parseActesLegislatifs(FIXTURE_1ER_MAI);
      const datesWithValue = steps.filter((s) => s.date !== null).map((s) => s.date!);
      for (let i = 1; i < datesWithValue.length; i++) {
        expect(datesWithValue[i - 1]!.localeCompare(datesWithValue[i]!)).toBeLessThanOrEqual(0);
      }
      // SN2 sans date doit être en dernier
      expect(steps[steps.length - 1]!.date).toBeNull();
    });
  });

  describe('loi simple (AN1 conforme → PROM)', () => {
    it('devrait retourner 3 étapes : Dépôt, AN1, PROM', () => {
      const steps = parseActesLegislatifs(FIXTURE_LOI_SIMPLE);
      expect(steps).toHaveLength(3);
      const codes = steps.map((s) => s.code);
      expect(codes).toContain('DEPOT');
      expect(codes).toContain('AN1');
      expect(codes).toContain('PROM');
    });

    it('AN1 doit avoir outcome adopted_conforme', () => {
      const steps = parseActesLegislatifs(FIXTURE_LOI_SIMPLE);
      const an1 = steps.find((s) => s.code === 'AN1')!;
      expect(an1.status).toBe('done');
      expect(an1.outcome).toBe('adopted_conforme');
    });

    it('PROM doit être done avec sa date et outcome null', () => {
      const steps = parseActesLegislatifs(FIXTURE_LOI_SIMPLE);
      const prom = steps.find((s) => s.code === 'PROM')!;
      expect(prom.status).toBe('done');
      expect(prom.outcome).toBeNull();
      expect(prom.date).toBe('2024-03-01T00:00:00.000+01:00');
    });
  });

  describe('CMP accord (SN1 → AN1 → CMP accord → PROM)', () => {
    it('devrait retourner 5 étapes : Dépôt, SN1, AN1, CMP, PROM', () => {
      const steps = parseActesLegislatifs(FIXTURE_CMP_ACCORD);
      expect(steps).toHaveLength(5);
      const codes = steps.map((s) => s.code);
      expect(codes).toContain('DEPOT');
      expect(codes).toContain('SN1');
      expect(codes).toContain('AN1');
      expect(codes).toContain('CMP');
      expect(codes).toContain('PROM');
    });

    it('CMP doit avoir outcome cmp_accord et chambre both', () => {
      const steps = parseActesLegislatifs(FIXTURE_CMP_ACCORD);
      const cmp = steps.find((s) => s.code === 'CMP')!;
      expect(cmp.status).toBe('done');
      expect(cmp.outcome).toBe('cmp_accord');
      expect(cmp.chambre).toBe('both');
      expect(cmp.date).toBe('2024-06-05T00:00:00.000+02:00');
    });

    it('SN1 doit avoir outcome adopted_modified', () => {
      const steps = parseActesLegislatifs(FIXTURE_CMP_ACCORD);
      const sn1 = steps.find((s) => s.code === 'SN1')!;
      expect(sn1.outcome).toBe('adopted_modified');
    });
  });

  describe('lecture unique ANLUNI rejetée en commission', () => {
    it('devrait retourner 2 étapes : Dépôt et ANLUNI', () => {
      const steps = parseActesLegislatifs(FIXTURE_ANLUNI_REJET_COMMISSION);
      expect(steps).toHaveLength(2);
      const codes = steps.map((s) => s.code);
      expect(codes).toContain('DEPOT');
      expect(codes).toContain('ANLUNI');
    });

    it('ANLUNI doit avoir outcome rejected, status done, chambre assemblee', () => {
      const steps = parseActesLegislatifs(FIXTURE_ANLUNI_REJET_COMMISSION);
      const anluni = steps.find((s) => s.code === 'ANLUNI')!;
      expect(anluni.status).toBe('done');
      expect(anluni.outcome).toBe('rejected');
      expect(anluni.chambre).toBe('assemblee');
      expect(anluni.label).toBe('Lecture unique');
      expect(anluni.detail).toBe('Rejet en commission');
    });
  });

  describe('normalisation acteLegislatif unique (non-tableau)', () => {
    it("devrait traiter un acteLegislatif unique comme un tableau d'un élément", () => {
      const steps = parseActesLegislatifs(FIXTURE_SINGLE_ACTE);
      expect(steps.length).toBeGreaterThan(0);
      const an1 = steps.find((s) => s.code === 'AN1');
      expect(an1).toBeDefined();
    });

    it('AN1 doit être done avec outcome adopted', () => {
      const steps = parseActesLegislatifs(FIXTURE_SINGLE_ACTE);
      const an1 = steps.find((s) => s.code === 'AN1')!;
      expect(an1.status).toBe('done');
      expect(an1.outcome).toBe('adopted');
    });

    it('AN1-DEBATS-DEC enfant objet unique doit aussi être normalisé', () => {
      // Le cas 1er mai utilise un objet unique imbriqué pour AN1-DEBATS-DEC
      const steps = parseActesLegislatifs(FIXTURE_1ER_MAI);
      const an1 = steps.find((s) => s.code === 'AN1')!;
      expect(an1.status).toBe('done');
      expect(an1.outcome).toBe('rejected');
    });
  });

  describe('gestion de fam_code invalide', () => {
    it('devrait retourner outcome null pour fam_code TSORTFnull', () => {
      const data = {
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'AN1-null',
              codeActe: 'AN1',
              dateActe: null,
              actesLegislatifs: {
                acteLegislatif: [
                  {
                    uid: 'dec-null',
                    codeActe: 'AN1-DEBATS-DEC',
                    dateActe: '2024-01-01T00:00:00.000+01:00',
                    statutConclusion: { fam_code: 'TSORTFnull', libelle: '' },
                  },
                ],
              },
            },
          ],
        },
      };
      const steps = parseActesLegislatifs(data);
      const an1 = steps.find((s) => s.code === 'AN1')!;
      expect(an1.status).toBe('done');
      expect(an1.outcome).toBeNull();
    });

    it('devrait retourner outcome null pour statutConclusion manquant', () => {
      const data = {
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'AN1-nosc',
              codeActe: 'AN1',
              dateActe: null,
              actesLegislatifs: {
                acteLegislatif: [
                  {
                    uid: 'dec-nosc',
                    codeActe: 'AN1-DEBATS-DEC',
                    dateActe: '2024-01-01T00:00:00.000+01:00',
                    // pas de statutConclusion
                  },
                ],
              },
            },
          ],
        },
      };
      const steps = parseActesLegislatifs(data);
      const an1 = steps.find((s) => s.code === 'AN1')!;
      expect(an1.outcome).toBeNull();
    });
  });

  describe('codes inconnus ignorés', () => {
    it('devrait ignorer les codes AN20/AN21 et autres codes non mappés', () => {
      const data = {
        actesLegislatifs: {
          acteLegislatif: [
            {
              uid: 'AN20-test',
              codeActe: 'AN20',
              dateActe: null,
            },
            {
              uid: 'AN21-test',
              codeActe: 'AN21',
              dateActe: null,
            },
            {
              uid: 'AN1-test',
              codeActe: 'AN1',
              dateActe: null,
              actesLegislatifs: {
                acteLegislatif: [
                  {
                    uid: 'depot-test',
                    codeActe: 'AN1-DEPOT',
                    dateActe: '2024-05-01T00:00:00.000+02:00',
                  },
                ],
              },
            },
          ],
        },
      };
      const steps = parseActesLegislatifs(data);
      const codes = steps.map((s) => s.code);
      expect(codes).not.toContain('AN20');
      expect(codes).not.toContain('AN21');
      expect(codes).toContain('AN1');
    });
  });
});
