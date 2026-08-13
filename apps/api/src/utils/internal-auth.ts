// =============================================================================
// Authentification du trafic interne (secret partagé)
// =============================================================================
//
// Un seul secret identifie tout ce qui appartient à CLAIR et parle à l'API :
//
//   - le frontend Next.js côté serveur (SSR, génération du sitemap)
//   - le scheduler d'ingestion (invalidation du cache homepage après le sync)
//
// C'est la généralisation du couple CACHE_WARM_TOKEN / `x-warm-token` qui
// protégeait déjà POST /homepage/warm : une variable d'environnement partagée
// entre les services, comparée en temps constant. Pas de délivrance, pas de
// stockage, pas de quota — ce n'est pas un système de clés API.
//
// Le secret doit valoir la MÊME chose sur les trois services (Railway CLAIR,
// Railway Ingestion, Vercel). Toute divergence est silencieuse côté appelant :
// la requête part et retombe simplement dans le tier anonyme à 10 req/min.
//
// Ce secret ne doit JAMAIS être exposé au navigateur : il n'a sa place que dans
// du code qui s'exécute sur un serveur (fonctions serveur Next, CLI ingestion),
// jamais dans un composant client ni dans une variable NEXT_PUBLIC_*.
//
// Il remplace la reconnaissance du frontend par en-tête `Origin`, qui est
// choisie par le client et donc falsifiable par n'importe qui.
// =============================================================================

import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

/** En-tête portant le secret interne. */
export const INTERNAL_HEADER = 'x-clair-internal';

/**
 * IP réelle du visiteur, posée par le proxy du frontend (`/api/v1/[...path]`).
 *
 * Sans elle, router le navigateur à travers le front transformerait celui-ci en
 * relais anonyme illimité : il suffirait d'appeler clair.vote/api/v1/… en boucle
 * pour contourner toute limite. Le proxy transmet donc l'IP du visiteur, et
 * l'API plafonne ce trafic sur cette IP plutôt que de l'exempter.
 *
 * ⚠️ N'a de sens QUE sur une requête déjà authentifiée par le secret interne.
 * Le proxy l'écrase systématiquement à partir de la connexion réelle, un client
 * ne peut donc pas la choisir pour se fabriquer un compteur neuf.
 */
export const CLIENT_IP_HEADER = 'x-clair-client-ip';

/** Secret attendu, partagé à l'identique par l'API, l'ingestion et le frontend. */
function getInternalSecret(): string {
  return (process.env.CLAIR_INTERNAL_SECRET || '').trim();
}

/**
 * Hash de longueur fixe : `timingSafeEqual` exige deux buffers de même taille et
 * lève une exception sinon. Passer par SHA-256 évite à la fois cette exception
 * et la fuite de la longueur du secret par comparaison de tailles.
 */
function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * La requête provient-elle d'un service interne CLAIR ?
 *
 * Renvoie `false` si aucun secret n'est configuré : une variable d'environnement
 * oubliée ne doit pas ouvrir l'accès, elle doit le fermer.
 */
export function isInternalRequest(request: FastifyRequest): boolean {
  const secret = getInternalSecret();
  if (!secret) return false;

  const raw = request.headers[INTERNAL_HEADER];
  const provided = typeof raw === 'string' ? raw.trim() : '';
  if (!provided) return false;

  return timingSafeEqual(sha256(secret), sha256(provided));
}

/** Le secret est-il configuré ? Sert à alerter au démarrage. */
export function hasInternalSecret(): boolean {
  return getInternalSecret().length > 0;
}

/**
 * La requête vient-elle d'un service interne parlant à l'API en direct, sans
 * navigateur au bout de la chaîne ?
 *
 * `isInternalRequest()` seul ne suffit PAS à protéger un endpoint : le proxy du
 * frontend pose le secret sur tout ce qu'il relaie, y compris ce qu'un visiteur
 * déclenche depuis sa page. Le secret prouve « cette requête a traversé un de
 * nos serveurs », jamais « un humain n'est à l'origine de cette requête ».
 *
 * La différence se lit sur `x-clair-client-ip` : le proxy le pose toujours (il
 * en a besoin pour le rate-limit), le scheduler d'ingestion jamais. Son absence
 * est donc la signature du trafic service-à-service.
 *
 * ⚠️ C'est CE contrôle, et non `isInternalRequest()`, que doit utiliser tout
 * endpoint à effet de bord réservé à nos machines. Avec le contrôle laxiste,
 * `fetch('/api/v1/…', { method: 'POST' })` depuis n'importe quelle page suffit
 * à l'atteindre — et comme un POST sans `content-type` custom est une « simple
 * request » CORS, même un site tiers peut le déclencher chez ses visiteurs.
 */
export function isStrictlyInternalRequest(request: FastifyRequest): boolean {
  return isInternalRequest(request) && getForwardedClientIp(request) === null;
}

/**
 * IP du visiteur relayée par le proxy du frontend, ou `null`.
 *
 * Renvoie `null` si la requête n'est pas authentifiée comme interne : l'en-tête
 * est alors sans valeur, n'importe qui pourrait l'inventer.
 */
export function getForwardedClientIp(request: FastifyRequest): string | null {
  if (!isInternalRequest(request)) return null;

  const raw = request.headers[CLIENT_IP_HEADER];
  const ip = typeof raw === 'string' ? raw.trim() : '';
  return ip.length > 0 ? ip : null;
}
