// =============================================================================
// Client Tavily Search — Recherche web enrichie pour fiches parlementaires
// Optionnel : skip gracieux si TAVILY_API_KEY non configurée
// Documentation: https://docs.tavily.com/
// =============================================================================

import { logger } from '../../utils/logger.js';
import { errorMessage } from '../../utils/errors.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const REQUEST_TIMEOUT_MS = 15_000;

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string; // Contenu extrait (pas juste un snippet)
  score: number;
}

/**
 * Vérifie si Tavily est disponible (clé API configurée)
 */
export function isTavilyAvailable(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

/**
 * Recherche Tavily générique, optionnellement restreinte/excluant des domaines.
 * Retourne null si TAVILY_API_KEY non configurée (graceful degradation).
 */
export async function tavilySearch(
  query: string,
  options?: { includeDomains?: string[]; excludeDomains?: string[]; maxResults?: number }
): Promise<TavilySearchResult[] | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: options?.maxResults ?? 5,
        include_answer: false,
        include_raw_content: false,
        ...(options?.includeDomains?.length
          ? { include_domains: options.includeDomains }
          : {}),
        ...(options?.excludeDomains?.length
          ? { exclude_domains: options.excludeDomains }
          : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, query }, 'Tavily API error');
      return null;
    }

    const data = await response.json() as {
      results?: { title: string; url: string; content: string; score: number }[];
    };

    return (data.results ?? []).map(r => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }));
  } catch (error) {
    logger.warn({ error: errorMessage(error), query }, 'Tavily search failed');
    return null;
  }
}
