// =============================================================================
// TF-IDF Vectorizer + Cosine Similarity
// Pure TypeScript implementation (no external dependencies)
// Inspired by sklearn.TfidfVectorizer with sublinear_tf
// =============================================================================

/** Sparse vector: Map<termIndex, tfidfWeight> */
export type SparseRow = Map<number, number>;

/** Sparse matrix: array of sparse rows (one per document) */
export type SparseMatrix = SparseRow[];

/**
 * Minimal TF-IDF vectorizer compatible with sklearn's default behavior.
 *
 * - TF: sublinear (1 + log(tf)) to dampen high-frequency terms
 * - IDF: smooth IDF = log((1 + n) / (1 + df)) + 1
 * - L2 normalization of output vectors
 */
export class TfidfVectorizer {
  private vocabulary = new Map<string, number>();
  private idf = new Float64Array(0);
  private fitted = false;

  /**
   * Build vocabulary and compute IDF from a corpus.
   * @param documents Array of pre-tokenized strings (space-separated tokens)
   */
  fit(documents: string[]): void {
    const n = documents.length;
    if (n === 0) {
      this.fitted = true;
      return;
    }

    // Count document frequency for each term
    const df = new Map<string, number>();

    for (const doc of documents) {
      const seen = new Set<string>();
      for (const token of doc.split(' ')) {
        if (token && !seen.has(token)) {
          seen.add(token);
          df.set(token, (df.get(token) || 0) + 1);
        }
      }
    }

    // Build vocabulary (sorted for determinism)
    const terms = [...df.keys()].sort();
    this.vocabulary = new Map<string, number>();
    for (let i = 0; i < terms.length; i++) {
      this.vocabulary.set(terms[i], i);
    }

    // Compute smooth IDF: log((1 + n) / (1 + df)) + 1
    this.idf = new Float64Array(terms.length);
    for (let i = 0; i < terms.length; i++) {
      const termDf = df.get(terms[i])!;
      this.idf[i] = Math.log((1 + n) / (1 + termDf)) + 1;
    }

    this.fitted = true;
  }

  /**
   * Transform documents into TF-IDF sparse vectors.
   * Must call fit() first.
   * @param documents Array of pre-tokenized strings (space-separated tokens)
   */
  transform(documents: string[]): SparseMatrix {
    if (!this.fitted) {
      throw new Error('TfidfVectorizer must be fitted before transforming');
    }

    const result: SparseMatrix = [];

    for (const doc of documents) {
      const row: SparseRow = new Map();

      // Count term frequencies
      const tf = new Map<number, number>();
      for (const token of doc.split(' ')) {
        const idx = this.vocabulary.get(token);
        if (idx !== undefined) {
          tf.set(idx, (tf.get(idx) || 0) + 1);
        }
      }

      // Compute TF-IDF with sublinear TF
      let norm = 0;
      for (const [idx, count] of tf) {
        const tfidf = (1 + Math.log(count)) * this.idf[idx];
        row.set(idx, tfidf);
        norm += tfidf * tfidf;
      }

      // L2 normalize
      if (norm > 0) {
        norm = Math.sqrt(norm);
        for (const [idx, val] of row) {
          row.set(idx, val / norm);
        }
      }

      result.push(row);
    }

    return result;
  }

  /**
   * Fit and transform in one step (more efficient than separate calls).
   */
  fitTransform(documents: string[]): SparseMatrix {
    this.fit(documents);
    return this.transform(documents);
  }

  /** Number of terms in the vocabulary */
  get vocabularySize(): number {
    return this.vocabulary.size;
  }
}

/**
 * Compute cosine similarity between two L2-normalized sparse vectors.
 * Since vectors are already L2-normalized, cosine = dot product.
 */
export function cosineSimilarity(a: SparseRow, b: SparseRow): number {
  // Iterate over the smaller vector for efficiency
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [idx, valA] of smaller) {
    const valB = larger.get(idx);
    if (valB !== undefined) {
      dot += valA * valB;
    }
  }
  return dot;
}

/**
 * Find the best matching document in a corpus for a given query vector.
 * Returns the index and similarity score of the best match.
 */
export function bestMatch(
  query: SparseRow,
  corpus: SparseMatrix
): { index: number; score: number } {
  let bestIndex = -1;
  let bestScore = -1;

  for (let i = 0; i < corpus.length; i++) {
    const score = cosineSimilarity(query, corpus[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return { index: bestIndex, score: bestScore };
}
