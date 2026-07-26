// =============================================================================
// Helper pour construire une app Fastify de test
// =============================================================================

import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { createMockPrismaClient, createMockRedisClient, type MockPrismaClient, type MockRedisClient } from '../mocks';

export type TestApp = FastifyInstance & {
  mockPrisma: MockPrismaClient;
  mockRedis: MockRedisClient;
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
  });

  // Mock Prisma plugin
  await app.register(
    fp(async (fastify) => {
      fastify.decorate('prisma', mockPrisma as unknown as PrismaClient);
    }, { name: 'prisma' })
  );

  // Mock Redis plugin
  await app.register(
    fp(async (fastify) => {
      fastify.decorate('redis', mockRedis as unknown as Redis);
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
  app.setErrorHandler((error, _request, reply) => {
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
        code: (error as unknown as Record<string, unknown>).code || 'ERROR',
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
  const testApp = app as unknown as TestApp;
  testApp.mockPrisma = mockPrisma;
  testApp.mockRedis = mockRedis;

  await app.ready();

  return testApp;
}

/**
 * Ferme proprement l'app de test
 */
export async function closeTestApp(app: TestApp): Promise<void> {
  await app.close();
}
