// =============================================================================
// Module Health - Endpoints de santé
// =============================================================================

import { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /health - Health check basique
  fastify.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Vérifie que l\'API est opérationnelle',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
    handler: async (_request, _reply) => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    },
  });

  // GET /health/ready - Readiness check (inclut DB et Redis)
  fastify.get('/health/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness check',
      description: 'Vérifie que tous les services sont prêts',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string' },
                redis: { type: 'string' },
              },
            },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            services: { type: 'object' },
            error: { type: 'string' },
          },
        },
      },
    },
    handler: async (_request, reply) => {
      const services: Record<string, string> = {
        database: 'unknown',
        redis: 'unknown',
      };

      try {
        // Check PostgreSQL
        await fastify.prisma.$queryRaw`SELECT 1`;
        services.database = 'ok';
      } catch (error) {
        services.database = 'error';
      }

      try {
        // Check Redis
        await fastify.redis.ping();
        services.redis = 'ok';
      } catch (error) {
        services.redis = 'error';
      }

      const allHealthy = Object.values(services).every((s) => s === 'ok');

      if (!allHealthy) {
        return reply.status(503).send({
          status: 'unhealthy',
          services,
          error: 'Some services are not available',
        });
      }

      return {
        status: 'ready',
        services,
      };
    },
  });

  // GET /health/live - Liveness check
  fastify.get('/health/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness check',
      description: 'Vérifie que le processus est vivant',
    },
    handler: async () => {
      return { status: 'alive' };
    },
  });
};
