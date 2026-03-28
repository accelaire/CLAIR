// =============================================================================
// Fuzzy search utilities — Jaro-Winkler distance, tokenization, partial matching
// =============================================================================

/**
 * Calculates the Jaro similarity between two strings.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchWindow = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0);

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3
  );
}

/**
 * Calculates the Jaro-Winkler similarity between two strings.
 * Gives a bonus to strings that share a common prefix (up to 4 chars).
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function jaroWinklerSimilarity(s1: string, s2: string, prefixScale = 0.1): number {
  const jaroScore = jaroSimilarity(s1, s2);

  // Find common prefix length (max 4)
  let prefixLength = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  return jaroScore + prefixLength * prefixScale * (1 - jaroScore);
}

/**
 * Normalize a string for fuzzy comparison:
 * - lowercase
 * - remove accents/diacritics
 * - trim whitespace
 */
export function normalizeForFuzzy(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Tokenize a string into individual words for token-level matching.
 */
export function tokenize(str: string): string[] {
  return normalizeForFuzzy(str)
    .split(/[\s\-']+/)
    .filter((w) => w.length > 0);
}

/**
 * Check if a query is a partial prefix match of a target.
 * e.g. "mel" matches "melenchon", "dup" matches "dupont"
 */
export function isPartialMatch(query: string, target: string): boolean {
  return target.startsWith(query) || target.includes(query);
}

export interface FuzzyCandidate {
  id: string;
  nom: string;
  prenom: string;
  slug: string;
}

export interface FuzzyResult {
  id: string;
  score: number;
}

const JARO_WINKLER_THRESHOLD = 0.82;
const PARTIAL_MATCH_SCORE = 0.85;

/**
 * Score a single candidate against a search query using multiple strategies:
 * 1. Partial/prefix matching on individual tokens
 * 2. Jaro-Winkler similarity on full name
 * 3. Token-level Jaro-Winkler matching
 *
 * Returns a score between 0 and 1, or 0 if below threshold.
 */
export function scoreCandidate(query: string, candidate: FuzzyCandidate): number {
  const normalizedQuery = normalizeForFuzzy(query);
  const queryTokens = tokenize(query);

  const nomNorm = normalizeForFuzzy(candidate.nom);
  const prenomNorm = normalizeForFuzzy(candidate.prenom);
  const fullName = `${prenomNorm} ${nomNorm}`;
  const fullNameReversed = `${nomNorm} ${prenomNorm}`;
  const candidateTokens = tokenize(`${candidate.prenom} ${candidate.nom}`);

  let bestScore = 0;

  // Strategy 1: Full string Jaro-Winkler
  const fullScore = Math.max(
    jaroWinklerSimilarity(normalizedQuery, fullName),
    jaroWinklerSimilarity(normalizedQuery, fullNameReversed),
    jaroWinklerSimilarity(normalizedQuery, nomNorm),
    jaroWinklerSimilarity(normalizedQuery, prenomNorm)
  );
  bestScore = Math.max(bestScore, fullScore);

  // Strategy 2: Partial/prefix matching on tokens
  if (queryTokens.length === 1) {
    // Single word query — check if it's a prefix of nom or prenom
    const q = queryTokens[0];
    if (isPartialMatch(q, nomNorm) || isPartialMatch(q, prenomNorm)) {
      bestScore = Math.max(bestScore, PARTIAL_MATCH_SCORE);
    }
    // Also check individual candidate tokens
    for (const ct of candidateTokens) {
      if (isPartialMatch(q, ct)) {
        bestScore = Math.max(bestScore, PARTIAL_MATCH_SCORE);
      }
      const tokenScore = jaroWinklerSimilarity(q, ct);
      bestScore = Math.max(bestScore, tokenScore);
    }
  }

  // Strategy 3: Token-level matching (each query token must match at least one candidate token)
  if (queryTokens.length > 1) {
    let tokenMatchScore = 0;
    let allTokensMatched = true;

    for (const qt of queryTokens) {
      let bestTokenScore = 0;
      for (const ct of candidateTokens) {
        // Prefix match bonus
        if (ct.startsWith(qt)) {
          bestTokenScore = Math.max(bestTokenScore, PARTIAL_MATCH_SCORE);
        }
        bestTokenScore = Math.max(bestTokenScore, jaroWinklerSimilarity(qt, ct));
      }
      if (bestTokenScore < JARO_WINKLER_THRESHOLD) {
        allTokensMatched = false;
        break;
      }
      tokenMatchScore += bestTokenScore;
    }

    if (allTokensMatched) {
      bestScore = Math.max(bestScore, tokenMatchScore / queryTokens.length);
    }
  }

  return bestScore >= JARO_WINKLER_THRESHOLD ? bestScore : 0;
}

/**
 * Perform fuzzy search on a list of candidates.
 * Returns matching candidate IDs sorted by score (best first).
 */
export function fuzzySearchCandidates(
  query: string,
  candidates: FuzzyCandidate[],
  maxResults = 50
): FuzzyResult[] {
  const results: FuzzyResult[] = [];

  for (const candidate of candidates) {
    const score = scoreCandidate(query, candidate);
    if (score > 0) {
      results.push({ id: candidate.id, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}
