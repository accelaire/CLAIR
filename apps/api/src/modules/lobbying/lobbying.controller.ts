// =============================================================================
// Module Lobbying - Controller (Routes)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
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
  secteurs: z.string().optional(), // comma-separated secteur slugs
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
          secteur: { type: 'string', description: 'Secteur d\'activité (legacy, string contains)' },
          secteurs: { type: 'string', description: 'Secteur slugs séparés par virgule (intersection AND)' },
          search: { type: 'string', description: 'Recherche par nom' },
          sort: { type: 'string', enum: ['nom', 'budget', 'actions'], default: 'nom' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        },
      },
    },
    handler: async (request, _reply) => {
      const query = lobbyistesListQuerySchema.parse(request.query);
      const { page, limit, type, secteur, secteurs, search, sort, order } = query;

      // Cache key based on query params
      const cacheKey = `lobbying:list:${JSON.stringify(query)}`;

      // Check cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const skip = (page - 1) * limit;

      // Parse secteurs param (comma-separated slugs) for intersection filter
      const secteurSlugs = secteurs
        ? secteurs.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const where: Prisma.LobbyisteWhereInput = {
        ...(type && { type }),
        ...(secteur && { secteur: { contains: secteur, mode: 'insensitive' as const } }),
        ...(search && buildTextSearchCondition('nom', search)),
        ...(secteurSlugs.length > 0 && {
          AND: secteurSlugs.map((slug) => ({
            secteurs: { some: { secteurId: slug } },
          })),
        }),
      };

      // Build orderBy based on sort field
      let orderBy: Prisma.LobbyisteOrderByWithRelationInput;
      switch (sort) {
        case 'budget':
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
            secteurs: {
              include: { secteur: true },
            },
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
          secteursList: l.secteurs.map((ls) => ({
            slug: ls.secteur.id,
            label: ls.secteur.label,
          })),
          _count: undefined,
          secteurs: undefined,
          // sourceData retiré des listes par cohérence avec scrutins et
          // parlementaires. Il est null en base aujourd'hui, mais rien ne
          // garantit qu'il le restera.
          sourceData: undefined,
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

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(result));

      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/lobbying/secteurs - Liste des secteurs (normalized)
  // ===========================================================================
  fastify.get('/secteurs', {
    schema: {
      tags: ['Lobbying'],
      summary: 'Liste des secteurs',
      description: 'Retourne tous les secteurs normalisés avec counts lobbyistes et actions',
    },
    handler: async (_request, _reply) => {
      const cacheKey = 'lobbying:secteurs';

      // Check cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const secteurs = await fastify.prisma.secteur.findMany({
        include: {
          _count: {
            select: {
              lobbyistes: true,
              actions: true,
            },
          },
        },
        orderBy: { lobbyistes: { _count: 'desc' } },
      });

      const result = {
        data: secteurs.map((s) => ({
          slug: s.id,
          name: s.label,
          lobbyistesCount: s._count.lobbyistes,
          actionsCount: s._count.actions,
          count: s._count.lobbyistes, // backward compat with old frontend
        })),
      };

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
      const totalLobbyistes = await fastify.prisma.lobbyiste.count();
      const totalActions = await fastify.prisma.actionLobby.count();

      const budgetTotal = await fastify.prisma.lobbyiste.aggregate({
        _sum: { budgetAnnuel: true },
      });

      const byType = await fastify.prisma.lobbyiste.groupBy({
        by: ['type'],
        _count: { type: true },
      });

      // Use normalized secteurs table
      const topSecteursRaw = await fastify.prisma.secteur.findMany({
        include: {
          _count: { select: { lobbyistes: true } },
        },
        orderBy: { lobbyistes: { _count: 'desc' } },
        take: 10,
      });

      const totalSecteurs = await fastify.prisma.secteur.count();

      const response = {
        data: {
          totalLobbyistes,
          totalActions,
          budgetTotal: budgetTotal._sum.budgetAnnuel || 0,
          totalSecteurs,
          byType: byType.map((t) => ({ type: t.type, count: t._count.type })),
          topSecteurs: topSecteursRaw.map((s) => ({
            secteur: s.label,
            slug: s.id,
            count: s._count.lobbyistes,
          })),
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
          secteurs: {
            include: { secteur: true },
          },
          actions: {
            include: {
              cibleType: true,
              actionDescription: true,
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
              secteurs: {
                include: { secteur: true },
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

      return {
        data: {
          ...lobbyiste,
          secteursList: lobbyiste.secteurs.map((ls) => ({
            slug: ls.secteur.id,
            label: ls.secteur.label,
          })),
          actions: lobbyiste.actions.map((a) => ({
            ...a,
            description: a.actionDescription.texte,
            cibleNom: a.cibleType?.label ?? null,
            secteursList: a.secteurs.map((as) => ({
              slug: as.secteur.id,
              label: as.secteur.label,
            })),
            actionDescription: undefined,
            cibleType: undefined,
            descriptionId: undefined,
            cibleTypeId: undefined,
            secteurs: undefined,
          })),
          secteurs: undefined,
        },
      };
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
      const { page = 1, limit = 20, cible } = request.query as {
        page?: number; limit?: number; cible?: string;
      };
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
            cibleType: true,
            actionDescription: true,
            parlementaire: {
              select: {
                id: true,
                slug: true,
                nom: true,
                prenom: true,
                groupe: { select: { nom: true, couleur: true } },
              },
            },
            secteurs: {
              include: { secteur: true },
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
        data: actions.map((a) => ({
          ...a,
          description: a.actionDescription.texte,
          cibleNom: a.cibleType?.label ?? null,
          secteursList: a.secteurs.map((as) => ({
            slug: as.secteur.id,
            label: as.secteur.label,
          })),
          actionDescription: undefined,
          cibleType: undefined,
          descriptionId: undefined,
          cibleTypeId: undefined,
          secteurs: undefined,
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
          texteVise: { type: 'string', description: 'Filtre par texte visé (contains)' },
          secteur: { type: 'string' },
          secteurs: { type: 'string', description: 'Secteur slugs séparés par virgule (filtre par domaines action)' },
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
        texteVise,
        secteur,
        secteurs,
        search,
        dateFrom,
        dateTo,
        sort = 'dateDebut',
        order = 'desc',
      } = request.query as {
        page?: number;
        limit?: number;
        cible?: string;
        texteVise?: string;
        secteur?: string;
        secteurs?: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        sort?: 'dateDebut' | 'lobbyiste';
        order?: 'asc' | 'desc';
      };

      // Cache — stable key from sorted query params
      const cacheKey = `lobbying:actions:${JSON.stringify({ page, limit, cible, texteVise, secteur, secteurs, search, dateFrom, dateTo, sort, order })}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const skip = (page - 1) * limit;

      // Parse secteurs param for action domaines intersection filter
      const secteurSlugs = secteurs
        ? secteurs.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const where: Prisma.ActionLobbyWhereInput = {};

      if (cible) {
        where.cible = cible;
      }

      if (texteVise) {
        where.texteViseNom = { contains: texteVise, mode: 'insensitive' };
      }

      // Legacy single secteur filter (via lobbyiste)
      if (secteur) {
        where.lobbyiste = {
          secteur: { contains: secteur, mode: 'insensitive' },
        };
      }

      // New multi-secteur filter (via action's own domaines)
      if (secteurSlugs.length > 0) {
        where.AND = secteurSlugs.map((slug) => ({
          secteurs: { some: { secteurId: slug } },
        }));
      }

      if (search) {
        where.OR = [
          { actionDescription: { texte: { contains: search, mode: 'insensitive' } } },
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
          const endDate = new Date(dateTo);
          endDate.setDate(endDate.getDate() + 1);
          where.dateDebut.lt = endDate;
        }
      }

      const orderBy: Prisma.ActionLobbyOrderByWithRelationInput = sort === 'lobbyiste'
        ? { lobbyiste: { nom: order } }
        : { dateDebut: order };

      const [actions, total] = await Promise.all([
        fastify.prisma.actionLobby.findMany({
          where,
          include: {
            cibleType: true,
            actionDescription: true,
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
            secteurs: {
              include: { secteur: true },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        fastify.prisma.actionLobby.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
        data: actions.map((a) => ({
          ...a,
          description: a.actionDescription.texte,
          cibleNom: a.cibleType?.label ?? null,
          secteursList: a.secteurs.map((as) => ({
            slug: as.secteur.id,
            label: as.secteur.label,
          })),
          actionDescription: undefined,
          cibleType: undefined,
          descriptionId: undefined,
          cibleTypeId: undefined,
          secteurs: undefined,
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

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(result));

      return result;
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
          secteurs: { type: 'string', description: 'Secteur slugs séparés par virgule' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { limit = 20, secteur, secteurs } = request.query as {
        limit?: number;
        secteur?: string;
        secteurs?: string;
      };

      const secteurSlugs = secteurs
        ? secteurs.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const where: Prisma.ActionLobbyWhereInput = {};
      if (secteur) {
        where.lobbyiste = { secteur: { contains: secteur, mode: 'insensitive' } };
      }
      if (secteurSlugs.length > 0) {
        where.AND = secteurSlugs.map((slug) => ({
          secteurs: { some: { secteurId: slug } },
        }));
      }

      const actions = await fastify.prisma.actionLobby.findMany({
        where,
        include: {
          cibleType: true,
          actionDescription: true,
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
          secteurs: {
            include: { secteur: true },
          },
        },
        orderBy: { dateDebut: 'desc' },
        take: limit,
      });

      return {
        data: actions.map((a) => ({
          ...a,
          description: a.actionDescription.texte,
          cibleNom: a.cibleType?.label ?? null,
          secteursList: a.secteurs.map((as) => ({
            slug: as.secteur.id,
            label: as.secteur.label,
          })),
          actionDescription: undefined,
          cibleType: undefined,
          descriptionId: undefined,
          cibleTypeId: undefined,
          secteurs: undefined,
        })),
      };
    },
  });
};
