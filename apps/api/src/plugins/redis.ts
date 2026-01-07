// =============================================================================
// Plugin Redis pour Fastify
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    cache: CacheService;
  }
}

interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 10) {
        fastify.log.error('Redis: Max retries reached, giving up');
        return null; // Stop retrying after 10 attempts
      }
      const delay = Math.min(times * 200, 5000);
      fastify.log.warn(`Redis: Retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      if (targetErrors.some((e) => err.message.includes(e))) {
        return true; // Reconnect on these errors
      }
      return false;
    },
    enableReadyCheck: true,
    lazyConnect: false,
  });

  redis.on('error', (err) => {
    // Don't crash on Redis errors, just log them
    fastify.log.error({ err: err.message }, 'Redis connection error');
  });

  redis.on('connect', () => {
    fastify.log.info('Redis connected');
  });

  redis.on('reconnecting', () => {
    fastify.log.warn('Redis reconnecting...');
  });

  // Service de cache avec helpers
  const cache: CacheService = {
    async get<T>(key: string): Promise<T | null> {
      const value = await redis.get(key);
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    },

    async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await redis.setex(key, ttlSeconds, serialized);
    },

    async del(key: string): Promise<void> {
      await redis.del(key);
    },

    async invalidatePattern(pattern: string): Promise<void> {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    },
  };

  fastify.decorate('redis', redis);
  fastify.decorate('cache', cache);

  fastify.addHook('onClose', async (instance) => {
    await instance.redis.quit();
  });
};

export default fp(redisPlugin, {
  name: 'redis',
});

export { redisPlugin };
