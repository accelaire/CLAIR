// =============================================================================
// Module Auth - Controller (Routes)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { ApiError } from '../../utils/errors';

const scryptAsync = promisify(scrypt);

// Schemas
const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  nom: z.string().optional(),
  prenom: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// Helpers
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuffer = Buffer.from(key, 'hex');
  return timingSafeEqual(derivedKey, keyBuffer);
}

function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // POST /api/v1/auth/register - Inscription
  // ===========================================================================
  fastify.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Inscription',
      description: 'Créer un nouveau compte utilisateur',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          nom: { type: 'string' },
          prenom: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const data = registerSchema.parse(request.body);

      // Vérifier si l'email existe déjà
      const existing = await fastify.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        throw new ApiError(409, 'Cet email est déjà utilisé');
      }

      // Hasher le mot de passe
      const passwordHash = await hashPassword(data.password);

      // Créer l'utilisateur
      const user = await fastify.prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          nom: data.nom,
          prenom: data.prenom,
        },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          role: true,
          createdAt: true,
        },
      });

      // Générer les tokens
      const accessToken = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = generateRefreshToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await fastify.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt,
        },
      });

      return {
        user,
        accessToken,
        refreshToken,
      };
    },
  });

  // ===========================================================================
  // POST /api/v1/auth/login - Connexion
  // ===========================================================================
  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Connexion',
      description: 'Se connecter avec email et mot de passe',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { email, password } = loginSchema.parse(request.body);

      const user = await fastify.prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.passwordHash) {
        throw new ApiError(401, 'Email ou mot de passe incorrect');
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        throw new ApiError(401, 'Email ou mot de passe incorrect');
      }

      // Générer les tokens
      const accessToken = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = generateRefreshToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await fastify.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt,
        },
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          nom: user.nom,
          prenom: user.prenom,
          role: user.role,
        },
        accessToken,
        refreshToken,
      };
    },
  });

  // ===========================================================================
  // POST /api/v1/auth/refresh - Rafraîchir le token
  // ===========================================================================
  fastify.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Rafraîchir le token',
      description: 'Obtenir un nouveau access token avec le refresh token',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { refreshToken } = refreshSchema.parse(request.body);

      const storedToken = await fastify.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken) {
        throw new ApiError(401, 'Refresh token invalide');
      }

      if (storedToken.expiresAt < new Date()) {
        await fastify.prisma.refreshToken.delete({
          where: { id: storedToken.id },
        });
        throw new ApiError(401, 'Refresh token expiré');
      }

      // Générer un nouveau access token
      const accessToken = fastify.jwt.sign({
        userId: storedToken.user.id,
        email: storedToken.user.email,
        role: storedToken.user.role,
      });

      // Optionnel : rotation du refresh token
      const newRefreshToken = generateRefreshToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await fastify.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          token: newRefreshToken,
          expiresAt,
        },
      });

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    },
  });

  // ===========================================================================
  // POST /api/v1/auth/logout - Déconnexion
  // ===========================================================================
  fastify.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Déconnexion',
      description: 'Invalider le refresh token',
      body: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken?: string };

      if (refreshToken) {
        await fastify.prisma.refreshToken.deleteMany({
          where: { token: refreshToken },
        });
      }

      return { success: true };
    },
  });

  // ===========================================================================
  // GET /api/v1/auth/me - Profil utilisateur
  // ===========================================================================
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Profil utilisateur',
      description: 'Retourne les informations de l\'utilisateur connecté',
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const { userId } = request.user;

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          role: true,
          preferences: true,
          createdAt: true,
          _count: {
            select: {
              alertes: true,
              favoris: true,
            },
          },
        },
      });

      if (!user) {
        throw new ApiError(404, 'Utilisateur non trouvé');
      }

      return {
        data: {
          ...user,
          alertesCount: user._count.alertes,
          favorisCount: user._count.favoris,
          _count: undefined,
        },
      };
    },
  });

  // ===========================================================================
  // PATCH /api/v1/auth/me - Mettre à jour le profil
  // ===========================================================================
  fastify.patch('/me', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Mettre à jour le profil',
      description: 'Modifier les informations de l\'utilisateur connecté',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          nom: { type: 'string' },
          prenom: { type: 'string' },
          preferences: { type: 'object' },
        },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user;
      const { nom, prenom, preferences } = request.body as any;

      const user = await fastify.prisma.user.update({
        where: { id: userId },
        data: {
          ...(nom !== undefined && { nom }),
          ...(prenom !== undefined && { prenom }),
          ...(preferences !== undefined && { preferences }),
        },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          role: true,
          preferences: true,
        },
      });

      return { data: user };
    },
  });
};
