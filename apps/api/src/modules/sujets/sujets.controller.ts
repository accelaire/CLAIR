// =============================================================================
// Module Sujets - Controller (Routes)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { SujetsService } from './sujets.service';
import {
  sujetsListQuerySchema,
  sujetParamsSchema,
  sujetScrutinsQuerySchema,
  createSujetSchema,
  updateSujetSchema,
  linkScrutinSchema,
  mergeSujetsSchema,
} from './sujets.schema';
import { ApiError } from '../../utils/errors';

// Cache TTL
const CACHE_TTL_1H = 3600;
const CACHE_TTL_12H = 43200;

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

export const sujetsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new SujetsService(fastify.prisma);

  // ===========================================================================
  // GET /api/v1/sujets - Liste des sujets
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Sujets'],
      summary: 'Liste des sujets',
      description: 'Retourne la liste paginée des sujets (thématiques) avec leurs statistiques',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          category: { type: 'string', description: 'Filtrer par catégorie' },
          search: { type: 'string', description: 'Recherche dans le label' },
          featured: { type: 'boolean', description: 'Filtrer les sujets mis en avant' },
        },
      },
    },
    handler: async (request, _reply) => {
      const query = sujetsListQuerySchema.parse(request.query);

      const cacheKey = `sujets:list:${JSON.stringify(query)}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await service.list(query);

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));

      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/sujets/featured - Sujets mis en avant
  // ===========================================================================
  fastify.get('/featured', {
    schema: {
      tags: ['Sujets'],
      summary: 'Sujets mis en avant',
      description: 'Retourne les sujets featured pour la homepage',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 6 },
        },
      },
    },
    handler: async (request, _reply) => {
      const { limit = 6 } = request.query as { limit?: number };

      const cacheKey = `sujets:featured:${limit}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await service.getFeatured(limit);

      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(result));

      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/sujets/categories - Catégories disponibles
  // ===========================================================================
  fastify.get('/categories', {
    schema: {
      tags: ['Sujets'],
      summary: 'Liste des catégories',
      description: 'Retourne toutes les catégories de sujets avec leur count',
    },
    handler: async (_request, _reply) => {
      const cacheKey = 'sujets:categories';
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const categories = await fastify.prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
        SELECT category, COUNT(*) as count
        FROM sujets
        WHERE actif = true AND category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `;

      const result = {
        data: categories.map(c => ({
          name: c.category,
          count: Number(c.count),
        })),
      };

      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(result));

      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/sujets/:slug - Détail d'un sujet
  // ===========================================================================
  fastify.get('/:slug', {
    schema: {
      tags: ['Sujets'],
      summary: 'Détail d\'un sujet',
      description: 'Retourne les informations détaillées d\'un sujet',
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);

      const cacheKey = `sujets:detail:${slug}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const sujet = await service.getBySlug(slug);

      if (!sujet) {
        throw new ApiError(404, 'Sujet non trouvé');
      }

      const result = { data: sujet };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));

      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/sujets/:slug/scrutins - Scrutins d'un sujet
  // ===========================================================================
  fastify.get('/:slug/scrutins', {
    schema: {
      tags: ['Sujets'],
      summary: 'Scrutins d\'un sujet',
      description: 'Retourne les scrutins associés à un sujet avec pagination',
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          chambre: { type: 'string', enum: ['assemblee', 'senat'] },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);
      const query = sujetScrutinsQuerySchema.parse(request.query);

      const cacheKey = `sujets:scrutins:${slug}:${JSON.stringify(query)}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await service.getScrutins(slug, query);

      if (!result) {
        throw new ApiError(404, 'Sujet non trouvé');
      }

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));

      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/sujets/:slug/stats - Stats de votes par groupe
  // ===========================================================================
  fastify.get('/:slug/stats', {
    schema: {
      tags: ['Sujets'],
      summary: 'Stats d\'un sujet',
      description: 'Retourne les statistiques de votes par groupe pour un sujet',
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);

      const cacheKey = `sujets:stats:${slug}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await service.getVoteStats(slug);

      if (!result) {
        throw new ApiError(404, 'Sujet non trouvé');
      }

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));

      return result;
    },
  });
};

// =============================================================================
// ADMIN ROUTES
// =============================================================================

export const sujetsAdminRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new SujetsService(fastify.prisma);

  // TODO: Add authentication middleware for admin routes
  // fastify.addHook('preHandler', fastify.authenticate);

  // ===========================================================================
  // POST /api/v1/admin/sujets - Créer un sujet
  // ===========================================================================
  fastify.post('/', {
    schema: {
      tags: ['Admin - Sujets'],
      summary: 'Créer un sujet',
      description: 'Crée un nouveau sujet manuellement',
    },
    handler: async (request, _reply) => {
      const input = createSujetSchema.parse(request.body);

      // Vérifier que le slug n'existe pas déjà
      const existing = await fastify.prisma.sujet.findUnique({
        where: { slug: input.slug },
      });
      if (existing) {
        throw new ApiError(400, 'Ce slug existe déjà');
      }

      const sujet = await service.create(input);

      // Invalider le cache
      await invalidateSujetsCache(fastify);

      return { data: sujet };
    },
  });

  // ===========================================================================
  // PATCH /api/v1/admin/sujets/:slug - Modifier un sujet
  // ===========================================================================
  fastify.patch('/:slug', {
    schema: {
      tags: ['Admin - Sujets'],
      summary: 'Modifier un sujet',
      description: 'Met à jour les informations d\'un sujet',
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);
      const input = updateSujetSchema.parse(request.body);

      // Vérifier que le sujet existe
      const existing = await fastify.prisma.sujet.findUnique({
        where: { slug },
      });
      if (!existing) {
        throw new ApiError(404, 'Sujet non trouvé');
      }

      // Si on change le slug, vérifier qu'il n'existe pas déjà
      if (input.slug && input.slug !== slug) {
        const slugExists = await fastify.prisma.sujet.findUnique({
          where: { slug: input.slug },
        });
        if (slugExists) {
          throw new ApiError(400, 'Ce slug existe déjà');
        }
      }

      const sujet = await service.update(slug, input);

      // Invalider le cache
      await invalidateSujetsCache(fastify);

      return { data: sujet };
    },
  });

  // ===========================================================================
  // DELETE /api/v1/admin/sujets/:slug - Désactiver un sujet
  // ===========================================================================
  fastify.delete('/:slug', {
    schema: {
      tags: ['Admin - Sujets'],
      summary: 'Désactiver un sujet',
      description: 'Désactive un sujet (soft delete)',
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);

      const existing = await fastify.prisma.sujet.findUnique({
        where: { slug },
      });
      if (!existing) {
        throw new ApiError(404, 'Sujet non trouvé');
      }

      await service.deactivate(slug);

      // Invalider le cache
      await invalidateSujetsCache(fastify);

      return { success: true };
    },
  });

  // ===========================================================================
  // POST /api/v1/admin/sujets/:slug/scrutins - Lier un scrutin
  // ===========================================================================
  fastify.post('/:slug/scrutins', {
    schema: {
      tags: ['Admin - Sujets'],
      summary: 'Lier un scrutin',
      description: 'Associe manuellement un scrutin à un sujet',
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);
      const { scrutinId, similarity } = linkScrutinSchema.parse(request.body);

      const result = await service.linkScrutin(slug, scrutinId, similarity);

      if (!result) {
        throw new ApiError(404, 'Sujet non trouvé');
      }

      // Invalider le cache
      await invalidateSujetsCache(fastify);

      return result;
    },
  });

  // ===========================================================================
  // DELETE /api/v1/admin/sujets/:slug/scrutins/:scrutinId - Délier un scrutin
  // ===========================================================================
  fastify.delete('/:slug/scrutins/:scrutinId', {
    schema: {
      tags: ['Admin - Sujets'],
      summary: 'Délier un scrutin',
      description: 'Supprime l\'association entre un scrutin et un sujet',
      params: {
        type: 'object',
        required: ['slug', 'scrutinId'],
        properties: {
          slug: { type: 'string' },
          scrutinId: { type: 'string' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug, scrutinId } = request.params as { slug: string; scrutinId: string };

      const result = await service.unlinkScrutin(slug, scrutinId);

      if (!result) {
        throw new ApiError(404, 'Sujet non trouvé');
      }

      // Invalider le cache
      await invalidateSujetsCache(fastify);

      return result;
    },
  });

  // ===========================================================================
  // POST /api/v1/admin/sujets/:slug/merge - Fusionner des sujets
  // ===========================================================================
  fastify.post('/:slug/merge', {
    schema: {
      tags: ['Admin - Sujets'],
      summary: 'Fusionner des sujets',
      description: 'Fusionne le sujet source dans le sujet target',
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string', description: 'Slug du sujet source (sera désactivé)' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);
      const { targetSlug } = mergeSujetsSchema.parse(request.body);

      if (slug === targetSlug) {
        throw new ApiError(400, 'Impossible de fusionner un sujet avec lui-même');
      }

      const result = await service.merge(slug, targetSlug);

      if (!result) {
        throw new ApiError(404, 'Sujet source ou target non trouvé');
      }

      // Invalider le cache
      await invalidateSujetsCache(fastify);

      return result;
    },
  });
};

// =============================================================================
// HELPERS
// =============================================================================

async function invalidateSujetsCache(fastify: any) {
  // Supprimer les clés de cache liées aux sujets
  const keys = await fastify.redis.keys('sujets:*');
  if (keys.length > 0) {
    await fastify.redis.del(...keys);
  }
}

export default {
  sujetsRoutes,
  sujetsAdminRoutes,
};
