// =============================================================================
// Helper pour construire une app Fastify de test
// =============================================================================

import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createMockPrismaClient, createMockRedisClient } from '../mocks';

export type TestApp = FastifyInstance & {
  mockPrisma: ReturnType<typeof createMockPrismaClient>;
  mockRedis: ReturnType<typeof createMockRedisClient>;
};

interface BuildTestAppOptions {
  routes?: (fastify: FastifyInstance) => Promise<void>;
}

/**
 * Construit une app Fastify de test avec Prisma et Redis mockés
 */
export async function buildTestApp(options: BuildTestAppOptions = {}): Promise<TestApp> {
  const mockPrisma = createMockPrismaClient();
  const mockRedis = createMockRedisClient();

  const app = Fastify({
    logger: false,
  }) as TestApp;

  // Mock Prisma plugin
  await app.register(
    fp(async (fastify) => {
      fastify.decorate('prisma', mockPrisma);
    }, { name: 'prisma' })
  );

  // Mock Redis plugin
  await app.register(
    fp(async (fastify) => {
      fastify.decorate('redis', mockRedis);
      fastify.decorate('cache', {
        get: async (key: string) => {
          const value = await mockRedis.get(key);
          return value ? JSON.parse(value) : null;
        },
        set: async (key: string, value: unknown, ttl = 300) => {
          await mockRedis.setex(key, ttl, JSON.stringify(value));
        },
        del: async (key: string) => {
          await mockRedis.del(key);
        },
        invalidatePattern: async (pattern: string) => {
          const keys = await mockRedis.keys(pattern);
          for (const key of keys) {
            await mockRedis.del(key);
          }
        },
      });
    }, { name: 'redis' })
  );

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        message: 'Les données fournies sont invalides',
      });
    }

    if ('statusCode' in error && error.statusCode) {
      return reply.status(error.statusCode as number).send({
        error: error.name,
        code: (error as any).code || 'ERROR',
        message: error.message,
      });
    }

    return reply.status(500).send({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: error.message,
    });
  });

  // Register custom routes if provided
  if (options.routes) {
    await options.routes(app);
  }

  // Attach mocks to app for easy access in tests
  app.mockPrisma = mockPrisma;
  app.mockRedis = mockRedis;

  await app.ready();

  return app;
}

/**
 * Ferme proprement l'app de test
 */
export async function closeTestApp(app: TestApp): Promise<void> {
  await app.close();
}
