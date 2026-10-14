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

/** ETag et Last-Modified d'une réponse. */
export function fraicheur(headers: Record<string, unknown>): EnTetesFraicheur {
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
 * La réponse porte-t-elle une AUTRE version que celle attendue ? Faux quand on
 * ne peut pas comparer : sans en-tête, on ne refuse pas une réponse.
 */
export function versionContredite(servie: EnTetesFraicheur, attendue: EnTetesFraicheur): boolean {
  if (servie.etag && attendue.etag) return servie.etag !== attendue.etag;
  if (servie.lastModified && attendue.lastModified) return servie.lastModified !== attendue.lastModified;
  return false;
}

export interface CibleAN {
  url: string;
  /** L'URL force-t-elle l'origine ? */
  origine: boolean;
  /** La version publiée par l'origine, quand on a pu la lire. */
  version: EnTetesFraicheur | null;
}

/**
 * Attentes avant chaque lecture de l'origine. Le 11 octobre 2026 à 3 h 19 UTC,
 * l'origine a répondu 503 ; le batch s'est rabattu sur le cache, qui servait
 * l'archive des débats de la veille, et deux séances sont restées en compte
 * rendu provisoire. Un quart d'heure plus tard, l'origine répondait.
 */
const ATTENTES_ORIGINE_MS = [0, 30_000, 90_000];

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * L'URL à télécharger : celle du cache s'il sert la version de l'origine,
 * sinon celle qui force l'origine. Toute URL hors du portail AN est rendue
 * telle quelle. Si l'origine ne répond toujours pas après plusieurs essais, on
 * se rabat sur le cache : mieux vaut la version de la veille que pas de synchro
 * du tout, mais c'est une version NON VÉRIFIÉE, journalisée en erreur.
 */
export async function urlAJourAN(
  url: string,
  options: { attentesMs?: number[] } = {},
): Promise<CibleAN> {
  if (!estOpenDataAN(url)) return { url, origine: false, version: null };
  const attentes = options.attentesMs ?? ATTENTES_ORIGINE_MS;
  const lectureCache = lireEnTetesParGet(url).then(
    (r) => ({ ok: true as const, version: fraicheur(r.headers) }),
    (e: unknown) => ({ ok: false as const, erreur: errorMessage(e) }),
  );

  let versionOrigine: EnTetesFraicheur | null = null;
  let derniereErreur = '';
  for (const [essai, attente] of attentes.entries()) {
    if (attente > 0) await attendre(attente);
    try {
      versionOrigine = fraicheur((await lireEnTetesParGet(urlSansCacheAN(url))).headers);
      break;
    } catch (error) {
      derniereErreur = errorMessage(error);
      logger.warn({ url, essai: essai + 1, essais: attentes.length, error: derniereErreur }, 'Origine du portail AN injoignable');
    }
  }
  const cache = await lectureCache;

  if (!versionOrigine) {
    logger.error(
      { url, error: derniereErreur, essais: attentes.length },
      "Origine du portail AN injoignable : version du cache NON VÉRIFIÉE, possiblement celle de la veille",
    );
    return { url, origine: false, version: null };
  }
  if (cache.ok && memeVersion(cache.version, versionOrigine)) {
    return { url, origine: false, version: versionOrigine };
  }
  logger.warn(
    { url, cache: cache.ok ? cache.version : cache.erreur, origine: versionOrigine },
    "Cache du portail AN périmé : téléchargement depuis l'origine",
  );
  return { url: urlSansCacheAN(url), origine: true, version: versionOrigine };
}
