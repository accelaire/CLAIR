// =============================================================================
// Module Analytics - Controller (Routes)
// API pour l'explorateur de données BI
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// Cache TTL: 12 hours (analytics data doesn't change frequently)
const CACHE_TTL_12H = 43200;

// Schemas
const filtersQuerySchema = z.object({
  groupe: z.string().optional(),
  periode: z.enum(['1m', '3m', '6m', '1y', 'all']).optional(),
  theme: z.string().optional(),
});

function getDateFromPeriode(periode?: string): Date | undefined {
  if (!periode || periode === 'all') return undefined;

  const now = new Date();
  switch (periode) {
    case '1m':
      return new Date(now.setMonth(now.getMonth() - 1));
    case '3m':
      return new Date(now.setMonth(now.getMonth() - 3));
    case '6m':
      return new Date(now.setMonth(now.getMonth() - 6));
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    default:
      return undefined;
  }
}

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET /api/v1/analytics/stats - Statistiques globales
  // ===========================================================================
  fastify.get('/stats', {
    schema: {
      tags: ['Analytics'],
      summary: 'Statistiques globales',
      description: 'Retourne les statistiques globales pour le dashboard',
      querystring: {
        type: 'object',
        properties: {
          groupe: { type: 'string' },
          periode: { type: 'string', enum: ['1m', '3m', '6m', '1y', 'all'] },
          theme: { type: 'string' },
        },
      },
    },
    handler: async (request, _reply) => {
      const filters = filtersQuerySchema.parse(request.query);
      const dateFrom = getDateFromPeriode(filters.periode);

      const [
        totalDeputes,
        totalScrutins,
        totalVotes,
        totalLobbyistes,
        totalActions,
        groupes,
      ] = await Promise.all([
        fastify.prisma.parlementaire.count({ where: { actif: true } }),
        fastify.prisma.scrutin.count({
          where: dateFrom ? { date: { gte: dateFrom } } : undefined,
        }),
        fastify.prisma.vote.count({
          where: dateFrom
            ? { scrutin: { date: { gte: dateFrom } } }
            : undefined,
        }),
        fastify.prisma.lobbyiste.count(),
        fastify.prisma.actionLobby.count({
          where: dateFrom ? { dateDebut: { gte: dateFrom } } : undefined,
        }),
        fastify.prisma.groupePolitique.count({ where: { actif: true } }),
      ]);

      // Calcul du taux de participation moyen
      const scrutins = await fastify.prisma.scrutin.findMany({
        where: dateFrom ? { date: { gte: dateFrom } } : undefined,
        select: {
          nombreVotants: true,
        },
        take: 100,
        orderBy: { date: 'desc' },
      });

      const avgParticipation =
        scrutins.length > 0
          ? scrutins.reduce((acc, s) => acc + s.nombreVotants, 0) /
            scrutins.length
          : 0;

      return {
        data: {
          totalDeputes,
          totalScrutins,
          totalVotes,
          totalLobbyistes,
          totalActions,
          groupesPolitiques: groupes,
          avgParticipation: Math.round(avgParticipation),
        },
      };
    },
  });

  // ===========================================================================
  // GET /api/v1/analytics/groupes - Répartition par groupe politique
  // ===========================================================================
  fastify.get('/groupes', {
    schema: {
      tags: ['Analytics'],
      summary: 'Répartition par groupe',
      description: 'Retourne la distribution des députés par groupe politique',
    },
    handler: async (_request, _reply) => {
      const groupes = await fastify.prisma.groupePolitique.findMany({
        where: { actif: true },
        select: {
          id: true,
          nom: true,
          couleur: true,
          position: true,
          _count: { select: { parlementaires: { where: { actif: true } } } },
        },
        orderBy: { ordre: 'asc' },
      });

      return {
        data: groupes.map((g) => ({
          id: g.id,
          nom: g.nom,
          couleur: g.couleur,
          position: g.position,
          nbDeputes: g._count.parlementaires,
        })),
      };
    },
  });

  // ===========================================================================
  // GET /api/v1/analytics/voting-trends - Tendances de vote
  // ===========================================================================
  fastify.get('/voting-trends', {
    schema: {
      tags: ['Analytics'],
      summary: 'Tendances de vote',
      description: 'Retourne l\'évolution des votes dans le temps',
      querystring: {
        type: 'object',
        properties: {
          groupe: { type: 'string' },
          periode: { type: 'string', enum: ['1m', '3m', '6m', '1y', 'all'] },
          theme: { type: 'string' },
        },
      },
    },
    handler: async (request, _reply) => {
      const filters = filtersQuerySchema.parse(request.query);
      const dateFrom = getDateFromPeriode(filters.periode) || new Date('2022-01-01');

      // Check Redis cache first (12h TTL)
      const cacheKey = `analytics:voting-trends:${filters.periode || 'all'}:${filters.theme || 'all'}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Optimized: Use SQL DATE_TRUNC to aggregate by month directly in database
      // This prevents loading all scrutins into memory
      let monthlyData: Array<{
        month: Date;
        pour: bigint;
        contre: bigint;
        abstention: bigint;
        count: bigint;
      }>;

      // Note: Use actual PostgreSQL table/column names (snake_case) not Prisma model names
      if (filters.theme) {
        monthlyData = await fastify.prisma.$queryRaw`
          SELECT
            DATE_TRUNC('month', date) as month,
            SUM(nombre_pour) as pour,
            SUM(nombre_contre) as contre,
            SUM(nombre_abstention) as abstention,
            COUNT(*) as count
          FROM scrutins
          WHERE date >= ${dateFrom}
            AND ${filters.theme} = ANY(tags)
          GROUP BY DATE_TRUNC('month', date)
          ORDER BY month ASC
        `;
      } else {
        monthlyData = await fastify.prisma.$queryRaw`
          SELECT
            DATE_TRUNC('month', date) as month,
            SUM(nombre_pour) as pour,
            SUM(nombre_contre) as contre,
            SUM(nombre_abstention) as abstention,
            COUNT(*) as count
          FROM scrutins
          WHERE date >= ${dateFrom}
          GROUP BY DATE_TRUNC('month', date)
          ORDER BY month ASC
        `;
      }

      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

      // Take last 12 months and format for chart
      const chartData = monthlyData.slice(-12).map((data) => {
        const date = new Date(data.month);
        const count = Number(data.count);
        return {
          mois: `${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`,
          pour: count > 0 ? Math.round(Number(data.pour) / count) : 0,
          contre: count > 0 ? Math.round(Number(data.contre) / count) : 0,
          abstention: count > 0 ? Math.round(Number(data.abstention) / count) : 0,
        };
      });

      const response = { data: chartData };

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(response));

      return response;
    },
  });

  // ===========================================================================
  // GET /api/v1/analytics/top-deputes - Députés les plus actifs
  // ===========================================================================
  fastify.get('/top-deputes', {
    schema: {
      tags: ['Analytics'],
      summary: 'Top députés',
      description: 'Retourne les députés les plus actifs',
      querystring: {
        type: 'object',
        properties: {
          groupe: { type: 'string' },
          periode: { type: 'string', enum: ['1m', '3m', '6m', '1y', 'all'] },
          theme: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 15 },
        },
      },
    },
    handler: async (request, _reply) => {
      const filters = filtersQuerySchema.parse(request.query);
      const { limit = 15 } = request.query as { limit?: number };
      const dateFrom = getDateFromPeriode(filters.periode);

      // Compter les votes par parlementaire
      const voteCounts = await fastify.prisma.vote.groupBy({
        by: ['parlementaireId'],
        where: {
          position: { in: ['pour', 'contre', 'abstention'] }, // Exclure les absents
          ...(dateFrom && { scrutin: { date: { gte: dateFrom } } }),
          ...(filters.groupe && { parlementaire: { groupe: { slug: filters.groupe } } }),
          ...(filters.theme && { scrutin: { tags: { has: filters.theme } } }),
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit,
      });

      const parlementaireIds = voteCounts.map((v) => v.parlementaireId);

      const parlementaires = await fastify.prisma.parlementaire.findMany({
        where: { id: { in: parlementaireIds } },
        select: {
          id: true,
          slug: true,
          nom: true,
          prenom: true,
          photoUrl: true,
          groupe: {
            select: { nom: true, couleur: true },
          },
        },
      });

      const parlementaireMap = new Map(parlementaires.map((p) => [p.id, p]));

      const result = voteCounts.map((vc) => {
        const parlementaire = parlementaireMap.get(vc.parlementaireId);
        return {
          id: vc.parlementaireId,
          slug: parlementaire?.slug,
          nom: parlementaire?.nom,
          prenom: parlementaire?.prenom,
          photoUrl: parlementaire?.photoUrl,
          groupe: parlementaire?.groupe?.nom,
          couleur: parlementaire?.groupe?.couleur,
          score: vc._count?.id || 0,
        };
      });

      return { data: result };
    },
  });

  // ===========================================================================
  // GET /api/v1/analytics/lobbying-sectors - Secteurs de lobbying
  // ===========================================================================
  fastify.get('/lobbying-sectors', {
    schema: {
      tags: ['Analytics'],
      summary: 'Secteurs de lobbying',
      description: 'Retourne la répartition des lobbyistes par secteur',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 30, default: 10 },
        },
      },
    },
    handler: async (request, _reply) => {
      const { limit = 10 } = request.query as { limit?: number };

      // Grouper par secteur
      const sectorCounts = await fastify.prisma.lobbyiste.groupBy({
        by: ['secteur'],
        where: {
          secteur: { not: null },
        },
        _count: { id: true },
        _sum: { nbLobbyistes: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit + 5, // Prendre un peu plus pour filtrer les null
      });

      const result = sectorCounts
        .filter((s) => s.secteur)
        .slice(0, limit)
        .map((s) => ({
          secteur: s.secteur,
          count: s._sum.nbLobbyistes || s._count.id,
          organisations: s._count.id,
        }));

      return { data: result };
    },
  });

  // ===========================================================================
  // GET /api/v1/analytics/scrutins - Scrutins récents avec stats
  // ===========================================================================
  fastify.get('/scrutins', {
    schema: {
      tags: ['Analytics'],
      summary: 'Scrutins avec statistiques',
      description: 'Retourne les scrutins récents avec leurs statistiques',
      querystring: {
        type: 'object',
        properties: {
          groupe: { type: 'string' },
          periode: { type: 'string', enum: ['1m', '3m', '6m', '1y', 'all'] },
          theme: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
    handler: async (request, _reply) => {
      const filters = filtersQuerySchema.parse(request.query);
      const { limit = 10 } = request.query as { limit?: number };
      const dateFrom = getDateFromPeriode(filters.periode);

      const [scrutins, stats] = await Promise.all([
        fastify.prisma.scrutin.findMany({
          where: {
            ...(dateFrom && { date: { gte: dateFrom } }),
            ...(filters.theme && { tags: { has: filters.theme } }),
          },
          orderBy: { date: 'desc' },
          take: limit,
          select: {
            id: true,
            numero: true,
            titre: true,
            date: true,
            sort: true,
            nombrePour: true,
            nombreContre: true,
            nombreAbstention: true,
            importance: true,
            tags: true,
          },
        }),
        fastify.prisma.scrutin.aggregate({
          where: {
            ...(dateFrom && { date: { gte: dateFrom } }),
            ...(filters.theme && { tags: { has: filters.theme } }),
          },
          _count: { id: true },
        }),
      ]);

      // Calculer les stats par résultat
      const adoptes = scrutins.filter((s) => s.sort === 'adopte').length;
      const rejetes = scrutins.filter((s) => s.sort === 'rejete').length;
      const serres = scrutins.filter((s) => {
        const total = s.nombrePour + s.nombreContre + s.nombreAbstention;
        if (total === 0) return false;
        const pourPct = (s.nombrePour / total) * 100;
        const contrePct = (s.nombreContre / total) * 100;
        return Math.abs(pourPct - contrePct) < 20;
      }).length;

      return {
        data: {
          recentScrutins: scrutins.map((s) => ({
            id: s.id,
            numero: s.numero,
            titre: s.titre,
            date: s.date,
            sort: s.sort,
            pour: s.nombrePour,
            contre: s.nombreContre,
            abstention: s.nombreAbstention,
            importance: s.importance,
            tags: s.tags,
          })),
          stats: {
            totalScrutins: stats._count.id,
            adoptes,
            rejetes,
            serres,
          },
        },
      };
    },
  });

  // ===========================================================================
  // GET /api/v1/analytics/dissidents - Députés qui votent contre leur groupe
  // ===========================================================================
  fastify.get('/dissidents', {
    schema: {
      tags: ['Analytics'],
      summary: 'Députés dissidents',
      description: 'Retourne les députés qui votent le plus souvent contre leur groupe',
      querystring: {
        type: 'object',
        properties: {
          periode: { type: 'string', enum: ['1m', '3m', '6m', '1y', 'all'] },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
    },
    handler: async (request, _reply) => {
      const { periode, limit = 20 } = request.query as { periode?: string; limit?: number };
      const dateFrom = getDateFromPeriode(periode);

      // Check Redis cache first (12h TTL)
      const cacheKey = `analytics:dissidents:${periode || 'all'}:${limit}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Optimized SQL query: calculate dissidences directly in database
      // This prevents loading 10k+ votes into memory
      type DissidentRow = {
        parlementaire_id: string;
        slug: string;
        nom: string;
        prenom: string;
        photo_url: string | null;
        groupe_nom: string;
        groupe_couleur: string | null;
        dissidences: bigint;
        total_votes: bigint;
      };

      let dissidentsData: DissidentRow[];

      // Note: Use actual PostgreSQL table/column names (snake_case) not Prisma model names
      if (dateFrom) {
        dissidentsData = await fastify.prisma.$queryRaw<DissidentRow[]>`
          WITH group_majority AS (
            SELECT
              v.scrutin_id,
              p.groupe_id,
              CASE
                WHEN SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) >
                     SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)
                THEN 'pour'
                ELSE 'contre'
              END as majority_position
            FROM votes v
            JOIN parlementaires p ON v.parlementaire_id = p.id
            JOIN scrutins s ON v.scrutin_id = s.id
            WHERE v.position IN ('pour', 'contre')
              AND p.groupe_id IS NOT NULL
              AND s.date >= ${dateFrom}
            GROUP BY v.scrutin_id, p.groupe_id
            HAVING ABS(SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) -
                       SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)) > 5
          ),
          parlementaire_dissidences AS (
            SELECT
              p.id as parlementaire_id,
              p.slug,
              p.nom,
              p.prenom,
              p.photo_url as photo_url,
              g.nom as groupe_nom,
              g.couleur as groupe_couleur,
              COUNT(*) as total_votes,
              SUM(CASE WHEN v.position != gm.majority_position THEN 1 ELSE 0 END) as dissidences
            FROM votes v
            JOIN parlementaires p ON v.parlementaire_id = p.id
            JOIN groupes_politiques g ON p.groupe_id = g.id
            JOIN scrutins s ON v.scrutin_id = s.id
            JOIN group_majority gm ON v.scrutin_id = gm.scrutin_id AND p.groupe_id = gm.groupe_id
            WHERE v.position IN ('pour', 'contre')
              AND s.date >= ${dateFrom}
            GROUP BY p.id, p.slug, p.nom, p.prenom, p.photo_url, g.nom, g.couleur
            HAVING COUNT(*) >= 10
          )
          SELECT *
          FROM parlementaire_dissidences
          ORDER BY (dissidences::float / total_votes::float) DESC
          LIMIT ${limit}
        `;
      } else {
        dissidentsData = await fastify.prisma.$queryRaw<DissidentRow[]>`
          WITH group_majority AS (
            SELECT
              v.scrutin_id,
              p.groupe_id,
              CASE
                WHEN SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) >
                     SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)
                THEN 'pour'
                ELSE 'contre'
              END as majority_position
            FROM votes v
            JOIN parlementaires p ON v.parlementaire_id = p.id
            WHERE v.position IN ('pour', 'contre')
              AND p.groupe_id IS NOT NULL
            GROUP BY v.scrutin_id, p.groupe_id
            HAVING ABS(SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) -
                       SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)) > 5
          ),
          parlementaire_dissidences AS (
            SELECT
              p.id as parlementaire_id,
              p.slug,
              p.nom,
              p.prenom,
              p.photo_url as photo_url,
              g.nom as groupe_nom,
              g.couleur as groupe_couleur,
              COUNT(*) as total_votes,
              SUM(CASE WHEN v.position != gm.majority_position THEN 1 ELSE 0 END) as dissidences
            FROM votes v
            JOIN parlementaires p ON v.parlementaire_id = p.id
            JOIN groupes_politiques g ON p.groupe_id = g.id
            JOIN group_majority gm ON v.scrutin_id = gm.scrutin_id AND p.groupe_id = gm.groupe_id
            WHERE v.position IN ('pour', 'contre')
            GROUP BY p.id, p.slug, p.nom, p.prenom, p.photo_url, g.nom, g.couleur
            HAVING COUNT(*) >= 10
          )
          SELECT *
          FROM parlementaire_dissidences
          ORDER BY (dissidences::float / total_votes::float) DESC
          LIMIT ${limit}
        `;
      }

      const result = dissidentsData.map((d) => ({
        id: d.parlementaire_id,
        slug: d.slug,
        nom: d.nom,
        prenom: d.prenom,
        photoUrl: d.photo_url,
        groupe: d.groupe_nom,
        couleur: d.groupe_couleur,
        dissidences: Number(d.dissidences),
        totalVotes: Number(d.total_votes),
        tauxDissidence: Math.round((Number(d.dissidences) / Number(d.total_votes)) * 100),
      }));

      const response = { data: result };

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(response));

      return response;
    },
  });

  // ===========================================================================
  // GET /api/v1/analytics/themes - Thèmes les plus votés
  // ===========================================================================
  fastify.get('/themes', {
    schema: {
      tags: ['Analytics'],
      summary: 'Thèmes de scrutins',
      description: 'Retourne les thèmes avec le plus de scrutins',
      querystring: {
        type: 'object',
        properties: {
          periode: { type: 'string', enum: ['1m', '3m', '6m', '1y', 'all'] },
          limit: { type: 'integer', minimum: 1, maximum: 30, default: 15 },
        },
      },
    },
    handler: async (request, _reply) => {
      const { periode, limit = 15 } = request.query as { periode?: string; limit?: number };
      const dateFrom = getDateFromPeriode(periode);

      // Check Redis cache first (12h TTL)
      const cacheKey = `analytics:themes:${periode || 'all'}:${limit}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Optimized: Use SQL UNNEST to count tags directly in database
      // This prevents loading all scrutins into memory
      // Note: Use actual PostgreSQL table names (snake_case) not Prisma model names
      let themeCounts: Array<{ theme: string; count: bigint }>;

      if (dateFrom) {
        themeCounts = await fastify.prisma.$queryRaw<Array<{ theme: string; count: bigint }>>`
          SELECT tag as theme, COUNT(*) as count
          FROM scrutins, LATERAL unnest(tags) AS tag
          WHERE date >= ${dateFrom}
          GROUP BY tag
          ORDER BY count DESC
          LIMIT ${limit}
        `;
      } else {
        themeCounts = await fastify.prisma.$queryRaw<Array<{ theme: string; count: bigint }>>`
          SELECT tag as theme, COUNT(*) as count
          FROM scrutins, LATERAL unnest(tags) AS tag
          GROUP BY tag
          ORDER BY count DESC
          LIMIT ${limit}
        `;
      }

      const result = themeCounts.map((t) => ({
        theme: t.theme,
        count: Number(t.count),
      }));

      const response = { data: result };

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(response));

      return response;
    },
  });

  // ===========================================================================
  // GET /api/v1/analytics/controverses - Scrutins les plus serrés
  // ===========================================================================
  fastify.get('/controverses', {
    schema: {
      tags: ['Analytics'],
      summary: 'Scrutins controversés',
      description: 'Retourne les scrutins les plus serrés',
      querystring: {
        type: 'object',
        properties: {
          periode: { type: 'string', enum: ['1m', '3m', '6m', '1y', 'all'] },
          limit: { type: 'integer', minimum: 1, maximum: 30, default: 10 },
        },
      },
    },
    handler: async (request, _reply) => {
      const { periode, limit = 10 } = request.query as { periode?: string; limit?: number };
      const dateFrom = getDateFromPeriode(periode);

      const scrutins = await fastify.prisma.scrutin.findMany({
        where: {
          ...(dateFrom && { date: { gte: dateFrom } }),
          nombreVotants: { gte: 100 }, // Assez de votants
        },
        orderBy: { date: 'desc' },
        take: 200,
      });

      // Calculer la "controverse" = proximité du 50/50
      const withControverse = scrutins.map((s) => {
        const total = s.nombrePour + s.nombreContre;
        if (total === 0) return { ...s, controverse: 0 };
        const ratio = s.nombrePour / total;
        // Score de controverse: 100 quand c'est 50/50, 0 quand c'est 100/0
        const controverse = 100 - Math.abs(ratio - 0.5) * 200;
        return { ...s, controverse: Math.round(controverse) };
      });

      const result = withControverse
        .filter((s) => s.controverse >= 70) // Au moins 70% de controverse
        .sort((a, b) => b.controverse - a.controverse)
        .slice(0, limit)
        .map((s) => ({
          id: s.id,
          numero: s.numero,
          titre: s.titre,
          date: s.date,
          sort: s.sort,
          pour: s.nombrePour,
          contre: s.nombreContre,
          abstention: s.nombreAbstention,
          controverse: s.controverse,
          importance: s.importance,
        }));

      return { data: result };
    },
  });

  // ===========================================================================
  // GET /api/v1/analytics/lobbying-top - Top lobbyistes par budget
  // ===========================================================================
  fastify.get('/lobbying-top', {
    schema: {
      tags: ['Analytics'],
      summary: 'Top lobbyistes',
      description: 'Retourne les lobbyistes les plus importants par budget',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 15 },
        },
      },
    },
    handler: async (request, _reply) => {
      const { limit = 15 } = request.query as { limit?: number };

      const lobbyistes = await fastify.prisma.lobbyiste.findMany({
        where: {
          budgetAnnuel: { not: null, gt: 0 },
        },
        orderBy: { budgetAnnuel: 'desc' },
        take: limit,
        select: {
          id: true,
          nom: true,
          type: true,
          secteur: true,
          budgetAnnuel: true,
          nbLobbyistes: true,
          _count: { select: { actions: true } },
        },
      });

      return {
        data: lobbyistes.map((l) => ({
          id: l.id,
          nom: l.nom,
          type: l.type,
          secteur: l.secteur,
          budget: l.budgetAnnuel,
          nbLobbyistes: l.nbLobbyistes,
          nbActions: l._count.actions,
        })),
      };
    },
  });
};
