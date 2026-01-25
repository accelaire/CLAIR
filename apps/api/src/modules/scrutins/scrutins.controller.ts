// =============================================================================
// Module Scrutins - Controller (Routes)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../utils/errors';
import { buildTextSearchCondition } from '../../utils/search';

// Cache TTL
const CACHE_TTL_1H = 3600;

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

      // Cache key based on query params
      const cacheKey = `scrutins:list:${JSON.stringify(query)}`;

      // Check cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const skip = (page - 1) * limit;

      // Build search condition: search in title OR by numero if numeric
      let searchCondition = {};
      if (search) {
        const searchTrimmed = search.trim();
        const searchAsNumber = parseInt(searchTrimmed, 10);

        if (!isNaN(searchAsNumber) && searchTrimmed === String(searchAsNumber)) {
          // If search is a valid number, search by numero "starts with" OR title contains
          // For "493", we want: 493, 4930-4939, 49300-49399, etc.
          // This is done by range queries: numero >= N*10^k AND numero < (N+1)*10^k
          const numericConditions = [];
          let multiplier = 1;

          // Generate range conditions for different digit lengths (up to 6 digits total)
          for (let i = 0; i < 4; i++) {
            const lower = searchAsNumber * multiplier;
            const upper = (searchAsNumber + 1) * multiplier;
            if (lower <= 999999) { // Max reasonable scrutin number
              numericConditions.push({
                AND: [
                  { numero: { gte: lower } },
                  { numero: { lt: upper } },
                ],
              });
            }
            multiplier *= 10;
          }

          searchCondition = {
            OR: [
              ...numericConditions,
              { titre: { contains: searchTrimmed, mode: 'insensitive' as const } },
            ],
          };
        } else {
          // Otherwise, search in title with multi-word support
          searchCondition = buildTextSearchCondition('titre', searchTrimmed);
        }
      }

      // Combine date conditions properly (don't overwrite gte with lte)
      const dateCondition = (dateFrom || dateTo) ? {
        date: {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        },
      } : {};

      const where = {
        ...(chambre && { chambre }),
        ...(type && { typeVote: type }),
        ...(sort && { sort }),
        ...(tag && { tags: { has: tag } }),
        ...(importance && { importance }),
        ...dateCondition,
        ...searchCondition,
      };

      const [scrutins, total] = await Promise.all([
        fastify.prisma.scrutin.findMany({
          where,
          orderBy: [{ date: 'desc' }, { numero: 'desc' }],
          skip,
          take: limit,
          include: {
            _count: { select: { votes: true } },
          },
        }),
        fastify.prisma.scrutin.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
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

      // Cache for 1 hour
      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));

      return result;
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
      const cacheKey = `scrutins:importants:${limit}`;

      // Check cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

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

      const response = { data: scrutins };

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, 43200, JSON.stringify(response));

      return response;
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
          session: { type: 'string', description: 'Session parlementaire (ex: 2024 pour Sénat, 17 pour AN)' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { numero } = z.object({ numero: z.coerce.number().int().positive() }).parse(request.params);
      const { chambre = 'assemblee', session } = request.query as { chambre?: string; session?: string };

      // Build where clause - session is required for unique lookup in multi-session scenario
      const whereClause: { numero: number; chambre: string; session?: string } = { numero, chambre };
      if (session) {
        whereClause.session = session;
      }

      // Requête scrutin SANS les votes (optimisation mémoire)
      const scrutin = await fastify.prisma.scrutin.findFirst({
        where: whereClause,
        include: {
          dossier: {
            select: {
              id: true,
              uid: true,
              titre: true,
              titreCourt: true,
              procedureLibelle: true,
              urlAN: true,
              urlSenat: true,
              etat: true,
              dateDepot: true,
              loiNumero: true,
              loiTitre: true,
            },
          },
          amendement: {
            select: {
              id: true,
              uid: true,
              numero: true,
              articleVise: true,
              dispositif: true,
              exposeSommaire: true,
              auteurLibelle: true,
              sort: true,
              dateDepot: true,
            },
          },
          interventions: {
            take: 20,
            orderBy: [{ date: 'asc' }, { ordre: 'asc' }],
            select: {
              id: true,
              type: true,
              contenu: true,
              date: true,
              ordre: true,
              sourceUrl: true,
              parlementaire: {
                select: {
                  id: true,
                  slug: true,
                  nom: true,
                  prenom: true,
                  photoUrl: true,
                  groupe: {
                    select: {
                      nom: true,
                      couleur: true,
                    },
                  },
                },
              },
            },
          },
          // Sujets associés
          sujets: {
            select: {
              similarity: true,
              auto: true,
              sujet: {
                select: {
                  id: true,
                  slug: true,
                  label: true,
                  category: true,
                },
              },
            },
          },
        },
      });

      if (!scrutin) {
        throw new ApiError(404, 'Scrutin non trouvé');
      }

      // Sélection des champs votes communs
      const voteSelect = {
        id: true,
        position: true,
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
      };

      // Charger les votes par position (limité à 100 chacun) + agrégation par groupe EN PARALLÈLE
      const [votesPour, votesContre, votesAbstention, votesAbsent, votesByGroupeRaw] = await Promise.all([
        fastify.prisma.vote.findMany({
          where: { scrutinId: scrutin.id, position: 'pour' },
          take: 100,
          select: voteSelect,
        }),
        fastify.prisma.vote.findMany({
          where: { scrutinId: scrutin.id, position: 'contre' },
          take: 100,
          select: voteSelect,
        }),
        fastify.prisma.vote.findMany({
          where: { scrutinId: scrutin.id, position: 'abstention' },
          take: 100,
          select: voteSelect,
        }),
        fastify.prisma.vote.findMany({
          where: { scrutinId: scrutin.id, position: 'absent' },
          take: 100,
          select: voteSelect,
        }),
        // Requête SQL groupée pour votesByGroupe (évite de charger tous les votes en mémoire)
        fastify.prisma.$queryRaw<{ groupe_nom: string | null; position: string; count: bigint }[]>`
          SELECT gp.nom as groupe_nom, v.position, COUNT(*) as count
          FROM "votes" v
          JOIN "parlementaires" p ON v.parlementaire_id = p.id
          LEFT JOIN "groupes_politiques" gp ON p.groupe_id = gp.id
          WHERE v.scrutin_id = ${scrutin.id}
          GROUP BY gp.nom, v.position
        `,
      ]);

      // Construire votesByGroupe à partir de la requête agrégée
      const votesByGroupe: Record<string, { pour: number; contre: number; abstention: number; absent: number }> = {};
      for (const row of votesByGroupeRaw) {
        const groupeNom = row.groupe_nom || 'Non inscrit';
        if (!votesByGroupe[groupeNom]) {
          votesByGroupe[groupeNom] = { pour: 0, contre: 0, abstention: 0, absent: 0 };
        }
        votesByGroupe[groupeNom][row.position as keyof typeof votesByGroupe[string]] = Number(row.count);
      }

      const votesByPosition = {
        pour: votesPour,
        contre: votesContre,
        abstention: votesAbstention,
        absent: votesAbsent,
      };

      // Formater les sujets pour la réponse
      const sujets = scrutin.sujets.map(ss => ({
        ...ss.sujet,
        similarity: ss.similarity,
        auto: ss.auto,
      }));

      return {
        data: {
          ...scrutin,
          sujets,
          sourceUrl: fixSourceUrl(scrutin.sourceUrl, scrutin.chambre, scrutin.numero),
          votesByPosition,
          votesByGroupe,
          totalVotes: scrutin.nombrePour + scrutin.nombreContre + scrutin.nombreAbstention,
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
          session: { type: 'string', description: 'Session parlementaire (ex: 2024 pour Sénat)' },
          position: { type: 'string', enum: ['pour', 'contre', 'abstention', 'absent'] },
          groupe: { type: 'string', description: 'Slug du groupe politique' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { numero } = z.object({ numero: z.coerce.number().int().positive() }).parse(request.params);
      const { page = 1, limit = 50, chambre = 'assemblee', session, position, groupe } = request.query as any;
      const skip = (page - 1) * limit;

      // Build where clause with optional session
      const whereClause: { numero: number; chambre: string; session?: string } = { numero, chambre };
      if (session) {
        whereClause.session = session;
      }

      // Use findFirst instead of findUnique to avoid composite key issues
      const scrutin = await fastify.prisma.scrutin.findFirst({
        where: whereClause,
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
