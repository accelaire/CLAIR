// =============================================================================
// CLAIR API - Entry Point
// =============================================================================

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { prismaPlugin } from './plugins/prisma';
import { redisPlugin } from './plugins/redis';
import { rateLimitPlugin } from './plugins/rate-limit';


import { deputesRoutes, senateursRoutes, parlementairesRoutes } from './modules/parlementaires/parlementaires.controller';
import { scrutinsRoutes } from './modules/scrutins/scrutins.controller';
import { lobbyingRoutes } from './modules/lobbying/lobbying.controller';
import { searchRoutes } from './modules/search/search.controller';
import { healthRoutes } from './modules/health/health.controller';
import { analyticsRoutes } from './modules/analytics/analytics.controller';
import { groupesRoutes } from './modules/groupes/groupes.controller';
import { commissionsRoutes } from './modules/commissions/commissions.controller';
import { agendaRoutes } from './modules/agenda/agenda.controller';
import { homepageRoutes } from './modules/homepage/homepage.controller';
import { dossiersRoutes } from './modules/dossiers/dossiers.controller';
import { sujetsRoutes } from './modules/sujets/sujets.controller';
import { feedbackRoutes } from './modules/feedback/feedback.controller';

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

  const isProduction = process.env.NODE_ENV === 'production';
  const serverUrl = isProduction
    ? process.env.API_URL || 'https://api.clair.vote'
    : process.env.API_URL || 'http://localhost:3001';

  // ==========================================================================
  // PLUGINS GLOBAUX
  // ==========================================================================

  // Sécurité
  await app.register(helmet, {
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      },
    } : false,
  });

  // Parse CORS origins from comma-separated string
  const getCorsOrigins = (): string[] | boolean => {
    if (!isProduction) return true;
    const origins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) || [];
    return origins.length > 0 ? origins : false;
  };

  await app.register(cors, {
    origin: getCorsOrigins(),
    credentials: true,
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
          url: serverUrl,
          description: isProduction ? 'Production' : 'Development',
        },
      ],
      tags: [
        { name: 'Health', description: 'Endpoints de santé' },
        { name: 'Parlementaires', description: 'Données sur tous les parlementaires (députés + sénateurs)' },
        { name: 'Députés', description: 'Données sur les députés de l\'Assemblée nationale' },
        { name: 'Sénateurs', description: 'Données sur les sénateurs' },
        { name: 'Groupes politiques', description: 'Groupes parlementaires de l\'AN et du Sénat' },
        { name: 'Scrutins', description: 'Votes à l\'Assemblée nationale et au Sénat' },
        { name: 'Lobbying', description: 'Données HATVP sur le lobbying' },
        { name: 'Search', description: 'Recherche globale' },
        { name: 'Analytics', description: 'Statistiques et analyses pour l\'explorateur' },
        { name: 'Dossiers', description: 'Dossiers législatifs' },
      ],
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
  await app.register(rateLimitPlugin); // Depends on redis — must come after

  // ==========================================================================
  // ROUTES
  // ==========================================================================

  // robots.txt — block all crawlers on the API domain
  app.get('/robots.txt', async (_request, reply) => {
    return reply
      .type('text/plain')
      .send('User-agent: *\nDisallow: /\n');
  });

  // Health check (pas de préfixe)
  await app.register(healthRoutes);

  // API v1
  await app.register(
    async (api) => {
      await api.register(parlementairesRoutes, { prefix: '/parlementaires' });
      await api.register(deputesRoutes, { prefix: '/deputes' });
      await api.register(senateursRoutes, { prefix: '/senateurs' });
      await api.register(groupesRoutes, { prefix: '/groupes' });
      await api.register(commissionsRoutes, { prefix: '/commissions' });
      await api.register(agendaRoutes, { prefix: '/agenda' });
      await api.register(scrutinsRoutes, { prefix: '/scrutins' });
      await api.register(lobbyingRoutes, { prefix: '/lobbying' });
      await api.register(searchRoutes, { prefix: '/search' });
      await api.register(analyticsRoutes, { prefix: '/analytics' });
      await api.register(homepageRoutes, { prefix: '/homepage' });
      await api.register(dossiersRoutes, { prefix: '/dossiers' });
      await api.register(sujetsRoutes, { prefix: '/sujets' });
      await api.register(feedbackRoutes, { prefix: '/feedback' });
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

  // Log des requêtes (using elapsedTime instead of deprecated getResponseTime)
  app.addHook('onResponse', (request, reply, done) => {
    const duration = reply.elapsedTime.toFixed(2);
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
// CACHE WARMING - Prevents cold start OOM on Railway
// =============================================================================

async function warmCache(fastifyApp: Awaited<ReturnType<typeof buildApp>>) {
  logger.info('Starting cache warming...');

  // Routes to warm - executed SEQUENTIALLY to avoid OOM
  // Homepage first (most important for cold start)
  const routesToWarm = [
    '/api/v1/homepage',           // Agrège stats + scrutins importants
    '/api/v1/deputes?limit=20',
    '/api/v1/senateurs?limit=20',
    '/api/v1/scrutins?limit=20',
    '/api/v1/deputes/groupes',
    '/api/v1/senateurs/groupes',
    '/api/v1/lobbying/stats',     // Stats lobbying (requêtes séquentielles)
    '/api/v1/lobbying/secteurs',  // Liste des secteurs
    '/api/v1/lobbying?limit=20',  // Liste des lobbyistes
  ];

  for (const route of routesToWarm) {
    try {
      const response = await fastifyApp.inject({
        method: 'GET',
        url: route,
      });
      logger.info({ route, status: response.statusCode }, 'Cache warmed');

      // Force garbage collection between routes if available
      if (global.gc) {
        global.gc();
      }

      // Small delay to let memory settle
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.warn({ route, error }, 'Failed to warm cache for route');
    }
  }

  logger.info('Cache warming complete');
}

// =============================================================================
// START SERVER
// =============================================================================

let app: Awaited<ReturnType<typeof buildApp>> | null = null;
let memoryMonitorInterval: NodeJS.Timeout | null = null;

// Memory monitoring - helps diagnose OOM kills
function logMemoryUsage() {
  const used = process.memoryUsage();
  const formatMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  logger.info({
    memory: {
      heapUsed: `${formatMB(used.heapUsed)}MB`,
      heapTotal: `${formatMB(used.heapTotal)}MB`,
      rss: `${formatMB(used.rss)}MB`,
      external: `${formatMB(used.external)}MB`,
    },
    uptime: `${process.uptime().toFixed(0)}s`,
  }, 'Memory usage');
}

async function start() {
  app = await buildApp();

  const port = parseInt(process.env.PORT || '3001', 10);
  const host = process.env.HOST || '0.0.0.0';
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    await app.listen({ port, host });
    logger.info(`🚀 Server running at http://${host}:${port}`);
    logger.info(`📚 Documentation at http://${host}:${port}/docs`);

    // Log initial memory usage
    logMemoryUsage();

    // Warm cache in production to prevent cold start OOM
    if (isProduction) {
      // Run cache warming in background (don't block server startup)
      warmCache(app).catch((err) => {
        logger.error({ err }, 'Cache warming failed');
      });

      // Monitor memory every 5 minutes
      memoryMonitorInterval = setInterval(logMemoryUsage, 5 * 60 * 1000);
    }
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Clear memory monitor
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
  }

  try {
    if (app) {
      // Log final memory usage before shutdown
      logMemoryUsage();
      await app.close();
      logger.info('Server closed');
    }
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors to prevent silent crashes
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception - process will exit');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  // Don't exit on unhandled rejection, just log it
});

start();

export { buildApp };
