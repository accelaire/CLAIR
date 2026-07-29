import { describe, it, expect } from 'vitest';
import { TfidfVectorizer, cosineSimilarity, bestMatch, SparseRow } from './tfidf';

describe('TfidfVectorizer', () => {
  it('should build vocabulary from corpus', () => {
    const vec = new TfidfVectorizer();
    vec.fit(['hello world', 'world foo', 'bar baz']);
    expect(vec.vocabularySize).toBe(5); // hello, world, foo, bar, baz
  });

  it('should handle empty corpus', () => {
    const vec = new TfidfVectorizer();
    vec.fit([]);
    expect(vec.vocabularySize).toBe(0);
  });

  it('should throw if transform called before fit', () => {
    const vec = new TfidfVectorizer();
    expect(() => vec.transform(['hello'])).toThrow('must be fitted');
  });

  it('should produce L2-normalized vectors', () => {
    const vec = new TfidfVectorizer();
    const matrix = vec.fitTransform(['hello world', 'world foo', 'bar baz']);
    // Each row should have L2 norm ≈ 1.0
    for (const row of matrix) {
      let norm = 0;
      for (const val of row.values()) {
        norm += val * val;
      }
      if (row.size > 0) {
        expect(Math.abs(Math.sqrt(norm) - 1.0)).toBeLessThan(1e-10);
      }
    }
  });

  it('should give higher weight to rare terms', () => {
    const vec = new TfidfVectorizer();
    // "common" appears in all docs, "rare" appears in only one
    const matrix = vec.fitTransform([
      'common rare',
      'common other',
      'common another',
    ]);
    // In doc 0, "rare" should have higher IDF weight contribution than "common"
    // The raw TF-IDF before normalization for "rare" would be higher IDF
    // After normalization, we check indirectly via the fact that
    // doc 0 should be more similar to a query containing "rare" than to one without
    const queryRare = vec.transform(['rare']);
    const queryCommon = vec.transform(['common']);
    // doc 0 has "rare" → higher similarity with queryRare
    const simRare = cosineSimilarity(matrix[0]!, queryRare[0]!);
    const simCommon = cosineSimilarity(matrix[0]!, queryCommon[0]!);
    expect(simRare).toBeGreaterThan(simCommon);
  });

  it('fitTransform should match separate fit + transform', () => {
    const vec1 = new TfidfVectorizer();
    const matrix1 = vec1.fitTransform(['alpha beta', 'beta gamma']);

    const vec2 = new TfidfVectorizer();
    vec2.fit(['alpha beta', 'beta gamma']);
    const matrix2 = vec2.transform(['alpha beta', 'beta gamma']);

    // Results should be identical
    for (let i = 0; i < matrix1.length; i++) {
      for (const [idx, val] of matrix1[i]!) {
        expect(Math.abs(val - (matrix2[i]!.get(idx) || 0))).toBeLessThan(1e-10);
      }
    }
  });
});

describe('cosineSimilarity', () => {
  it('should return 1.0 for identical vectors', () => {
    const vec: SparseRow = new Map([[0, 0.5], [1, 0.5], [2, Math.sqrt(0.5)]]);
    expect(Math.abs(cosineSimilarity(vec, vec) - (0.25 + 0.25 + 0.5))).toBeLessThan(1e-10);
  });

  it('should return 0.0 for orthogonal vectors', () => {
    const a: SparseRow = new Map([[0, 1.0]]);
    const b: SparseRow = new Map([[1, 1.0]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should handle empty vectors', () => {
    const empty: SparseRow = new Map();
    const nonEmpty: SparseRow = new Map([[0, 1.0]]);
    expect(cosineSimilarity(empty, nonEmpty)).toBe(0);
    expect(cosineSimilarity(empty, empty)).toBe(0);
  });
});

describe('bestMatch', () => {
  it('should find the most similar document', () => {
    const vec = new TfidfVectorizer();
    const corpus = vec.fitTransform([
      'immigration integration',
      'finance budget economie',
      'immigration asile refugies',
    ]);
    const query = vec.transform(['immigration integration accueil']);
    const result = bestMatch(query[0]!, corpus);
    expect(result.index).toBe(0); // Most similar to first doc
    expect(result.score).toBeGreaterThan(0);
  });

  it('should return -1 for empty corpus', () => {
    const result = bestMatch(new Map([[0, 1.0]]), []);
    expect(result.index).toBe(-1);
    expect(result.score).toBe(-1);
  });

  it('should only consider whitelisted candidates', () => {
    const vec = new TfidfVectorizer();
    const corpus = vec.fitTransform([
      'immigration integration',
      'finance budget economie',
      'immigration asile refugies',
    ]);
    const query = vec.transform(['immigration integration accueil']);

    // Doc 0 is the global best match, but it is excluded from the candidates:
    // the match must fall back to doc 2, not silently ignore the restriction.
    const result = bestMatch(query[0]!, corpus, [1, 2]);
    expect(result.index).toBe(2);
    expect(result.score).toBeGreaterThan(0);
  });

  it('should return -1 when the candidate list is empty', () => {
    const vec = new TfidfVectorizer();
    const corpus = vec.fitTransform(['immigration integration', 'finance budget']);
    const query = vec.transform(['immigration']);
    const result = bestMatch(query[0]!, corpus, []);
    expect(result.index).toBe(-1);
  });

  it('should ignore out-of-range candidate indices', () => {
    const vec = new TfidfVectorizer();
    const corpus = vec.fitTransform(['immigration integration', 'finance budget']);
    const query = vec.transform(['immigration']);
    const result = bestMatch(query[0]!, corpus, [0, 99]);
    expect(result.index).toBe(0);
  });

  it('should find exact match with score close to 1.0', () => {
    const vec = new TfidfVectorizer();
    const corpus = vec.fitTransform(['alpha beta gamma', 'delta epsilon']);
    const query = vec.transform(['alpha beta gamma']);
    const result = bestMatch(query[0]!, corpus);
    expect(result.index).toBe(0);
    expect(result.score).toBeGreaterThan(0.99);
  });
});
