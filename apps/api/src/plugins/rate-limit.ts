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
import { isInternalRequest, hasInternalSecret } from '../utils/internal-auth';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Max requests per minute for direct API access (non-frontend) */
const DIRECT_API_MAX = 10;

/** Max requests per minute for frontend (Origin matches trusted domains) */
const FRONTEND_MAX = 200;

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
  `Limite de requêtes atteinte (${DIRECT_API_MAX} req/min). ` +
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
 * Check if a request originates from a trusted frontend.
 * We check both Origin and Referer headers against CORS_ORIGIN env var.
 *
 * ⚠️ Falsifiable : `Origin` et `Referer` sont choisis par le client, n'importe
 * qui peut se réclamer du frontend et passer de 10 à 200 req/min. C'est toléré
 * tant que le navigateur appelle l'API en direct — il ne peut porter aucun
 * secret. La sortie prévue est de router le navigateur via clair.vote/api/v1,
 * qui lui peut s'authentifier avec le secret interne (voir internal-auth.ts) ;
 * cette fonction disparaîtra alors avec getTrustedOrigins().
 */
function isTrustedFrontend(request: FastifyRequest): boolean {
  const trustedOrigins = getTrustedOrigins();
  if (trustedOrigins.length === 0) return false;

  const origin = request.headers.origin || '';
  const referer = request.headers.referer || '';

  return trustedOrigins.some(
    (trusted) => origin.includes(trusted) || referer.includes(trusted),
  );
}

let _trustedOrigins: string[] | null = null;

function getTrustedOrigins(): string[] {
  if (_trustedOrigins !== null) return _trustedOrigins;

  const raw = process.env.CORS_ORIGIN || '';
  _trustedOrigins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // In dev, localhost is always trusted
  if (process.env.NODE_ENV !== 'production') {
    _trustedOrigins.push('localhost', '127.0.0.1');
  }

  return _trustedOrigins;
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
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isExcludedPath(request.url)) return;
    if (isInternalRequest(request)) return; // Trafic interne CLAIR

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
  // 3. RATE LIMITING (Redis-backed, per-IP, frontend-aware)
  // ===========================================================================
  await fastify.register(rateLimit, {
    max: (request: FastifyRequest) => {
      if (isTrustedFrontend(request)) return FRONTEND_MAX;
      return DIRECT_API_MAX;
    },
    timeWindow: RATE_LIMIT_WINDOW,
    redis: fastify.redis,
    keyGenerator: (request: FastifyRequest) => request.ip,
    skipOnError: true, // If Redis is down, don't block
    allowList: (request: FastifyRequest) => {
      // Health checks (Railway healthcheck) and cache warming (lightMyRequest) bypass rate limiting
      // Le trafic interne CLAIR (SSR, sitemap, ingestion) est exempté par secret partagé
      return (
        isExcludedPath(request.url) ||
        request.ip === '127.0.0.1' ||
        isInternalRequest(request)
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
    if (isInternalRequest(request)) return;

    const duration = reply.elapsedTime.toFixed(0);
    request.log.info(
      {
        type: 'api_access',
        tier: isTrustedFrontend(request) ? 'frontend' : 'anonymous',
        ip: request.ip,
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
