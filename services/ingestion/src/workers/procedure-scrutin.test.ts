// =============================================================================
// Tests — Garde-fou procédure des liens scrutin → dossier
// =============================================================================

import { describe, it, expect } from 'vitest';
import { MOTION_DE_CENSURE, PROCEDURES_SANS_VOTE, PROCEDURE_ENGAGEMENT_RESPONSABILITE } from './sync.js';
import { THRESHOLDS } from '../checks/data-quality.js';

describe('PROCEDURES_SANS_VOTE', () => {
  it("couvre les rapports et missions d'information, pas la commission d'enquête", () => {
    expect(PROCEDURES_SANS_VOTE).toContain('19');
    expect(PROCEDURES_SANS_VOTE).toContain('10');
    // La résolution qui crée une commission d'enquête se vote dans son dossier.
    expect(PROCEDURES_SANS_VOTE).not.toContain('9');
    expect(PROCEDURES_SANS_VOTE).not.toContain(PROCEDURE_ENGAGEMENT_RESPONSABILITE);
  });

  it('est la liste vérifiée par le contrôle qualité', () => {
    const query = THRESHOLDS.scrutins_sur_dossier_sans_vote?.query ?? '';
    const codes = /procedure_code IN \(([^)]*)\)/.exec(query)?.[1]
      ?.split(',')
      .map((c) => c.trim().replace(/'/g, ''));
    expect(codes).toEqual([...PROCEDURES_SANS_VOTE]);
  });
});

describe('MOTION_DE_CENSURE', () => {
  it('reconnaît les motions de censure, 49.2 comme 49.3', () => {
    expect(MOTION_DE_CENSURE.test(
      "la motion de censure déposée en application de l'article 49, alinéa 3, de la Constitution par Mmes Mathilde Panot et Cyrielle Chatelain",
    )).toBe(true);
    expect(MOTION_DE_CENSURE.test(
      "la motion de censure, déposée en application de l'article 49, alinéa 2, de la Constitution, par M. Boris Vallaud",
    )).toBe(true);
  });

  it("écarte les votes du texte sur lequel le Gouvernement engage sa responsabilité", () => {
    expect(MOTION_DE_CENSURE.test(
      "l'article 34 (examen prioritaire) du projet de loi de financement de la sécurité sociale pour 2023 (première lecture).",
    )).toBe(false);
    expect(MOTION_DE_CENSURE.test(
      "l'amendement de suppression n° 487 de Mme Dalloz et les amendements identiques suivants à l'article 3 du projet de loi instituant un système universel de retraite",
    )).toBe(false);
    expect(MOTION_DE_CENSURE.test(
      'la motion de rejet préalable, déposée par M. Christian Jacob, du projet de loi pour la liberté de choisir son avenir professionnel (nouvelle lecture).',
    )).toBe(false);
  });
});
