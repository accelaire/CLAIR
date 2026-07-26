// =============================================================================
// Plugin Rate Limiting + Anti-Abuse pour Fastify
// =============================================================================
//
// - Rate limiting Redis-backed (partagé entre instances, persiste au redeploy)
// - Trafic interne CLAIR (secret partagé) exempté de toute limite
// - 10 req/min pour les accès directs à l'API, illimité pour le frontend
// - Blocage des User-Agents suspects (scripts basiques)
// - Auto-ban des IPs après trop de violations 429
// - Messages d'erreur avec instructions de contact
// =============================================================================

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import {
  isInternalRequest,
  hasInternalSecret,
  getForwardedClientIp,
} from '../utils/internal-auth';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Max requests per minute for direct API access */
const DIRECT_API_MAX = 10;

/**
 * Max requests per minute for browser traffic relayed by the frontend proxy,
 * counted per real visitor IP.
 *
 * Remplace l'ancien tier « frontend » à 200 req/min qui se réclamait d'un
 * en-tête `Origin` : n'importe quel client pouvait le copier et s'octroyer
 * 20 fois le quota. Ici le laissez-passer est le secret interne, qui ne quitte
 * jamais nos serveurs, et le compteur suit le visiteur et non le proxy.
 *
 * Volontairement généreux : une IP peut porter des centaines de visiteurs
 * derrière le NAT d'un opérateur mobile, et le site fait 71 % de mobile.
 */
const BROWSER_MAX = 60;

const RATE_LIMIT_WINDOW = '1 minute';

/** Number of 429 responses before auto-ban */
const BAN_THRESHOLD = 30;

/** Window (seconds) in which 429 violations are counted */
const BAN_WINDOW_SECONDS = 300;

/** Duration (seconds) of an auto-ban */
const BAN_DURATION_SECONDS = 3600;

/** User-Agents that are blocked outright (exact match, lowercased) */
const BLOCKED_USER_AGENTS = new Set(['node', 'undici']);

const CONTACT_EMAIL = 'contact@clair.vote';

const RATE_LIMIT_MESSAGE =
  `Limite de requêtes atteinte. ` +
  `Si vous souhaitez utiliser l'API CLAIR de manière intensive, contactez-nous : ${CONTACT_EMAIL}`;

const BAN_MESSAGE =
  `Votre adresse IP a été temporairement bloquée suite à un usage excessif de l'API. ` +
  `Pour obtenir un accès adapté à vos besoins, contactez-nous : ${CONTACT_EMAIL}`;

const BLOCKED_UA_MESSAGE =
  `Requête bloquée. Veuillez identifier votre client avec un User-Agent descriptif. ` +
  `Pour un accès API programmatique, contactez-nous : ${CONTACT_EMAIL}`;

// =============================================================================
// HELPERS
// =============================================================================

/** Paths excluded from rate limiting (health checks, monitoring) */
function isExcludedPath(url: string): boolean {
  return url === '/health' || url === '/health/ready' || url === '/health/live';
}

/**
 * Les trois tiers d'accès.
 *
 * Il n'y a plus de tier fondé sur `Origin`/`Referer`. Ces en-têtes sont choisis
 * par le client : la distinction « notre frontend » qu'ils prétendaient établir
 * n'a jamais existé, n'importe qui pouvait s'en réclamer pour passer de 10 à
 * 200 req/min. Le seul laissez-passer est désormais le secret interne, qui ne
 * quitte jamais nos serveurs.
 *
 *  - `internal`  : SSR, sitemap, ingestion. Secret seul, aucune limite.
 *  - `browser`   : visiteur relayé par le proxy du frontend. Secret + IP du
 *                  visiteur, plafonné sur cette IP.
 *  - `anonymous` : tout le reste, y compris les appels directs à api.clair.vote.
 */
type AccessTier = 'internal' | 'browser' | 'anonymous';

function getTier(request: FastifyRequest): AccessTier {
  if (!isInternalRequest(request)) return 'anonymous';
  return getForwardedClientIp(request) ? 'browser' : 'internal';
}

/**
 * Clé de comptage : l'IP du visiteur pour le trafic relayé, l'IP de la connexion
 * sinon. Sans cela tous les visiteurs partageraient le seau du proxy.
 */
function getRateLimitKey(request: FastifyRequest): string {
  return getForwardedClientIp(request) ?? request.ip;
}

// =============================================================================
// PLUGIN
// =============================================================================

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  // Sans secret configuré, le SSR, le sitemap et le scheduler d'ingestion
  // retombent dans le tier anonyme et se font throttler en silence. C'est
  // exactement ce qui tronquait le sitemap : on veut le voir au démarrage.
  if (!hasInternalSecret()) {
    fastify.log.warn(
      'CLAIR_INTERNAL_SECRET absent — le trafic interne (SSR, sitemap, ingestion) sera rate-limité comme un client anonyme',
    );
  }

  // ===========================================================================
  // 1. BLOCKED USER-AGENTS (runs first)
  // ===========================================================================
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isExcludedPath(request.url)) return;
    if (isInternalRequest(request)) return; // Trafic interne CLAIR

    const ua = (request.headers['user-agent'] || '').toLowerCase().trim();

    if (BLOCKED_USER_AGENTS.has(ua)) {
      request.log.warn(
        { ip: request.ip, ua: request.headers['user-agent'], url: request.url },
        'Blocked suspicious User-Agent',
      );
      return reply.status(403).send({
        error: 'Forbidden',
        code: 'BLOCKED_USER_AGENT',
        message: BLOCKED_UA_MESSAGE,
      });
    }
  });

  // ===========================================================================
  // 2. AUTO-BAN CHECK (runs before rate limit)
  // ===========================================================================
  //
  // L'auto-ban ne vise que le tier anonyme. Bannir une IP de visiteur pour une
  // heure reviendrait à couper des centaines de personnes derrière le NAT d'un
  // opérateur mobile, et le site fait 71 % de mobile. Le plafond BROWSER_MAX
  // suffit à contenir ce trafic sans jamais fermer la porte.
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isExcludedPath(request.url)) return;
    if (isInternalRequest(request)) return; // Interne et navigateur relayé

    const ip = request.ip;
    const banKey = `ratelimit:ban:${ip}`;

    try {
      const banned = await fastify.redis.get(banKey);
      if (banned) {
        request.log.warn({ ip, url: request.url }, 'Banned IP attempted access');
        return reply.status(403).send({
          error: 'Forbidden',
          code: 'IP_BANNED',
          message: BAN_MESSAGE,
        });
      }
    } catch {
      // Redis down → don't block (graceful degradation)
    }
  });

  // ===========================================================================
  // 3. RATE LIMITING (Redis-backed, par tier)
  // ===========================================================================
  await fastify.register(rateLimit, {
    max: (request: FastifyRequest) =>
      getTier(request) === 'browser' ? BROWSER_MAX : DIRECT_API_MAX,
    timeWindow: RATE_LIMIT_WINDOW,
    redis: fastify.redis,
    keyGenerator: getRateLimitKey,
    skipOnError: true, // If Redis is down, don't block
    allowList: (request: FastifyRequest) => {
      // Health checks (Railway healthcheck) and cache warming (lightMyRequest) bypass rate limiting
      // Seul le tier `internal` est exempté : le trafic navigateur relayé garde
      // un plafond, sinon le proxy du frontend serait un relais illimité ouvert.
      return (
        isExcludedPath(request.url) ||
        request.ip === '127.0.0.1' ||
        getTier(request) === 'internal'
      );
    },
    errorResponseBuilder: (_request: FastifyRequest, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      code: 'RATE_LIMITED',
      message: RATE_LIMIT_MESSAGE,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  // ===========================================================================
  // 4. AUTO-BAN ESCALATION (after 429 responses)
  // ===========================================================================
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (reply.statusCode !== 429) return;
    // Ne bannir que le tier anonyme. Compter les violations du trafic relayé
    // sur `request.ip` bannirait l'IP de Vercel, donc le site entier ; et les
    // compter sur l'IP du visiteur couperait tout un NAT opérateur.
    if (isInternalRequest(request)) return;

    const ip = request.ip;
    const counterKey = `ratelimit:violations:${ip}`;

    try {
      const count = await fastify.redis.incr(counterKey);
      if (count === 1) {
        await fastify.redis.expire(counterKey, BAN_WINDOW_SECONDS);
      }

      if (count >= BAN_THRESHOLD) {
        const banKey = `ratelimit:ban:${ip}`;
        await fastify.redis.setex(banKey, BAN_DURATION_SECONDS, '1');
        await fastify.redis.del(counterKey);

        fastify.log.error(
          { ip, violations: count, banDurationSeconds: BAN_DURATION_SECONDS },
          'IP auto-banned for excessive rate limit violations',
        );
      }
    } catch {
      // Redis down → skip ban logic
    }
  });

  // ===========================================================================
  // 5. ENHANCED LOGGING for everything that isn't internal traffic
  // ===========================================================================
  //
  // Le trafic « frontend » était auparavant exclu de ce log, ce qui rendait le
  // volume navigateur totalement invisible : impossible de dimensionner quoi que
  // ce soit à partir des seuls accès directs. On loge désormais les deux, et le
  // champ `tier` permet de les distinguer. Seul l'interne est muet, il est déjà
  // connu et représenterait du bruit à chaque page rendue côté serveur.
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isExcludedPath(request.url)) return;

    const tier = getTier(request);
    if (tier === 'internal') return;

    const duration = reply.elapsedTime.toFixed(0);
    request.log.info(
      {
        type: 'api_access',
        tier,
        // Pour le tier `browser`, l'IP du visiteur relayée par le proxy ; c'est
        // elle qui porte le compteur, `request.ip` ne serait que celle de Vercel.
        ip: getRateLimitKey(request),
        ua: request.headers['user-agent'] || 'none',
        method: request.method,
        url: request.url,
        status: reply.statusCode,
        durationMs: duration,
        // Suivi de l'egress facturé : Railway mesure les octets en sortie de
        // conteneur, donc avant la compression de son edge. Ces deux champs
        // permettent de vérifier que le proxy transmet bien Accept-Encoding et
        // que @fastify/compress s'active réellement en production.
        acceptEncoding: request.headers['accept-encoding'] || 'none',
        contentEncoding: reply.getHeader('content-encoding') || 'none',
        // ⚠️ Vaut 'unknown' dès que la réponse est compressée : la compression
        // bascule en chunked et supprime `content-length`. Depuis que gzip est
        // actif, c'est le cas de la quasi-totalité des réponses, donc ce champ
        // ne mesure plus l'egress. Le compter réellement demanderait un
        // compteur d'octets sur le flux ; à faire seulement si l'on remet un
        // budget au poids à l'ordre du jour.
        bytes: reply.getHeader('content-length') || 'unknown',
      },
      'Direct API access',
    );
  });
};

// =============================================================================
// EXPORT
// =============================================================================

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  dependencies: ['redis'],
});

export { rateLimitPlugin };
