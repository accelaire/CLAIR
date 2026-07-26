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
