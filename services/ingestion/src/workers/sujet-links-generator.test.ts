import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../sources/tavily/client', () => ({
  tavilySearch: vi.fn(),
  fetchTavilyCredits: vi.fn(),
}));

import { tavilySearch } from '../sources/tavily/client';
import { BUDGET_TAVILY_PAR_DEFAUT, budgetTavilyDuJour, contextHash, resolveViePublique } from './sujet-links-generator';

describe('contextHash', () => {
  it("vaut le md5(slug || '|' || status) que la migration inscrit en base", () => {
    // Valeur rendue par Postgres en production pour la même entrée.
    expect(contextHash('loi-de-finances-pour-2026', 'promulgue')).toBe('22ae0eff4a6fedf3ce5b0f3533fa663f');
  });

  it('change avec le statut', () => {
    expect(contextHash('loi-de-finances-pour-2026', 'adopte')).not.toBe(contextHash('loi-de-finances-pour-2026', 'promulgue'));
  });
});

describe('budgetTavilyDuJour', () => {
  const credits = (remaining: number | null) => ({ used: 0, limit: remaining === null ? null : 1000, remaining });

  it('étale les crédits restants jusqu’au 1er du mois suivant', () => {
    // Nightly du 18/10 à 3h UTC : 14 runs jusqu'au 31 inclus.
    expect(budgetTavilyDuJour(credits(1000), new Date('2026-10-18T03:00:00Z'))).toBe(72);
    // Le 1er, juste après la remise à zéro : 31 runs.
    expect(budgetTavilyDuJour(credits(1000), new Date('2026-10-01T03:00:00Z'))).toBe(33);
  });

  it('laisse tout dépenser le dernier jour du mois', () => {
    expect(budgetTavilyDuJour(credits(40), new Date('2026-10-31T03:00:00Z'))).toBe(40);
    expect(budgetTavilyDuJour(credits(40), new Date('2026-12-31T23:30:00Z'))).toBe(40);
  });

  it('garde au moins une recherche tant qu’il reste un crédit', () => {
    expect(budgetTavilyDuJour(credits(3), new Date('2026-10-02T03:00:00Z'))).toBe(1);
  });

  it('ne cherche plus rien quand le quota est épuisé', () => {
    expect(budgetTavilyDuJour(credits(0), new Date('2026-10-18T03:00:00Z'))).toBe(0);
  });

  it('retombe sur un jour de plan quand les crédits sont inconnus ou sans plafond', () => {
    expect(budgetTavilyDuJour(null)).toBe(BUDGET_TAVILY_PAR_DEFAUT);
    expect(budgetTavilyDuJour(credits(null))).toBe(BUDGET_TAVILY_PAR_DEFAUT);
  });
});

describe('resolveViePublique', () => {
  const page = {
    title: 'Loi du 24 août 2021 confortant le respect des principes de la République | vie-publique.fr',
    url: 'https://www.vie-publique.fr/loi/277621-loi-separatisme-respect-des-principes-de-la-republique',
    content: '',
    score: 0.9,
  };

  beforeEach(() => {
    vi.mocked(tavilySearch).mockReset();
    vi.mocked(tavilySearch).mockResolvedValue([page]);
  });

  it('consomme une recherche du budget', async () => {
    const budget = { restant: 2, reportes: 0 };
    const outcome = await resolveViePublique('Respect des principes de la République', budget);
    expect(outcome).toEqual({ ok: true, cand: { titre: 'Loi du 24 août 2021 confortant le respect des principes de la République', url: page.url } });
    expect(budget).toEqual({ restant: 1, reportes: 0 });
  });

  it("reporte sans appeler Tavily une fois le budget épuisé, sans marquer le sujet résolu", async () => {
    const budget = { restant: 0, reportes: 0 };
    expect(await resolveViePublique('Respect des principes de la République', budget)).toEqual({ cand: null, ok: false });
    expect(tavilySearch).not.toHaveBeenCalled();
    expect(budget).toEqual({ restant: 0, reportes: 1 });
  });
});
