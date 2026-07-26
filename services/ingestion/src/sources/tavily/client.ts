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

const TAVILY_USAGE_URL = 'https://api.tavily.com/usage';

/**
 * Raison pour laquelle Tavily n'est plus exploitable sur ce run.
 * `null` = utilisable.
 */
let indisponibleDepuis: 'no-key' | 'quota' | 'auth' | null = null;

/**
 * Vérifie que la clé API est configurée.
 *
 * ⚠️ Ne dit RIEN de l'état du compte. Le 2026-07-24 les crédits Tavily ont été
 * épuisés (plan Researcher, 1000/mois) : la clé était toujours là, donc cette
 * fonction répondait `true`, mais chaque appel repartait en HTTP 432. Le
 * résultat `null` étant traité comme « pas de résultats web », on a produit
 * 76 fiches parlementaires non sourcées en trois jours sans qu'aucune alerte
 * ne se déclenche. Utiliser `getTavilyStatus()` pour savoir si Tavily répond
 * vraiment.
 */
export function isTavilyAvailable(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

/**
 * État réel de Tavily pour ce run, mis à jour par les appels précédents.
 * Une fois le quota constaté épuisé, on ne rappelle plus l'API : le run du
 * 2026-07-26 avait accumulé 954 appels voués à l'échec.
 */
export function getTavilyStatus(): { available: boolean; reason: string | null } {
  if (!process.env.TAVILY_API_KEY) return { available: false, reason: 'no-key' };
  return { available: indisponibleDepuis === null, reason: indisponibleDepuis };
}

/** Remet l'état à zéro (tests, ou nouvelle fenêtre de facturation). */
export function resetTavilyStatus(): void {
  indisponibleDepuis = null;
}

export interface TavilyCredits {
  used: number;
  limit: number | null;
  remaining: number | null;
}

/**
 * Crédits restants sur le plan, lus auprès de Tavily.
 *
 * Sert de garde-fou en amont d'un enrichissement : avec 1000 crédits par mois
 * et une rotation quotidienne de ~25 parlementaires, le budget part en trois
 * semaines. Mieux vaut ne pas commencer que s'arrêter au milieu.
 */
export async function fetchTavilyCredits(): Promise<TavilyCredits | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(TAVILY_USAGE_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn({ status: response.status }, 'Tavily usage endpoint unavailable');
      return null;
    }
    const data = (await response.json()) as {
      account?: { plan_usage?: number; plan_limit?: number | null };
    };
    const used = data.account?.plan_usage ?? 0;
    const limit = data.account?.plan_limit ?? null;
    return { used, limit, remaining: limit === null ? null : Math.max(0, limit - used) };
  } catch (error) {
    logger.warn({ error: errorMessage(error) }, 'Tavily usage check failed');
    return null;
  }
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
    indisponibleDepuis = 'no-key';
    return null;
  }

  // Quota épuisé ou clé refusée : inutile de rappeler l'API pour chaque fiche.
  if (indisponibleDepuis !== null) {
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
      // 432 = plafond du plan atteint (message maison de Tavily), 401/403 = clé
      // refusée. Ces trois cas ne se résoudront pas d'eux-mêmes pendant le run :
      // on coupe court plutôt que de répéter l'appel des centaines de fois.
      if (response.status === 432 || response.status === 401 || response.status === 403) {
        indisponibleDepuis = response.status === 432 ? 'quota' : 'auth';
        logger.error(
          { status: response.status, raison: indisponibleDepuis },
          'Tavily indisponible — enrichissements dépendants interrompus',
        );
      } else {
        logger.warn({ status: response.status, query }, 'Tavily API error');
      }
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
