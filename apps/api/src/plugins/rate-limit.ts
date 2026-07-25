// =============================================================================
// Plugin Rate Limiting + Anti-Abuse pour Fastify
// =============================================================================
//
// - Rate limiting Redis-backed (partagé entre instances, persiste au redeploy)
// - 10 req/min pour les accès directs à l'API, illimité pour le frontend
// - Blocage des User-Agents suspects (scripts basiques)
// - Auto-ban des IPs après trop de violations 429
// - Messages d'erreur avec instructions de contact
// =============================================================================

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

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
  // ===========================================================================
  // 1. BLOCKED USER-AGENTS (runs first)
  // ===========================================================================
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isExcludedPath(request.url)) return;

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
      return isExcludedPath(request.url) || request.ip === '127.0.0.1';
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
  // 5. ENHANCED LOGGING for non-frontend requests
  // ===========================================================================
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isExcludedPath(request.url)) return;
    if (isTrustedFrontend(request)) return;

    // Log all non-frontend API access for monitoring
    const duration = reply.elapsedTime.toFixed(0);
    request.log.info(
      {
        type: 'api_access',
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
