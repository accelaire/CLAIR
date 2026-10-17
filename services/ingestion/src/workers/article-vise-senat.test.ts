import { describe, it, expect } from 'vitest';
import { articleViseAmeli, type ArticlesVisesAmeli } from './article-vise-senat';

// Uids, numéros et texte_ref repris de la production.

const ameli: ArticlesVisesAmeli = {
  texteMapping: new Map([
    [106202, { num: '143', session: '2024-2025' }],
    [106866, { num: '23', session: '2025-2026' }],
  ]),
  articlesVisesByKey: new Map([
    ['2024-2025/143:II-2036', 'Article 49 (crédits de la mission) (État B)'],
    ['2025-2026/23:59', 'art. add. après Article 14'],
  ]),
  articlesVisesByAmdId: new Map([[1284379, 'Article 49 (crédits de la mission) (État B)']]),
};

describe('articleViseAmeli', () => {
  it("prend l'article par l'id AMELI d'une row du full sync", () => {
    expect(articleViseAmeli({ uid: 'SENAT-AMD-1284379', numero: 'II-2036', texteRef: 'SENAT-TXT-106202' }, ameli))
      .toBe('Article 49 (crédits de la mission) (État B)');
  });

  it("ne se replie pas sur la clé quand l'id AMELI n'a pas d'article", () => {
    expect(articleViseAmeli({ uid: 'SENAT-AMD-1', numero: 'II-2036', texteRef: 'SENAT-TXT-106202' }, ameli)).toBeNull();
  });

  it('retrouve une row du CSV par session, texte et numéro, rectification ignorée', () => {
    expect(articleViseAmeli({ uid: 'SENAT-AMD-T106866-59_rect.', numero: '59 rect.', texteRef: 'SENAT-TXT-106866' }, ameli))
      .toBe('art. add. après Article 14');
    expect(articleViseAmeli({ uid: 'SENAT-AMD-S2025-2026-23-59', numero: '59', texteRef: 'SENAT-TXT-106866' }, ameli))
      .toBe('art. add. après Article 14');
  });

  it('rend null sans texte connu ni clé', () => {
    expect(articleViseAmeli({ uid: 'SENAT-AMD-T1-5', numero: '5', texteRef: 'SENAT-TXT-1' }, ameli)).toBeNull();
    expect(articleViseAmeli({ uid: 'SENAT-AMD-T106866-60', numero: '60', texteRef: 'SENAT-TXT-106866' }, ameli)).toBeNull();
    expect(articleViseAmeli({ uid: 'SENAT-AMD-T106866-60', numero: '60', texteRef: null }, ameli)).toBeNull();
  });
});
