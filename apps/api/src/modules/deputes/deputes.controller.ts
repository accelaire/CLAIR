// =============================================================================
// Module Députés - Controller (Routes)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { DeputesService } from './deputes.service';
import {
  deputeParamsSchema,
  deputeQuerySchema,
  deputesListQuerySchema,
  deputeVotesQuerySchema,
} from './deputes.schema';
import { ApiError } from '../../utils/errors';

export const deputesRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new DeputesService(fastify.prisma, fastify.redis);

  // ===========================================================================
  // GET /api/v1/deputes - Liste des députés
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Députés'],
      summary: 'Liste des députés',
      description: 'Retourne la liste paginée des députés avec filtres et tri',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          groupe: { type: 'string', description: 'Slug du groupe politique' },
          departement: { type: 'string', description: 'Numéro du département' },
          search: { type: 'string', description: 'Recherche par nom/prénom' },
          actif: { type: 'boolean', default: true },
          sort: { type: 'string', enum: ['nom', 'prenom', 'presence', 'loyaute', 'activite'], default: 'nom' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                totalPages: { type: 'integer' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const query = deputesListQuerySchema.parse(request.query);
      const result = await service.getDeputes(query);
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/deputes/groupes - Liste des groupes politiques
  // ===========================================================================
  fastify.get('/groupes', {
    schema: {
      tags: ['Députés'],
      summary: 'Liste des groupes politiques',
      description: 'Retourne tous les groupes politiques actifs avec le nombre de membres',
    },
    handler: async (_request, _reply) => {
      const groupes = await service.getGroupes();
      return { data: groupes };
    },
  });

  // ===========================================================================
  // GET /api/v1/deputes/compare - Comparer des députés
  // ===========================================================================
  fastify.get('/compare', {
    schema: {
      tags: ['Députés'],
      summary: 'Comparer des députés',
      description: 'Compare 2 à 4 députés par leurs statistiques',
      querystring: {
        type: 'object',
        required: ['slugs'],
        properties: {
          slugs: { 
            type: 'string', 
            description: 'Slugs des députés séparés par des virgules (2-4)' 
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slugs } = request.query as { slugs: string };
      const slugList = slugs.split(',').map((s) => s.trim()).filter(Boolean);

      if (slugList.length < 2 || slugList.length > 4) {
        throw new ApiError(400, 'Veuillez fournir entre 2 et 4 slugs de députés');
      }

      const deputes = await service.compareDeputes(slugList);
      return { data: deputes };
    },
  });

  // ===========================================================================
  // GET /api/v1/deputes/:slug - Détail d'un député
  // ===========================================================================
  fastify.get('/:slug', {
    schema: {
      tags: ['Députés'],
      summary: 'Détail d\'un député',
      description: 'Retourne les informations détaillées d\'un député',
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string', description: 'Slug unique du député' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          include: {
            type: 'string',
            description: 'Relations à inclure (votes,interventions,amendements,stats)'
          },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = deputeParamsSchema.parse(request.params);
      const { include } = deputeQuerySchema.parse(request.query);

      const depute = await service.getDeputeBySlug(slug, include);

      if (!depute) {
        throw new ApiError(404, 'Député non trouvé');
      }

      return { data: depute };
    },
  });

  // ===========================================================================
  // GET /api/v1/deputes/:slug/stats - Statistiques d'un député
  // ===========================================================================
  fastify.get('/:slug/stats', {
    schema: {
      tags: ['Députés'],
      summary: 'Statistiques d\'un député',
      description: 'Retourne les statistiques calculées d\'un député',
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = deputeParamsSchema.parse(request.params);

      const parlementaire = await fastify.prisma.parlementaire.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!parlementaire) {
        throw new ApiError(404, 'Député non trouvé');
      }

      const stats = await service.getDeputeStats(parlementaire.id);
      return { data: stats };
    },
  });

  // ===========================================================================
  // GET /api/v1/deputes/:slug/votes - Votes d'un député
  // ===========================================================================
  fastify.get('/:slug/votes', {
    schema: {
      tags: ['Députés'],
      summary: 'Votes d\'un député',
      description: 'Retourne l\'historique des votes d\'un député',
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
          position: { type: 'string', enum: ['pour', 'contre', 'abstention', 'absent'] },
          tag: { type: 'string', description: 'Filtrer par tag de scrutin' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = deputeParamsSchema.parse(request.params);
      const query = deputeVotesQuerySchema.parse(request.query);

      const parlementaire = await fastify.prisma.parlementaire.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!parlementaire) {
        throw new ApiError(404, 'Député non trouvé');
      }

      const result = await service.getDeputeVotes(parlementaire.id, query);
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/deputes/:slug/amendements - Amendements d'un député
  // ===========================================================================
  fastify.get('/:slug/amendements', {
    schema: {
      tags: ['Députés'],
      summary: 'Amendements d\'un député',
      description: 'Retourne les amendements déposés par un député',
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
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          sort: { type: 'string', enum: ['Adopté', 'Rejeté', 'Retiré', 'Non soutenu', 'Tombé'] },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = deputeParamsSchema.parse(request.params);
      const { page = 1, limit = 20, sort } = request.query as any;

      const parlementaire = await fastify.prisma.parlementaire.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!parlementaire) {
        throw new ApiError(404, 'Député non trouvé');
      }

      const skip = (page - 1) * limit;

      // Query by parlementaireId OR by auteurLibelle containing the député's name
      const [amendements, total] = await Promise.all([
        fastify.prisma.amendement.findMany({
          where: {
            OR: [
              { parlementaireId: parlementaire.id },
              // Fallback: search by auteurLibelle if no direct link
            ],
            ...(sort && { sort }),
          },
          orderBy: { dateDepot: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            uid: true,
            numero: true,
            legislature: true,
            texteRef: true,
            articleVise: true,
            dispositif: true,
            exposeSommaire: true,
            auteurLibelle: true,
            sort: true,
            dateDepot: true,
            dateSort: true,
          },
        }),
        fastify.prisma.amendement.count({
          where: {
            OR: [
              { parlementaireId: parlementaire.id },
            ],
            ...(sort && { sort }),
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: amendements,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    },
  });

  // ===========================================================================
  // GET /api/v1/deputes/:slug/interventions - Interventions d'un député
  // ===========================================================================
  fastify.get('/:slug/interventions', {
    schema: {
      tags: ['Députés'],
      summary: 'Interventions d\'un député',
      description: 'Retourne les interventions d\'un député',
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
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          type: { type: 'string', enum: ['question', 'intervention', 'explication_vote'] },
        },
      },
    },
    handler: async (request, _reply) => {
      const { slug } = deputeParamsSchema.parse(request.params);
      const { page = 1, limit = 20, type } = request.query as any;

      const parlementaire = await fastify.prisma.parlementaire.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!parlementaire) {
        throw new ApiError(404, 'Député non trouvé');
      }

      const skip = (page - 1) * limit;

      const [interventions, total] = await Promise.all([
        fastify.prisma.intervention.findMany({
          where: {
            parlementaireId: parlementaire.id,
            ...(type && { type }),
          },
          orderBy: { date: 'desc' },
          skip,
          take: limit,
        }),
        fastify.prisma.intervention.count({
          where: {
            parlementaireId: parlementaire.id,
            ...(type && { type }),
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: interventions,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    },
  });
};
