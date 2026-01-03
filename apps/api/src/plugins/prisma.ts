// =============================================================================
// Plugin Prisma pour Fastify
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Add connection pool limits to DATABASE_URL if not present
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }

  // Parse URL and add pool limits if not present
  const urlObj = new URL(url);

  // Limit pool for Railway's limited memory (512MB container)
  // connection_limit: max connections in pool (increased from 5 to 15 for better concurrency)
  // pool_timeout: how long to wait for a connection
  if (!urlObj.searchParams.has('connection_limit')) {
    urlObj.searchParams.set('connection_limit', '15');
  }
  if (!urlObj.searchParams.has('pool_timeout')) {
    urlObj.searchParams.set('pool_timeout', '10');
  }

  return urlObj.toString();
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

  try {
    await prisma.$connect();
    fastify.log.info('Prisma connected');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to connect to database');
    throw error;
  }

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    fastify.log.info('Disconnecting Prisma...');
    await instance.prisma.$disconnect();
  });
};

export default fp(prismaPlugin, {
  name: 'prisma',
});

export { prismaPlugin };
