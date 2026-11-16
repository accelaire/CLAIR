import { describe, expect, it } from 'vitest';
import { titreDansLeDossier } from './titre-scrutin-dossier';

describe('titreDansLeDossier', () => {
  it("retire l'intitulé du texte et garde la lecture (Assemblée)", () => {
    expect(
      titreDansLeDossier(
        "l'amendement n° 1146 (rect.) de M. Balanant à l'article 30 (examen prioritaire) de la proposition de loi apportant une réponse intégrale au phénomène des violences sexuelles (première lecture).",
      ),
    ).toBe("L'amendement n° 1146 (rect.) de M. Balanant à l'article 30 (examen prioritaire) · première lecture");
    expect(titreDansLeDossier("l'article 13 du projet de loi de finances pour 2027 (première lecture).")).toBe(
      "L'article 13 · première lecture",
    );
  });

  it('retire le « sur » et l’intitulé du Sénat', () => {
    expect(
      titreDansLeDossier(
        "sur l'amendement n° 304 rectifié quater, repris par Mme Colombe Brossel, à l'article 5 quater du projet de loi relatif à la protection des enfants",
      ),
    ).toBe("L'amendement n° 304 rectifié quater, repris par Mme Colombe Brossel, à l'article 5 quater");
    expect(titreDansLeDossier("sur l'ensemble du projet de loi relatif à la réparation des dommages")).toBe(
      "L'ensemble du texte",
    );
  });

  it("rend tel quel un titre sans renvoi au texte", () => {
    expect(titreDansLeDossier('la proposition de loi apportant une réponse intégrale (première lecture).')).toBe(
      'La proposition de loi apportant une réponse intégrale (première lecture)',
    );
    expect(titreDansLeDossier('la motion de censure déposée par M. Vallaud.')).toBe('La motion de censure déposée par M. Vallaud');
  });
});
