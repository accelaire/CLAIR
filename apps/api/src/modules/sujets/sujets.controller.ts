// =============================================================================
// Module Sujets V2 - Controller (Routes publiques, lecture seule)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { SujetsService } from './sujets.service';
import {
  sujetsListQuerySchema,
  sujetParamsSchema,
  sujetScrutinsQuerySchema,
  sujetDossiersQuerySchema,
} from './sujets.schema';
import { ApiError } from '../../utils/errors';

const CACHE_TTL_1H = 3600;
const CACHE_TTL_3H = 10800;
const CACHE_TTL_15MIN = 900;
const CACHE_TTL_12H = 43200;

export const sujetsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new SujetsService(fastify.prisma);

  // ===========================================================================
  // GET /api/v1/sujets - Liste des sujets
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Sujets'],
      summary: 'Liste des sujets',
      description: 'Retourne la liste paginée des sujets avec leurs statistiques',
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
      if (cached) return JSON.parse(cached);

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
      if (cached) return JSON.parse(cached);

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
      if (cached) return JSON.parse(cached);

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
        properties: { slug: { type: 'string' } },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);

      const cacheKey = `sujets:detail:${slug}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const sujet = await service.getBySlug(slug);
      if (!sujet) throw new ApiError(404, 'Sujet non trouvé');

      const result = { data: sujet };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/sujets/:slug/archive - Sort d'un slug de sujet désactivé
  // ===========================================================================
  fastify.get('/:slug/archive', {
    schema: {
      tags: ['Sujets'],
      summary: 'Destination d\'un sujet désactivé',
      description:
        'Pour un sujet désactivé, renvoie l\'UID de son dossier unique s\'il n\'en portait qu\'un (cible de redirection permanente), sinon null. 404 si le slug est inconnu ou toujours actif.',
      params: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string' } },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);

      const cacheKey = `sujets:archive:${slug}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const resolution = await service.resolveArchivedSlug(slug);
      if (!resolution) throw new ApiError(404, 'Sujet non trouvé');

      const result = { data: resolution };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/sujets/:slug/documents-lies - Documents sans vote liés au sujet
  // ===========================================================================
  fastify.get('/:slug/documents-lies', {
    schema: {
      tags: ['Sujets'],
      summary: 'Documents liés à un sujet',
      description:
        'Rapports d\'information, missions d\'application et textes non votés citant la loi du sujet. Absents de la liste des dossiers, qui exige au moins un scrutin.',
      params: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string' } },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);

      const cacheKey = `sujets:documents-lies:${slug}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const documents = await service.getDocumentsLies(slug);
      if (documents === null) throw new ApiError(404, 'Sujet non trouvé');

      const result = { data: documents };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/sujets/:slug/dossiers - Dossiers d'un sujet
  // ===========================================================================
  fastify.get('/:slug/dossiers', {
    schema: {
      tags: ['Sujets'],
      summary: 'Dossiers d\'un sujet',
      description: 'Retourne les dossiers législatifs associés à un sujet',
      params: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);
      const query = sujetDossiersQuerySchema.parse(request.query);

      const cacheKey = `sujets:dossiers:${slug}:${JSON.stringify(query)}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const result = await service.getDossiers(slug, query);
      if (!result) throw new ApiError(404, 'Sujet non trouvé');

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
        properties: { slug: { type: 'string' } },
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
      if (cached) return JSON.parse(cached);

      const result = await service.getScrutins(slug, query);
      if (!result) throw new ApiError(404, 'Sujet non trouvé');

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/sujets/:slug/presse - Articles de presse (live + cache)
  // ===========================================================================
  fastify.get('/:slug/presse', {
    schema: {
      tags: ['Sujets'],
      summary: 'Presse d\'un sujet',
      description: 'Articles de presse récupérés en live via Google Actualités (cache ~3h). Liens-only.',
      params: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string' } },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);

      const cacheKey = `sujets:presse:${slug}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const result = await service.getPresse(slug);
      if (!result) throw new ApiError(404, 'Sujet non trouvé');

      // Flux non vide → cache 3h (frais mais pas figé) ; flux vide → 15 min
      // pour réessayer rapidement en cas d'échec réseau transitoire.
      const ttl = result.data.length > 0 ? CACHE_TTL_3H : CACHE_TTL_15MIN;
      await fastify.redis.setex(cacheKey, ttl, JSON.stringify(result));
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
        properties: { slug: { type: 'string' } },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = sujetParamsSchema.parse(request.params);

      const cacheKey = `sujets:stats:${slug}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const result = await service.getVoteStats(slug);
      if (!result) throw new ApiError(404, 'Sujet non trouvé');

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });
};
