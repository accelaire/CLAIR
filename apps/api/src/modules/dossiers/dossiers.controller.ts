// =============================================================================
// Module Dossiers Législatifs - Routes
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dossiersListQuerySchema, paginationQuerySchema, amendementsQuerySchema, trendingQuerySchema } from './dossiers.schema';
import { ApiError } from '../../utils/errors';
import { buildMultiFieldSearchCondition } from '../../utils/search';

const CACHE_TTL_1H = 3600;

export const dossiersRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET /api/v1/dossiers - Liste paginée avec filtres
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Liste des dossiers législatifs',
      description: 'Retourne la liste paginée des dossiers législatifs avec filtres',
    },
    handler: async (request, _reply) => {
      const query = dossiersListQuerySchema.parse(request.query);
      const { page, limit, etat, procedureCode, search, dateFrom, dateTo, sort, order } = query;

      const cacheKey = `dossiers:list:${JSON.stringify(query)}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const where: any = {};

      if (etat) where.etat = etat;
      if (procedureCode) where.procedureCode = procedureCode;
      if (search) {
        Object.assign(where, buildMultiFieldSearchCondition(['titre', 'titreCourt'], search));
      }
      if (dateFrom || dateTo) {
        where.dateDepot = {};
        if (dateFrom) where.dateDepot.gte = dateFrom;
        if (dateTo) where.dateDepot.lte = dateTo;
      }

      // Only include dossiers that have at least one scrutin
      where.scrutins = { some: {} };

      const skip = (page - 1) * limit;

      let orderBy: any;
      if (sort === 'scrutins') {
        orderBy = { scrutins: { _count: order } };
      } else {
        orderBy = { dateDepot: order };
      }

      const [dossiers, total] = await Promise.all([
        fastify.prisma.dossierLegislatif.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          select: {
            id: true,
            uid: true,
            titre: true,
            titreCourt: true,
            procedureCode: true,
            procedureLibelle: true,
            etat: true,
            dateDepot: true,
            loiNumero: true,
            _count: {
              select: {
                scrutins: true,
                amendements: true,
              },
            },
          },
        }),
        fastify.prisma.dossierLegislatif.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
        data: dossiers,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/dossiers/trending - Dossiers avec activité récente
  // ===========================================================================
  fastify.get('/trending', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Dossiers législatifs en tendance',
      description: 'Retourne les dossiers avec le plus de scrutins récents (3 derniers mois)',
    },
    handler: async (request, _reply) => {
      const { limit } = trendingQuerySchema.parse(request.query);
      const cacheKey = `dossiers:trending:${limit}`;

      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const trending = await fastify.prisma.dossierLegislatif.findMany({
        where: {
          scrutins: {
            some: {
              date: { gte: threeMonthsAgo },
            },
          },
        },
        select: {
          id: true,
          uid: true,
          titre: true,
          titreCourt: true,
          etat: true,
          procedureLibelle: true,
          dateDepot: true,
          _count: {
            select: {
              scrutins: true,
            },
          },
          scrutins: {
            orderBy: { date: 'desc' },
            take: 1,
            select: {
              date: true,
            },
          },
        },
        orderBy: {
          scrutins: { _count: 'desc' },
        },
        take: limit,
      });

      const result = {
        data: trending.map(d => ({
          id: d.id,
          uid: d.uid,
          titre: d.titre,
          titreCourt: d.titreCourt,
          etat: d.etat,
          procedureLibelle: d.procedureLibelle,
          dateDepot: d.dateDepot,
          _count: d._count,
          lastScrutinDate: d.scrutins[0]?.date || null,
        })),
      };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/dossiers/:uid - Détail d'un dossier
  // ===========================================================================
  fastify.get('/:uid', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Détail d\'un dossier législatif',
      description: 'Retourne le détail d\'un dossier avec ses scrutins et statistiques',
    },
    handler: async (request, _reply) => {
      const { uid } = z.object({ uid: z.string() }).parse(request.params);

      const cacheKey = `dossiers:detail:${uid}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const dossier = await fastify.prisma.dossierLegislatif.findUnique({
        where: { uid },
        select: {
          id: true,
          uid: true,
          titre: true,
          titreCourt: true,
          procedureCode: true,
          procedureLibelle: true,
          urlAN: true,
          urlSenat: true,
          etat: true,
          dateDepot: true,
          dateAdoption: true,
          loiNumero: true,
          loiTitre: true,
          loiDateJO: true,
          urlLegifrance: true,
          scrutins: {
            orderBy: { date: 'desc' },
            take: 20,
            select: {
              id: true,
              numero: true,
              chambre: true,
              session: true,
              date: true,
              titre: true,
              sort: true,
              typeVote: true,
              nombrePour: true,
              nombreContre: true,
              nombreAbstention: true,
              nombreVotants: true,
              amendements: {
                select: {
                  id: true,
                  numero: true,
                  auteurLibelle: true,
                  sort: true,
                },
              },
            },
          },
          amendements: {
            orderBy: [{ dateDepot: 'desc' }, { numero: 'asc' }],
            take: 20,
            select: {
              id: true,
              uid: true,
              numero: true,
              auteurLibelle: true,
              articleVise: true,
              dispositif: true,
              exposeSommaire: true,
              sort: true,
              dateDepot: true,
              scrutins: {
                select: {
                  id: true,
                  numero: true,
                  chambre: true,
                  session: true,
                  sort: true,
                  date: true,
                },
              },
            },
          },
          _count: {
            select: {
              scrutins: true,
              amendements: true,
            },
          },
        },
      });

      if (!dossier) {
        throw new ApiError(404, 'Dossier législatif non trouvé');
      }

      // Stats aggregation + voted amendements count
      const [statsResult, votedAmendementsCount] = await Promise.all([
        fastify.prisma.scrutin.groupBy({
          by: ['sort'],
          where: { dossierId: dossier.id },
          _count: true,
        }),
        fastify.prisma.amendement.count({
          where: {
            dossierId: dossier.id,
            scrutins: { some: {} },
          },
        }),
      ]);

      const stats = {
        totalAdopte: statsResult.find((s: { sort: string; _count: number }) => s.sort === 'adopte')?._count || 0,
        totalRejete: statsResult.find((s: { sort: string; _count: number }) => s.sort === 'rejete')?._count || 0,
      };

      const result = {
        ...dossier,
        scrutinsCount: dossier._count.scrutins,
        amendementsCount: dossier._count.amendements,
        votedAmendementsCount,
        stats,
      };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/dossiers/:uid/scrutins - Scrutins paginés du dossier
  // ===========================================================================
  fastify.get('/:uid/scrutins', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Scrutins d\'un dossier législatif',
      description: 'Retourne les scrutins paginés d\'un dossier',
    },
    handler: async (request, _reply) => {
      const { uid } = z.object({ uid: z.string() }).parse(request.params);
      const { page, limit } = paginationQuerySchema.parse(request.query);

      const cacheKey = `dossiers:${uid}:scrutins:${page}:${limit}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const dossier = await fastify.prisma.dossierLegislatif.findUnique({
        where: { uid },
        select: { id: true },
      });

      if (!dossier) {
        throw new ApiError(404, 'Dossier législatif non trouvé');
      }

      const skip = (page - 1) * limit;

      const [scrutins, total] = await Promise.all([
        fastify.prisma.scrutin.findMany({
          where: { dossierId: dossier.id },
          orderBy: { date: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            numero: true,
            chambre: true,
            session: true,
            date: true,
            titre: true,
            sort: true,
            typeVote: true,
            nombrePour: true,
            nombreContre: true,
            nombreAbstention: true,
            nombreVotants: true,
          },
        }),
        fastify.prisma.scrutin.count({ where: { dossierId: dossier.id } }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
        data: scrutins,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/dossiers/:uid/amendements - Amendements paginés du dossier
  // ===========================================================================
  fastify.get('/:uid/amendements', {
    schema: {
      tags: ['Dossiers'],
      summary: 'Amendements d\'un dossier législatif',
      description: 'Retourne les amendements paginés d\'un dossier',
    },
    handler: async (request, _reply) => {
      const { uid } = z.object({ uid: z.string() }).parse(request.params);
      const { page, limit, voted } = amendementsQuerySchema.parse(request.query);

      const cacheKey = `dossiers:${uid}:amendements:${page}:${limit}:${voted ?? 'all'}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const dossier = await fastify.prisma.dossierLegislatif.findUnique({
        where: { uid },
        select: { id: true },
      });

      if (!dossier) {
        throw new ApiError(404, 'Dossier législatif non trouvé');
      }

      const where: any = { dossierId: dossier.id };
      if (voted) {
        where.scrutins = { some: {} };
      }

      const skip = (page - 1) * limit;

      const [amendements, total] = await Promise.all([
        fastify.prisma.amendement.findMany({
          where,
          orderBy: [{ dateDepot: 'desc' }, { numero: 'asc' }],
          skip,
          take: limit,
          select: {
            id: true,
            uid: true,
            numero: true,
            auteurLibelle: true,
            articleVise: true,
            dispositif: true,
            exposeSommaire: true,
            sort: true,
            dateDepot: true,
            scrutins: {
              select: {
                id: true,
                numero: true,
                chambre: true,
                session: true,
                sort: true,
                date: true,
              },
            },
          },
        }),
        fastify.prisma.amendement.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
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

      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));
      return result;
    },
  });
};
