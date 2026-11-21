// =============================================================================
// Appels aux API de Wikimedia (Wikidata, Wikipédia)
//
// Wikimedia freine une rafale de requêtes par un 429 de quelques secondes, avec
// `Retry-After`. Un échec de lecture ne dit rien de la personne cherchée :
// l'appelant doit pouvoir le distinguer d'une recherche sans résultat.
// =============================================================================

import { errorMessage } from '../utils/errors.js';

/** Politique de Wikimedia : un User-Agent qui permet de joindre l'opérateur. */
export const USER_AGENT_WIKIMEDIA = 'CLAIR-bot/1.0 (+https://clair.vote; contact@clair.vote)';

const DELAI_REQUETE_MS = 10_000;
/** Attente maximale demandée par `Retry-After` que l'on accepte de respecter. */
const ATTENTE_MAX_MS = 30_000;

/** Wikimedia n'a pas répondu (429, 5xx, réseau, erreur de l'API) : rien à conclure. */
export class WikimediaIndisponible extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WikimediaIndisponible';
  }
}

export type ReponseWikimedia<T> = { ok: true; json: T } | { ok: false; raison: string };

/**
 * GET sur une API de Wikimedia, JSON en retour.
 *
 * `reprises` : nombre de nouvelles tentatives après un 429, un 5xx ou une
 * coupure réseau, en respectant `Retry-After`. Zéro par défaut : un seul essai,
 * et une coupure réseau remonte telle quelle.
 */
export async function getWikimedia<T>(
  baseUrl: string,
  params: Record<string, string>,
  options: { reprises?: number } = {},
): Promise<ReponseWikimedia<T>> {
  const reprises = options.reprises ?? 0;
  const url = `${baseUrl}?${new URLSearchParams({ ...params, format: 'json' })}`;
  for (let tentative = 0; ; tentative++) {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(DELAI_REQUETE_MS),
        headers: { 'User-Agent': USER_AGENT_WIKIMEDIA },
      });
    } catch (error) {
      if (tentative >= reprises) {
        if (reprises === 0) throw error;
        return { ok: false, raison: `réseau : ${errorMessage(error)}` };
      }
      await attendre(2000 * 2 ** tentative);
      continue;
    }
    if (res.ok) return { ok: true, json: (await res.json()) as T };
    const reessayable = res.status === 429 || res.status >= 500;
    if (!reessayable || tentative >= reprises) return { ok: false, raison: `HTTP ${res.status}` };
    const retryAfter = Number(res.headers.get('retry-after'));
    await attendre(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** tentative);
  }
}

function attendre(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, Math.min(ms, ATTENTE_MAX_MS)));
}
