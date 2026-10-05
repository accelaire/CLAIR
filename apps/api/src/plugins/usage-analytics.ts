// =============================================================================
// Plugin de mesure d'usage de l'API → Plausible (instance auto-hébergée)
// =============================================================================
//
// Chaque réponse de l'API envoie un événement `pageview` à l'API d'événements
// de Plausible, sur un site dédié (`api.clair.vote` par défaut). On obtient un
// tableau de bord de l'usage de l'API : endpoints, volumes, pays, consommateurs.
//
// - Désactivé tant que PLAUSIBLE_EVENTS_URL n'est pas défini (local, tests).
// - Jamais bloquant : l'envoi part après la réponse, borné dans le temps, et
//   ses erreurs sont avalées. Une panne de Plausible ne touche pas l'API.
// - L'URL envoyée est le MOTIF de route (`/api/v1/deputes/:slug`) et non le
//   chemin réel : les pages du tableau de bord agrègent par endpoint, et les
//   paramètres de requête (recherche, filtres) ne sortent pas de l'API.
//
// Ce que l'API ne voit pas, Plausible ne le voit pas : les réponses servies
// par le cache CDN de Vercel devant le proxy du site n'arrivent jamais ici,
// le canal `site` ne compte donc que les MISS.
// =============================================================================

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { getForwardedClientIp, isInternalRequest } from '../utils/internal-auth';

/** Domaine du site Plausible qui reçoit les événements. */
const DEFAULT_DOMAIN = 'api.clair.vote';

/** Délai maximal d'un envoi. */
const SEND_TIMEOUT_MS = 3000;

/**
 * Envois simultanés maximum. Au-delà, les événements sont abandonnés : si
 * Plausible ralentit, on perd de la mesure plutôt que d'accumuler des
 * connexions dans le processus de l'API.
 */
const MAX_IN_FLIGHT = 100;

/**
 * User-Agent présenté à Plausible.
 *
 * Plausible écarte les événements dont le User-Agent est reconnu comme robot.
 * Sur un site web c'est ce qu'on veut ; pour l'API c'est l'inverse, ce sont
 * précisément les robots et les scripts qu'on cherche à voir. On présente donc
 * un User-Agent fixe, et le client réel part dans la propriété `client`.
 * Plausible distingue toujours les visiteurs par IP.
 */
const RELAY_USER_AGENT = 'CLAIR-API-Usage/1.0';

/** Longueur maximale de la propriété `client`. */
const CLIENT_MAX_LENGTH = 80;

/**
 * Canal d'accès, aligné sur les tiers du rate-limit :
 *  - `direct`  : appel direct à l'API (réutilisateurs, scripts, curieux) ;
 *  - `site`    : visiteur du site relayé par le proxy du frontend ;
 *  - `interne` : SSR, sitemap, ingestion.
 */
export type Canal = 'direct' | 'site' | 'interne';

export interface UsageEvent {
  name: 'pageview';
  url: string;
  domain: string;
  referrer?: string;
  props: { canal: Canal; statut: string; client: string };
}

function isExcluded(request: FastifyRequest): boolean {
  if (request.method === 'OPTIONS' || request.method === 'HEAD') return true;
  const path = request.url.split('?', 1)[0] ?? '';
  return path === '/health' || path.startsWith('/health/');
}

function getCanal(request: FastifyRequest): Canal {
  if (!isInternalRequest(request)) return 'direct';
  return getForwardedClientIp(request) ? 'site' : 'interne';
}

/**
 * Nom court du client à partir de son User-Agent : le premier produit
 * (`GuzzleHttp/7.8.1 curl/8.5` → `GuzzleHttp/7.8.1`), sauf pour les
 * navigateurs, regroupés sous `navigateur` (leur version n'apprend rien ici).
 */
export function clientName(userAgent: string | undefined): string {
  const ua = (userAgent ?? '').trim();
  if (!ua) return '(aucun)';
  if (ua.startsWith('Mozilla/')) return 'navigateur';
  return (ua.split(/\s+/, 1)[0] ?? ua).slice(0, CLIENT_MAX_LENGTH);
}

/** Motif de la route servie, ou `/(route inconnue)` pour un 404 hors routes. */
function routePattern(request: FastifyRequest): string {
  return request.routeOptions?.url ?? '/(route inconnue)';
}

export function buildUsageEvent(
  request: FastifyRequest,
  reply: FastifyReply,
  domain: string,
): UsageEvent {
  const referer = request.headers.referer;
  return {
    name: 'pageview',
    url: `https://${domain}${routePattern(request)}`,
    domain,
    ...(typeof referer === 'string' && referer ? { referrer: referer } : {}),
    props: {
      canal: getCanal(request),
      statut: String(reply.statusCode),
      client: clientName(request.headers['user-agent']),
    },
  };
}

/** IP du client final : celle du visiteur pour le trafic relayé. */
function clientIp(request: FastifyRequest): string {
  return getForwardedClientIp(request) ?? request.ip;
}

const usageAnalyticsPlugin: FastifyPluginAsync = async (fastify) => {
  const endpoint = (process.env.PLAUSIBLE_EVENTS_URL || '').trim();
  if (!endpoint) return;

  const domain = (process.env.PLAUSIBLE_API_DOMAIN || '').trim() || DEFAULT_DOMAIN;
  let inFlight = 0;
  let dropped = 0;

  fastify.log.info({ endpoint, domain }, "Mesure d'usage de l'API vers Plausible activée");

  fastify.addHook('onResponse', async (request, reply) => {
    if (isExcluded(request)) return;

    if (inFlight >= MAX_IN_FLIGHT) {
      dropped += 1;
      // Un avertissement par centaine d'abandons, pour ne pas inonder les logs.
      if (dropped % 100 === 1) {
        request.log.warn({ dropped }, 'Plausible : envois saturés, événements abandonnés');
      }
      return;
    }

    const event = buildUsageEvent(request, reply, domain);
    inFlight += 1;

    // Volontairement non attendu : la réponse est déjà partie, l'envoi ne doit
    // retarder ni ce hook ni la requête suivante.
    void fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': RELAY_USER_AGENT,
        'X-Forwarded-For': clientIp(request),
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
      .then((res) => {
        if (!res.ok) {
          request.log.debug({ status: res.status }, 'Plausible : événement refusé');
        }
      })
      .catch((err: unknown) => {
        request.log.debug({ err }, 'Plausible : envoi en échec');
      })
      .finally(() => {
        inFlight -= 1;
      });
  });
};

export default fp(usageAnalyticsPlugin, {
  name: 'usage-analytics',
});

export { usageAnalyticsPlugin };
