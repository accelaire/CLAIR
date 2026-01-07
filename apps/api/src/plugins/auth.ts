// =============================================================================
// Plugin Auth pour Fastify
// =============================================================================

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateOptional: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      email: string;
      role: string;
    };
    user: {
      userId: string;
      email: string;
      role: string;
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
  });

  // Décorateur pour routes protégées
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ 
        error: 'Unauthorized',
        message: 'Token invalide ou expiré',
      });
    }
  });

  // Décorateur pour routes avec auth optionnelle
  fastify.decorate('authenticateOptional', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      // Ignore l'erreur, l'utilisateur reste non authentifié
    }
  });
};

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['prisma'],
});

export { authPlugin };
