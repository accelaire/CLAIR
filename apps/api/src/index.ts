// =============================================================================
// CLAIR API - Entry Point
// =============================================================================

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { prismaPlugin } from './plugins/prisma';
import { redisPlugin } from './plugins/redis';
import { authPlugin } from './plugins/auth';
import { meilisearchPlugin } from './plugins/meilisearch';

import { deputesRoutes, senateursRoutes, parlementairesRoutes } from './modules/parlementaires/parlementaires.controller';
import { scrutinsRoutes } from './modules/scrutins/scrutins.controller';
import { lobbyingRoutes } from './modules/lobbying/lobbying.controller';
import { authRoutes } from './modules/auth/auth.controller';
import { searchRoutes } from './modules/search/search.controller';
import { healthRoutes } from './modules/health/health.controller';
import { simulateurRoutes } from './modules/simulateur/simulateur.controller';
import { candidatsAdminRoutes } from './modules/ingestion/admin.controller';
import { analyticsRoutes } from './modules/analytics/analytics.controller';

import { errorHandler } from './utils/errors';
import { logger } from './utils/logger';

const envToLogger: Record<string, object | boolean> = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  production: true,
  test: false,
};

async function buildApp() {
  const app = Fastify({
    logger: envToLogger[process.env.NODE_ENV ?? 'development'] ?? true,
    trustProxy: true,
  });

  // ==========================================================================
  // PLUGINS GLOBAUX
  // ==========================================================================

  // Sécurité
  await app.register(helmet, {
    contentSecurityPolicy: false, // Désactivé pour permettre Swagger UI
  });

  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.WEB_URL!, process.env.MOBILE_URL!].filter(Boolean)
      : true,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return request.headers['x-forwarded-for']?.toString() || 
             request.ip || 
             'unknown';
    },
  });

  // Documentation API
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CLAIR API',
        description: 'API de la plateforme de transparence politique CLAIR',
        version: '0.1.0',
      },
      servers: [
        {
          url: process.env.API_URL || 'http://localhost:3001',
          description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
        },
      ],
      tags: [
        { name: 'Health', description: 'Endpoints de santé' },
        { name: 'Auth', description: 'Authentification' },
        { name: 'Parlementaires', description: 'Données sur tous les parlementaires (députés + sénateurs)' },
        { name: 'Députés', description: 'Données sur les députés de l\'Assemblée nationale' },
        { name: 'Sénateurs', description: 'Données sur les sénateurs' },
        { name: 'Scrutins', description: 'Votes à l\'Assemblée nationale et au Sénat' },
        { name: 'Lobbying', description: 'Données HATVP sur le lobbying' },
        { name: 'Search', description: 'Recherche globale' },
        { name: 'Simulateur', description: 'Simulateur électoral 2027' },
        { name: 'Admin', description: 'Administration des candidats et ingestion' },
        { name: 'Analytics', description: 'Statistiques et analyses pour l\'explorateur' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // ==========================================================================
  // PLUGINS PERSONNALISÉS
  // ==========================================================================

  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(meilisearchPlugin);
  await app.register(authPlugin);

  // ==========================================================================
  // ROUTES
  // ==========================================================================

  // Health check (pas de préfixe)
  await app.register(healthRoutes);

  // API v1
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(parlementairesRoutes, { prefix: '/parlementaires' });
      await api.register(deputesRoutes, { prefix: '/deputes' });
      await api.register(senateursRoutes, { prefix: '/senateurs' });
      await api.register(scrutinsRoutes, { prefix: '/scrutins' });
      await api.register(lobbyingRoutes, { prefix: '/lobbying' });
      await api.register(searchRoutes, { prefix: '/search' });
      await api.register(simulateurRoutes, { prefix: '/simulateur' });
      await api.register(candidatsAdminRoutes, { prefix: '/admin' });
      await api.register(analyticsRoutes, { prefix: '/analytics' });
    },
    { prefix: '/api/v1' }
  );

  // ==========================================================================
  // ERROR HANDLER
  // ==========================================================================

  app.setErrorHandler(errorHandler);

  // ==========================================================================
  // HOOKS
  // ==========================================================================

  // Log des requêtes
  app.addHook('onResponse', (request, reply, done) => {
    const duration = reply.getResponseTime().toFixed(2);
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration: `${duration}ms`,
      },
      'Request completed'
    );
    done();
  });

  return app;
}

// =============================================================================
// START SERVER
// =============================================================================

async function start() {
  const app = await buildApp();

  const port = parseInt(process.env.PORT || '3001', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    logger.info(`🚀 Server running at http://${host}:${port}`);
    logger.info(`📚 Documentation at http://${host}:${port}/docs`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

start();

export { buildApp };
