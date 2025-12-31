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
      if (times > 3) {
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000);
    },
  });

  redis.on('error', (err) => {
    fastify.log.error({ err }, 'Redis connection error');
  });

  redis.on('connect', () => {
    fastify.log.info('Redis connected');
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
