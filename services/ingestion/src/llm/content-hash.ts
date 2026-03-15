import { createHash } from 'crypto';

/**
 * Compute a SHA-256 hash of concatenated input parts.
 * Used to detect whether LLM-relevant source data has changed since last enrichment.
 */
export function computeContentHash(...parts: (string | null | undefined)[]): string {
  const joined = parts.map(p => p ?? '').join('|');
  return createHash('sha256').update(joined, 'utf8').digest('hex');
}
