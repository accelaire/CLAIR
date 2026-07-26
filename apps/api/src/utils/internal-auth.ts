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
 * Ancien en-tête de POST /homepage/warm.
 *
 * Conservé le temps que le scheduler d'ingestion déployé rattrape la bascule :
 * API et Ingestion sont deux services Railway distincts, rien ne garantit
 * qu'ils redémarrent ensemble. À retirer une fois les deux à jour.
 */
const LEGACY_HEADER = 'x-warm-token';

/**
 * Secret attendu.
 *
 * `CACHE_WARM_TOKEN` est l'ancien nom de la variable, gardé en repli pour que
 * le renommage côté Railway puisse se faire sans coordination avec le déploiement.
 * À retirer en même temps que LEGACY_HEADER.
 */
function getInternalSecret(): string {
  const value = process.env.CLAIR_INTERNAL_SECRET || process.env.CACHE_WARM_TOKEN || '';
  return value.trim();
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

  const raw = request.headers[INTERNAL_HEADER] ?? request.headers[LEGACY_HEADER];
  const provided = typeof raw === 'string' ? raw.trim() : '';
  if (!provided) return false;

  return timingSafeEqual(sha256(secret), sha256(provided));
}

/** Le secret est-il configuré ? Sert à alerter au démarrage. */
export function hasInternalSecret(): boolean {
  return getInternalSecret().length > 0;
}
