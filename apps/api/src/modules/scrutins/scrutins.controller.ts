// =============================================================================
// Module Scrutins - Controller (Routes)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../utils/errors';

// Fix AN sourceUrl format: VTANR5L17V4946 -> 4946
const fixSourceUrl = (sourceUrl: string | null, chambre: string, numero: number): string | null => {
  if (!sourceUrl) return null;
  // Fix AN URLs with wrong format (VTANR5L17Vxxxx instead of just xxxx)
  if (chambre === 'assemblee' && sourceUrl.includes('/VTANR')) {
    return `https://www.assemblee-nationale.fr/dyn/17/scrutins/${numero}`;
  }
  return sourceUrl;
};

// Schemas
const scrutinsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  chambre: z.enum(['assemblee', 'senat']).optional(),
  type: z.enum(['solennel', 'ordinaire', 'motion']).optional(),
  sort: z.enum(['adopte', 'rejete']).optional(),
  tag: z.string().optional(),
  importance: z.coerce.number().int().min(1).max(5).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
});

// Note: scrutinParamsSchema moved inline to handlers to avoid unused variable warning

export const scrutinsRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET /api/v1/scrutins - Liste des scrutins
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Liste des scrutins',
      description: 'Retourne la liste paginée des scrutins (votes) à l\'Assemblée nationale et au Sénat',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          chambre: { type: 'string', enum: ['assemblee', 'senat'], description: 'Filtrer par chambre' },
          type: { type: 'string', enum: ['solennel', 'ordinaire', 'motion'] },
          sort: { type: 'string', enum: ['adopte', 'rejete'] },
          tag: { type: 'string', description: 'Filtrer par thématique' },
          importance: { type: 'integer', minimum: 1, maximum: 5 },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          search: { type: 'string', description: 'Recherche dans le titre' },
        },
      },
    },
    handler: async (request, _reply) => {
      const query = scrutinsListQuerySchema.parse(request.query);
      const { page, limit, chambre, type, sort, tag, importance, dateFrom, dateTo, search } = query;
      const skip = (page - 1) * limit;

      const where = {
        ...(chambre && { chambre }),
        ...(type && { typeVote: type }),
        ...(sort && { sort }),
        ...(tag && { tags: { has: tag } }),
        ...(importance && { importance }),
        ...(dateFrom && { date: { gte: dateFrom } }),
        ...(dateTo && { date: { lte: dateTo } }),
        ...(search && { titre: { contains: search, mode: 'insensitive' as const } }),
      };

      const [scrutins, total] = await Promise.all([
        fastify.prisma.scrutin.findMany({
          where,
          orderBy: { date: 'desc' },
          skip,
          take: limit,
          include: {
            _count: { select: { votes: true } },
          },
        }),
        fastify.prisma.scrutin.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: scrutins.map((s) => ({
          ...s,
          votesCount: s._count.votes,
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
  // GET /api/v1/scrutins/tags - Tags disponibles
  // ===========================================================================
  fastify.get('/tags', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Liste des tags',
      description: 'Retourne tous les tags de scrutins avec leur count',
    },
    handler: async (_request, _reply) => {
      // Cache TTL: 12 hours
      const CACHE_TTL_12H = 43200;
      const cacheKey = 'scrutins:tags:all';

      // Check Redis cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Optimized: Use SQL UNNEST to count tags directly in database
      // This prevents loading all scrutins into memory
      // Note: Use actual PostgreSQL table names (snake_case) not Prisma model names
      const tagCounts = await fastify.prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT tag as name, COUNT(*) as count
        FROM scrutins, LATERAL unnest(tags) AS tag
        GROUP BY tag
        ORDER BY count DESC
      `;

      const tags = tagCounts.map((t) => ({
        name: t.name,
        count: Number(t.count),
      }));

      const response = { data: tags };

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(response));

      return response;
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/importants - Scrutins importants récents
  // ===========================================================================
  fastify.get('/importants', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Scrutins importants',
      description: 'Retourne les scrutins les plus importants récents',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
    handler: async (request, _reply) => {
      const { limit = 10 } = request.query as { limit?: number };

      // Only show scrutins from the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const scrutins = await fastify.prisma.scrutin.findMany({
        where: {
          importance: { gte: 3 },
          date: { gte: sixMonthsAgo },
        },
        orderBy: [{ date: 'desc' }, { importance: 'desc' }],
        take: limit,
      });

      return { data: scrutins };
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/:numero - Détail d'un scrutin
  // ===========================================================================
  fastify.get('/:numero', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Détail d\'un scrutin',
      description: 'Retourne les informations détaillées d\'un scrutin avec tous les votes',
      params: {
        type: 'object',
        required: ['numero'],
        properties: {
          numero: { type: 'integer', description: 'Numéro du scrutin' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          chambre: { type: 'string', enum: ['assemblee', 'senat'], default: 'assemblee' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { numero } = z.object({ numero: z.coerce.number().int().positive() }).parse(request.params);
      const { chambre = 'assemblee' } = request.query as { chambre?: string };

      // Use findFirst instead of findUnique to avoid composite key issues
      const scrutin = await fastify.prisma.scrutin.findFirst({
        where: { numero, chambre },
        include: {
          votes: {
            include: {
              parlementaire: {
                select: {
                  id: true,
                  slug: true,
                  chambre: true,
                  nom: true,
                  prenom: true,
                  photoUrl: true,
                  groupe: {
                    select: {
                      id: true,
                      slug: true,
                      nom: true,
                      couleur: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!scrutin) {
        throw new ApiError(404, 'Scrutin non trouvé');
      }

      // Regrouper les votes par position
      const votesByPosition = {
        pour: scrutin.votes.filter((v) => v.position === 'pour'),
        contre: scrutin.votes.filter((v) => v.position === 'contre'),
        abstention: scrutin.votes.filter((v) => v.position === 'abstention'),
        absent: scrutin.votes.filter((v) => v.position === 'absent'),
      };

      // Regrouper par groupe politique
      const votesByGroupe: Record<string, { pour: number; contre: number; abstention: number; absent: number }> = {};
      for (const vote of scrutin.votes) {
        const groupeNom = vote.parlementaire.groupe?.nom || 'Non inscrit';
        if (!votesByGroupe[groupeNom]) {
          votesByGroupe[groupeNom] = { pour: 0, contre: 0, abstention: 0, absent: 0 };
        }
        votesByGroupe[groupeNom][vote.position as keyof typeof votesByGroupe[string]]++;
      }

      return {
        data: {
          ...scrutin,
          sourceUrl: fixSourceUrl(scrutin.sourceUrl, scrutin.chambre, scrutin.numero),
          votes: undefined,
          votesByPosition,
          votesByGroupe,
          totalVotes: scrutin.votes.length,
        },
      };
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/:numero/votes - Votes d'un scrutin
  // ===========================================================================
  fastify.get('/:numero/votes', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Votes d\'un scrutin',
      description: 'Retourne la liste paginée des votes pour un scrutin',
      params: {
        type: 'object',
        required: ['numero'],
        properties: {
          numero: { type: 'integer' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          chambre: { type: 'string', enum: ['assemblee', 'senat'], default: 'assemblee' },
          position: { type: 'string', enum: ['pour', 'contre', 'abstention', 'absent'] },
          groupe: { type: 'string', description: 'Slug du groupe politique' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { numero } = z.object({ numero: z.coerce.number().int().positive() }).parse(request.params);
      const { page = 1, limit = 50, chambre = 'assemblee', position, groupe } = request.query as any;
      const skip = (page - 1) * limit;

      // Use findFirst instead of findUnique to avoid composite key issues
      const scrutin = await fastify.prisma.scrutin.findFirst({
        where: { numero, chambre },
        select: { id: true },
      });

      if (!scrutin) {
        throw new ApiError(404, 'Scrutin non trouvé');
      }

      const where = {
        scrutinId: scrutin.id,
        ...(position && { position }),
        ...(groupe && { parlementaire: { groupe: { slug: groupe } } }),
      };

      const [votes, total] = await Promise.all([
        fastify.prisma.vote.findMany({
          where,
          include: {
            parlementaire: {
              select: {
                id: true,
                slug: true,
                chambre: true,
                nom: true,
                prenom: true,
                photoUrl: true,
                groupe: {
                  select: { slug: true, nom: true, couleur: true },
                },
              },
            },
          },
          orderBy: { parlementaire: { nom: 'asc' } },
          skip,
          take: limit,
        }),
        fastify.prisma.vote.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: votes,
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
