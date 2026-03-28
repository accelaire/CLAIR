// =============================================================================
// Tests unitaires - Fuzzy search (Jaro-Winkler, tokenization, partial matching)
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  jaroWinklerSimilarity,
  normalizeForFuzzy,
  tokenize,
  scoreCandidate,
  fuzzySearchCandidates,
  FuzzyCandidate,
} from './fuzzy-search';

describe('jaroWinklerSimilarity', () => {
  it('devrait retourner 1 pour des chaînes identiques', () => {
    expect(jaroWinklerSimilarity('test', 'test')).toBe(1);
  });

  it('devrait retourner 0 pour des chaînes vides', () => {
    expect(jaroWinklerSimilarity('', 'test')).toBe(0);
    expect(jaroWinklerSimilarity('test', '')).toBe(0);
  });

  it('devrait retourner un score élevé pour des chaînes similaires', () => {
    expect(jaroWinklerSimilarity('melenchon', 'melanchon')).toBeGreaterThan(0.9);
    expect(jaroWinklerSimilarity('dupont', 'dupond')).toBeGreaterThan(0.9);
  });

  it('devrait donner un bonus aux préfixes communs', () => {
    const withPrefix = jaroWinklerSimilarity('melenchon', 'melanchon');
    const withoutPrefix = jaroWinklerSimilarity('elenchon', 'elanchon');
    expect(withPrefix).toBeGreaterThan(withoutPrefix);
  });

  it('devrait retourner un score bas pour des chaînes très différentes', () => {
    expect(jaroWinklerSimilarity('macron', 'hollande')).toBeLessThan(0.7);
  });
});

describe('normalizeForFuzzy', () => {
  it('devrait mettre en minuscules', () => {
    expect(normalizeForFuzzy('DUPONT')).toBe('dupont');
  });

  it('devrait supprimer les accents', () => {
    expect(normalizeForFuzzy('Mélenchon')).toBe('melenchon');
    expect(normalizeForFuzzy('François')).toBe('francois');
    expect(normalizeForFuzzy('Éric')).toBe('eric');
  });

  it('devrait trimmer les espaces', () => {
    expect(normalizeForFuzzy('  dupont  ')).toBe('dupont');
  });
});

describe('tokenize', () => {
  it('devrait séparer par espaces', () => {
    expect(tokenize('jean dupont')).toEqual(['jean', 'dupont']);
  });

  it('devrait séparer par tirets', () => {
    expect(tokenize('Jean-Luc')).toEqual(['jean', 'luc']);
  });

  it('devrait séparer par apostrophes', () => {
    expect(tokenize("d'Ornano")).toEqual(['d', 'ornano']);
  });

  it('devrait supprimer les accents et normaliser', () => {
    expect(tokenize('Jean-Luc Mélenchon')).toEqual(['jean', 'luc', 'melenchon']);
  });

  it('devrait filtrer les tokens vides', () => {
    expect(tokenize('  jean   dupont  ')).toEqual(['jean', 'dupont']);
  });
});

describe('scoreCandidate', () => {
  const candidate: FuzzyCandidate = {
    id: '1',
    nom: 'Mélenchon',
    prenom: 'Jean-Luc',
    slug: 'jean-luc-melenchon',
  };

  it('devrait scorer haut pour une correspondance exacte', () => {
    expect(scoreCandidate('Mélenchon', candidate)).toBeGreaterThan(0.9);
    expect(scoreCandidate('Jean-Luc Mélenchon', candidate)).toBeGreaterThan(0.9);
  });

  it('devrait scorer haut pour des fautes de frappe mineures', () => {
    expect(scoreCandidate('Melanchon', candidate)).toBeGreaterThan(0.85);
    expect(scoreCandidate('Melenchon', candidate)).toBeGreaterThan(0.9);
  });

  it('devrait scorer haut pour des préfixes partiels', () => {
    expect(scoreCandidate('Melencho', candidate)).toBeGreaterThan(0.82);
    expect(scoreCandidate('Mel', candidate)).toBeGreaterThan(0.82);
  });

  it('devrait scorer 0 pour des noms très différents', () => {
    expect(scoreCandidate('Hollande', candidate)).toBe(0);
  });

  it('devrait gérer la recherche multi-mots avec faute', () => {
    expect(scoreCandidate('jean luc melanchon', candidate)).toBeGreaterThan(0.82);
  });

  it('devrait gérer la recherche sans accents', () => {
    expect(scoreCandidate('melenchon', candidate)).toBeGreaterThan(0.9);
  });
});

describe('fuzzySearchCandidates', () => {
  const candidates: FuzzyCandidate[] = [
    { id: '1', nom: 'Mélenchon', prenom: 'Jean-Luc', slug: 'jean-luc-melenchon' },
    { id: '2', nom: 'Macron', prenom: 'Emmanuel', slug: 'emmanuel-macron' },
    { id: '3', nom: 'Le Pen', prenom: 'Marine', slug: 'marine-le-pen' },
    { id: '4', nom: 'Dupont', prenom: 'Jean', slug: 'jean-dupont' },
    { id: '5', nom: 'Dupond', prenom: 'Pierre', slug: 'pierre-dupond' },
    { id: '6', nom: 'Mélenchon', prenom: 'Pierre', slug: 'pierre-melenchon' },
  ];

  it('devrait trouver des résultats avec une faute de frappe', () => {
    const results = fuzzySearchCandidates('melanchon', candidates);
    expect(results.length).toBeGreaterThan(0);
    // The real Mélenchon(s) should be in results
    const ids = results.map((r) => r.id);
    expect(ids).toContain('1');
  });

  it('devrait trier par score décroissant', () => {
    const results = fuzzySearchCandidates('melenchon', candidates);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('devrait trouver Dupont et Dupond pour "dupont"', () => {
    const results = fuzzySearchCandidates('dupont', candidates);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('4'); // Dupont
    expect(ids).toContain('5'); // Dupond (fuzzy)
  });

  it('devrait respecter maxResults', () => {
    const results = fuzzySearchCandidates('e', candidates, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('devrait trouver avec recherche multi-mots', () => {
    const results = fuzzySearchCandidates('jean luc melenchon', candidates);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('1');
  });

  it('devrait retourner un tableau vide si rien ne correspond', () => {
    const results = fuzzySearchCandidates('xyzqwerty', candidates);
    expect(results).toEqual([]);
  });
});
