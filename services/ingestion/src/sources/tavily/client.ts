// =============================================================================
// Client Tavily Search — Recherche web enrichie pour fiches parlementaires
// Optionnel : skip gracieux si TAVILY_API_KEY non configurée
// Documentation: https://docs.tavily.com/
// =============================================================================

import { logger } from '../../utils/logger.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const REQUEST_TIMEOUT_MS = 15_000;

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string; // Contenu extrait (pas juste un snippet)
  score: number;
}

export interface TavilySearchResponse {
  results: TavilySearchResult[];
  query: string;
}

/**
 * Vérifie si Tavily est disponible (clé API configurée)
 */
export function isTavilyAvailable(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

/**
 * Recherche Tavily pour un parlementaire.
 * Retourne null si TAVILY_API_KEY non configurée (graceful degradation).
 */
export async function searchParlementaire(
  prenom: string,
  nom: string,
  options?: { chambre?: string; maxResults?: number }
): Promise<TavilySearchResponse | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return null;
  }

  const chambreLabel = options?.chambre === 'senat' ? 'sénateur' : 'député';
  const maxResults = options?.maxResults ?? 5;

  const query = `${prenom} ${nom} ${chambreLabel} France actualité politique`;

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
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
        // Exclure les réseaux sociaux et sites non pertinents
        exclude_domains: [
          'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
          'tiktok.com', 'youtube.com', 'linkedin.com',
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.warn(
        { status: response.status, body: body.slice(0, 200) },
        'Tavily API error'
      );
      return null;
    }

    const data = await response.json() as {
      results: { title: string; url: string; content: string; score: number }[];
    };

    return {
      query,
      results: (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
      })),
    };
  } catch (error: any) {
    logger.warn({ error: error.message, query }, 'Tavily search failed');
    return null;
  }
}
