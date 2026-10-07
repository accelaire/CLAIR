// =============================================================================
// Tests — Vote sur l'ensemble d'un texte
// =============================================================================

import { describe, it, expect } from 'vitest';
import { PARTIE_DE_TEXTE, voteSurLEnsemble } from './vote-ensemble.js';

// Traduction JS de la regex PostgreSQL (\m \M = frontières de mot).
const partie = new RegExp(PARTIE_DE_TEXTE.replace(/\\m|\\M/g, '\\b'), 'i');

describe('PARTIE_DE_TEXTE', () => {
  it('repère les votes sur une partie de loi de finances', () => {
    expect(partie.test('la première partie du projet de loi de finances pour 2025 (première lecture).')).toBe(true);
    expect(partie.test("l'ensemble de la deuxième partie du projet de loi de financement de la sécurité sociale pour 2024")).toBe(true);
    expect(partie.test("sur l'ensemble de la troisième partie du projet de loi de financement de la sécurité sociale")).toBe(true);
  });

  it("laisse passer le vote sur l'ensemble et les parties de code", () => {
    expect(partie.test("l'ensemble du projet de loi de finances pour 2025")).toBe(false);
    expect(partie.test("sur l'ensemble de la proposition de loi organique modifiant le livre III de la sixième partie du code général des collectivités territoriales")).toBe(false);
    expect(partie.test("l'ensemble du projet de loi ratifiant les ordonnances relatives à la partie législative du code")).toBe(false);
  });
});

describe('voteSurLEnsemble', () => {
  it("s'applique à l'alias fourni", () => {
    const sql = voteSurLEnsemble('sc').sql;
    expect(sql).toContain("sc.type_vote = 'solennel'");
    expect(sql).toContain('sc.titre !~*');
  });

  it('refuse un alias invalide', () => {
    expect(() => voteSurLEnsemble('s; DROP')).toThrow();
  });
});
