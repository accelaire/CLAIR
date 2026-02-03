// =============================================================================
// Module Lobbying - Controller (Routes)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../utils/errors';
import { buildTextSearchCondition } from '../../utils/search';

// Cache TTL: 12 hours
const CACHE_TTL_12H = 43200;

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
    handler: async (request, _reply) => {
      const query = lobbyistesListQuerySchema.parse(request.query);
      const { page, limit, type, secteur, search, sort, order } = query;

      // Cache key based on query params
      const cacheKey = `lobbying:list:${JSON.stringify(query)}`;

      // Check cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const skip = (page - 1) * limit;

      const where = {
        ...(type && { type }),
        ...(secteur && { secteur: { contains: secteur, mode: 'insensitive' as const } }),
        ...(search && buildTextSearchCondition('nom', search)),
      };

      // Build orderBy based on sort field
      // Note: For budget sorting, we need to handle nulls properly
      // In PostgreSQL, nulls sort first in DESC order by default, which is not what we want
      let orderBy: any;
      switch (sort) {
        case 'budget':
          // nulls: 'last' for desc (big budgets first), 'first' for asc (no budget first)
          orderBy = { budgetAnnuel: { sort: order, nulls: order === 'desc' ? 'last' : 'first' } };
          break;
        case 'actions':
          orderBy = { actions: { _count: order } };
          break;
        default:
          orderBy = { nom: order };
      }

      const [lobbyistes, total] = await Promise.all([
        fastify.prisma.lobbyiste.findMany({
          where,
          include: {
            _count: { select: { actions: true } },
          },
          orderBy,
          skip,
          take: limit,
        }),
        fastify.prisma.lobbyiste.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
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

      // Cache for 1 hour
      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(result));

      return result;
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
    handler: async (_request, _reply) => {
      const cacheKey = 'lobbying:secteurs';

      // Check cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

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

      const result = { data: secteurs };

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(result));

      return result;
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
    handler: async (_request, _reply) => {
      const cacheKey = 'lobbying:stats';

      // Check cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Exécuter les requêtes SÉQUENTIELLEMENT pour éviter de saturer le pool
      // de connexions Prisma et provoquer des OOM sur cold start
      const totalLobbyistes = await fastify.prisma.lobbyiste.count();
      const totalActions = await fastify.prisma.actionLobby.count();

      const budgetTotal = await fastify.prisma.lobbyiste.aggregate({
        _sum: { budgetAnnuel: true },
      });

      const byType = await fastify.prisma.lobbyiste.groupBy({
        by: ['type'],
        _count: { type: true },
      });

      const topSecteurs = await fastify.prisma.lobbyiste.groupBy({
        by: ['secteur'],
        _count: { secteur: true },
        where: { secteur: { not: null } },
        orderBy: { _count: { secteur: 'desc' } },
        take: 10,
      });

      // Count distinct base secteurs (split by ", " since HATVP stores combinations)
      const totalSecteursResult = await fastify.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT DISTINCT LOWER(TRIM(s.secteur_split)) as secteur
          FROM lobbyistes l,
               LATERAL unnest(string_to_array(l.secteur, ', ')) AS s(secteur_split)
          WHERE l.secteur IS NOT NULL
        ) sub
      `;
      const totalSecteurs = Number(totalSecteursResult[0]?.count || 0);

      const response = {
        data: {
          totalLobbyistes,
          totalActions,
          budgetTotal: budgetTotal._sum.budgetAnnuel || 0,
          totalSecteurs,
          byType: byType.map((t) => ({ type: t.type, count: t._count.type })),
          topSecteurs: topSecteurs.map((s) => ({ secteur: s.secteur, count: s._count.secteur })),
        },
      };

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(response));

      return response;
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
    handler: async (request, _reply) => {
      const { id } = lobbyisteParamsSchema.parse(request.params);

      const lobbyiste = await fastify.prisma.lobbyiste.findUnique({
        where: { id },
        include: {
          actions: {
            include: {
              parlementaire: {
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
    handler: async (request, _reply) => {
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
            parlementaire: {
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
  // GET /api/v1/lobbying/actions - Toutes les actions de lobbying (paginé)
  // ===========================================================================
  fastify.get('/actions', {
    schema: {
      tags: ['Lobbying'],
      summary: 'Liste toutes les actions de lobbying',
      description: 'Retourne toutes les actions de lobbying avec pagination et filtres',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          cible: { type: 'string' },
          secteur: { type: 'string' },
          search: { type: 'string' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          sort: { type: 'string', enum: ['dateDebut', 'lobbyiste'], default: 'dateDebut' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
    },
    handler: async (request, _reply) => {
      const {
        page = 1,
        limit = 20,
        cible,
        secteur,
        search,
        dateFrom,
        dateTo,
        sort = 'dateDebut',
        order = 'desc',
      } = request.query as {
        page?: number;
        limit?: number;
        cible?: string;
        secteur?: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        sort?: 'dateDebut' | 'lobbyiste';
        order?: 'asc' | 'desc';
      };

      const skip = (page - 1) * limit;

      const where: any = {};

      if (cible) {
        where.cible = cible;
      }

      if (secteur) {
        where.lobbyiste = {
          secteur: { contains: secteur, mode: 'insensitive' },
        };
      }

      if (search) {
        where.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { lobbyiste: { nom: { contains: search, mode: 'insensitive' } } },
          { texteViseNom: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Filtre par période
      if (dateFrom || dateTo) {
        where.dateDebut = {};
        if (dateFrom) {
          where.dateDebut.gte = new Date(dateFrom);
        }
        if (dateTo) {
          // Ajouter un jour pour inclure la date de fin complète
          const endDate = new Date(dateTo);
          endDate.setDate(endDate.getDate() + 1);
          where.dateDebut.lt = endDate;
        }
      }

      const orderBy: any = sort === 'lobbyiste'
        ? { lobbyiste: { nom: order } }
        : { dateDebut: order };

      const [actions, total] = await Promise.all([
        fastify.prisma.actionLobby.findMany({
          where,
          include: {
            lobbyiste: {
              select: { id: true, nom: true, type: true, secteur: true, siteWeb: true },
            },
            parlementaire: {
              select: {
                id: true,
                slug: true,
                nom: true,
                prenom: true,
                photoUrl: true,
                groupe: { select: { nom: true, couleur: true } },
              },
            },
          },
          orderBy,
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
    handler: async (request, _reply) => {
      const { limit = 20, secteur } = request.query as { limit?: number; secteur?: string };

      const actions = await fastify.prisma.actionLobby.findMany({
        where: {
          ...(secteur && { lobbyiste: { secteur: { contains: secteur, mode: 'insensitive' } } }),
        },
        include: {
          lobbyiste: {
            select: { id: true, nom: true, type: true, secteur: true, siteWeb: true },
          },
          parlementaire: {
            select: {
              id: true,
              slug: true,
              nom: true,
              prenom: true,
              photoUrl: true,
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
