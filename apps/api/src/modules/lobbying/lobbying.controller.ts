// =============================================================================
// Module Lobbying - Controller (Routes)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../utils/errors';

// Schemas
const lobbyistesListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['entreprise', 'association', 'cabinet', 'syndicat', 'organisation_pro']).optional(),
  secteur: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['nom', 'budget', 'actions']).default('nom'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const lobbyisteParamsSchema = z.object({
  id: z.string().uuid(),
});

export const lobbyingRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET /api/v1/lobbying - Liste des lobbyistes
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Lobbying'],
      summary: 'Liste des représentants d\'intérêts',
      description: 'Retourne la liste paginée des lobbyistes enregistrés (données HATVP)',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          type: { type: 'string', enum: ['entreprise', 'association', 'cabinet', 'syndicat', 'organisation_pro'] },
          secteur: { type: 'string', description: 'Secteur d\'activité' },
          search: { type: 'string', description: 'Recherche par nom' },
          sort: { type: 'string', enum: ['nom', 'budget', 'actions'], default: 'nom' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        },
      },
    },
    handler: async (request, reply) => {
      const query = lobbyistesListQuerySchema.parse(request.query);
      const { page, limit, type, secteur, search, sort, order } = query;
      const skip = (page - 1) * limit;

      const where = {
        ...(type && { type }),
        ...(secteur && { secteur: { contains: secteur, mode: 'insensitive' as const } }),
        ...(search && { nom: { contains: search, mode: 'insensitive' as const } }),
      };

      const orderByMap: Record<string, any> = {
        nom: { nom: order },
        budget: { budgetAnnuel: order },
      };

      const [lobbyistes, total] = await Promise.all([
        fastify.prisma.lobbyiste.findMany({
          where,
          include: {
            _count: { select: { actions: true } },
          },
          orderBy: orderByMap[sort] || { nom: order },
          skip,
          take: limit,
        }),
        fastify.prisma.lobbyiste.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: lobbyistes.map((l) => ({
          ...l,
          actionsCount: l._count.actions,
          _count: undefined,
        })),
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
  // GET /api/v1/lobbying/secteurs - Liste des secteurs
  // ===========================================================================
  fastify.get('/secteurs', {
    schema: {
      tags: ['Lobbying'],
      summary: 'Liste des secteurs',
      description: 'Retourne tous les secteurs d\'activité avec leur count',
    },
    handler: async (request, reply) => {
      const lobbyistes = await fastify.prisma.lobbyiste.groupBy({
        by: ['secteur'],
        _count: { secteur: true },
        where: { secteur: { not: null } },
        orderBy: { _count: { secteur: 'desc' } },
      });

      const secteurs = lobbyistes
        .filter((l) => l.secteur)
        .map((l) => ({
          name: l.secteur,
          count: l._count.secteur,
        }));

      return { data: secteurs };
    },
  });

  // ===========================================================================
  // GET /api/v1/lobbying/stats - Statistiques globales
  // ===========================================================================
  fastify.get('/stats', {
    schema: {
      tags: ['Lobbying'],
      summary: 'Statistiques du lobbying',
      description: 'Retourne des statistiques globales sur le lobbying en France',
    },
    handler: async (request, reply) => {
      const [
        totalLobbyistes,
        totalActions,
        budgetTotal,
        byType,
        topSecteurs,
      ] = await Promise.all([
        fastify.prisma.lobbyiste.count(),
        fastify.prisma.actionLobby.count(),
        fastify.prisma.lobbyiste.aggregate({
          _sum: { budgetAnnuel: true },
        }),
        fastify.prisma.lobbyiste.groupBy({
          by: ['type'],
          _count: { type: true },
        }),
        fastify.prisma.lobbyiste.groupBy({
          by: ['secteur'],
          _count: { secteur: true },
          where: { secteur: { not: null } },
          orderBy: { _count: { secteur: 'desc' } },
          take: 10,
        }),
      ]);

      return {
        data: {
          totalLobbyistes,
          totalActions,
          budgetTotal: budgetTotal._sum.budgetAnnuel || 0,
          byType: byType.map((t) => ({ type: t.type, count: t._count.type })),
          topSecteurs: topSecteurs.map((s) => ({ secteur: s.secteur, count: s._count.secteur })),
        },
      };
    },
  });

  // ===========================================================================
  // GET /api/v1/lobbying/:id - Détail d'un lobbyiste
  // ===========================================================================
  fastify.get('/:id', {
    schema: {
      tags: ['Lobbying'],
      summary: 'Détail d\'un lobbyiste',
      description: 'Retourne les informations détaillées d\'un représentant d\'intérêts',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = lobbyisteParamsSchema.parse(request.params);

      const lobbyiste = await fastify.prisma.lobbyiste.findUnique({
        where: { id },
        include: {
          actions: {
            include: {
              depute: {
                select: {
                  id: true,
                  slug: true,
                  nom: true,
                  prenom: true,
                  photoUrl: true,
                  groupe: {
                    select: { slug: true, nom: true, couleur: true },
                  },
                },
              },
            },
            orderBy: { dateDebut: 'desc' },
            take: 50,
          },
        },
      });

      if (!lobbyiste) {
        throw new ApiError(404, 'Lobbyiste non trouvé');
      }

      return { data: lobbyiste };
    },
  });

  // ===========================================================================
  // GET /api/v1/lobbying/:id/actions - Actions d'un lobbyiste
  // ===========================================================================
  fastify.get('/:id/actions', {
    schema: {
      tags: ['Lobbying'],
      summary: 'Actions d\'un lobbyiste',
      description: 'Retourne la liste des actions d\'influence d\'un lobbyiste',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          cible: { type: 'string', enum: ['depute', 'ministre', 'administration'] },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = lobbyisteParamsSchema.parse(request.params);
      const { page = 1, limit = 20, cible } = request.query as any;
      const skip = (page - 1) * limit;

      const lobbyiste = await fastify.prisma.lobbyiste.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!lobbyiste) {
        throw new ApiError(404, 'Lobbyiste non trouvé');
      }

      const where = {
        lobbyisteId: id,
        ...(cible && { cible }),
      };

      const [actions, total] = await Promise.all([
        fastify.prisma.actionLobby.findMany({
          where,
          include: {
            depute: {
              select: {
                id: true,
                slug: true,
                nom: true,
                prenom: true,
                groupe: { select: { nom: true, couleur: true } },
              },
            },
          },
          orderBy: { dateDebut: 'desc' },
          skip,
          take: limit,
        }),
        fastify.prisma.actionLobby.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: actions,
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
  // GET /api/v1/lobbying/actions/recent - Actions récentes
  // ===========================================================================
  fastify.get('/actions/recent', {
    schema: {
      tags: ['Lobbying'],
      summary: 'Actions de lobbying récentes',
      description: 'Retourne les dernières actions de lobbying déclarées',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          secteur: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { limit = 20, secteur } = request.query as { limit?: number; secteur?: string };

      const actions = await fastify.prisma.actionLobby.findMany({
        where: {
          ...(secteur && { lobbyiste: { secteur: { contains: secteur, mode: 'insensitive' } } }),
        },
        include: {
          lobbyiste: {
            select: { id: true, nom: true, type: true, secteur: true },
          },
          depute: {
            select: {
              id: true,
              slug: true,
              nom: true,
              prenom: true,
              groupe: { select: { nom: true, couleur: true } },
            },
          },
        },
        orderBy: { dateDebut: 'desc' },
        take: limit,
      });

      return { data: actions };
    },
  });
};
