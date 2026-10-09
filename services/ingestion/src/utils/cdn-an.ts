// =============================================================================
// Cache du portail open data de l'Assemblée
// =============================================================================
//
// `data.assemblee-nationale.fr` sert ses archives derrière un cache qui les
// garde quatre heures (`Cache-Control: max-age=14400`). L'Assemblée les
// republie vers 2 h UTC, le batch nocturne les lit à 3 h UTC : il pouvait
// recevoir la version de la VEILLE.
//
// Mesuré le 9 octobre 2026. À 3 h 05 UTC, le cache a servi l'AMO10 et
// l'archive des débats du 8 octobre (Last-Modified 01:50 et 02:06), alors que
// l'origine publiait déjà ceux du 9 (01:50 et 02:05). Résultat : 23 nominations
// en commission et les séances du 7 au soir et du 8 absentes de la base.
//
// Un paramètre de requête inédit force le cache à interroger l'origine
// (`x-cacheable: Cacheable: force cache`) ; l'origine l'ignore et sert le
// fichier. Seulement en GET : l'origine répond 503 à un HEAD qui porte un
// paramètre. Les en-têtes se lisent donc par un GET réduit au premier octet.
//
// On ne contourne PAS le cache systématiquement : l'origine débite 400 à
// 470 Ko/s (mesuré le même jour), contre 30 Mo/s pour le cache. L'archive des
// amendements (315 Mo) y prendrait plus de dix minutes. On compare donc
// l'en-tête du cache à celui de l'origine, et on ne va à l'origine que si le
// cache est périmé.

import axios from 'axios';
import { logger } from './logger.js';
import { errorMessage } from './errors.js';

const HOTE_OPEN_DATA_AN = 'data.assemblee-nationale.fr';
const USER_AGENT = 'CLAIR-Bot/1.0 (https://github.com/clair)';

/** L'URL désigne-t-elle le portail open data de l'Assemblée ? */
export function estOpenDataAN(url: string): boolean {
  try {
    return new URL(url).hostname === HOTE_OPEN_DATA_AN;
  } catch {
    return false;
  }
}

/**
 * L'URL à demander pour obtenir la version de l'origine, et non celle du
 * cache. Toute autre URL est rendue telle quelle.
 */
export function urlSansCacheAN(url: string, jeton: number = Date.now()): string {
  if (!estOpenDataAN(url)) return url;
  const u = new URL(url);
  u.searchParams.set('_', String(jeton));
  return u.toString();
}

export interface EnTetesFraicheur {
  etag: string | null;
  lastModified: string | null;
}

/** En-têtes de fraîcheur lus par un GET réduit au premier octet. */
export async function lireEnTetesParGet(url: string) {
  return axios.get(url, {
    timeout: 30000,
    headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-0' },
    responseType: 'arraybuffer',
  });
}

function fraicheur(headers: Record<string, unknown>): EnTetesFraicheur {
  const lire = (k: string) => (typeof headers[k] === 'string' ? (headers[k] as string) : null);
  return { etag: lire('etag'), lastModified: lire('last-modified') };
}

/** Le cache sert-il la même version que l'origine ? L'ETag d'abord, la date à défaut. */
export function memeVersion(cache: EnTetesFraicheur, origine: EnTetesFraicheur): boolean {
  if (cache.etag && origine.etag) return cache.etag === origine.etag;
  if (cache.lastModified && origine.lastModified) return cache.lastModified === origine.lastModified;
  return false;
}

/**
 * L'URL à télécharger : celle du cache s'il sert la version de l'origine,
 * sinon celle qui force l'origine. Toute URL hors du portail AN est rendue
 * telle quelle. Si l'origine ne répond pas, on se rabat sur le cache : mieux
 * vaut la version de la veille que pas de synchro du tout.
 */
export async function urlAJourAN(url: string): Promise<{ url: string; origine: boolean }> {
  if (!estOpenDataAN(url)) return { url, origine: false };
  const urlOrigine = urlSansCacheAN(url);
  const [cache, origine] = await Promise.allSettled([lireEnTetesParGet(url), lireEnTetesParGet(urlOrigine)]);

  if (origine.status === 'rejected') {
    logger.warn({ url, error: errorMessage(origine.reason) }, "Origine du portail AN injoignable, version du cache");
    return { url, origine: false };
  }
  const versionOrigine = fraicheur(origine.value.headers);
  if (cache.status === 'fulfilled' && memeVersion(fraicheur(cache.value.headers), versionOrigine)) {
    return { url, origine: false };
  }
  logger.warn(
    {
      url,
      cache: cache.status === 'fulfilled' ? fraicheur(cache.value.headers) : errorMessage(cache.reason),
      origine: versionOrigine,
    },
    "Cache du portail AN périmé : téléchargement depuis l'origine",
  );
  return { url: urlOrigine, origine: true };
}
