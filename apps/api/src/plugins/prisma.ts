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

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
    // Limit connection pool for Railway's limited resources
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  // Add connection pool limits via DATABASE_URL params or use defaults
  // Railway PostgreSQL typically allows 20-100 connections
  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
  });

  fastify.log.info('Prisma connected');
};

export default fp(prismaPlugin, {
  name: 'prisma',
});

export { prismaPlugin };
