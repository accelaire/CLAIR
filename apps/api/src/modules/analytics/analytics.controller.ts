// =============================================================================
// Module Analytics - Controller (Routes)
// API pour l'explorateur de données BI
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

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
    handler: async (request, reply) => {
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
    handler: async (request, reply) => {
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
    handler: async (request, reply) => {
      const filters = filtersQuerySchema.parse(request.query);
      const dateFrom = getDateFromPeriode(filters.periode) || new Date('2022-01-01');

      // Récupérer les scrutins groupés par mois
      const scrutins = await fastify.prisma.scrutin.findMany({
        where: {
          date: { gte: dateFrom },
          ...(filters.theme && { tags: { has: filters.theme } }),
        },
        select: {
          date: true,
          nombrePour: true,
          nombreContre: true,
          nombreAbstention: true,
        },
        orderBy: { date: 'asc' },
      });

      // Grouper par mois
      const monthlyData: Record<string, { pour: number; contre: number; abstention: number; count: number }> = {};

      for (const s of scrutins) {
        const monthKey = `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { pour: 0, contre: 0, abstention: 0, count: 0 };
        }
        monthlyData[monthKey].pour += s.nombrePour;
        monthlyData[monthKey].contre += s.nombreContre;
        monthlyData[monthKey].abstention += s.nombreAbstention;
        monthlyData[monthKey].count++;
      }

      // Formater pour le graphique
      const chartData = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12) // 12 derniers mois
        .map(([month, data]) => {
          const parts = month.split('-');
          const year = parts[0] || '2024';
          const m = parts[1] || '01';
          const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
          return {
            mois: `${monthNames[parseInt(m) - 1]} ${year.slice(2)}`,
            pour: Math.round(data.pour / data.count),
            contre: Math.round(data.contre / data.count),
            abstention: Math.round(data.abstention / data.count),
          };
        });

      return { data: chartData };
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
    handler: async (request, reply) => {
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
    handler: async (request, reply) => {
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
    handler: async (request, reply) => {
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
    handler: async (request, reply) => {
      const { periode, limit = 20 } = request.query as { periode?: string; limit?: number };
      const dateFrom = getDateFromPeriode(periode);

      // Cette requête est complexe, on va la simplifier en récupérant les données brutes
      // et en les traitant côté serveur

      // Récupérer les votes avec info groupe
      const votes = await fastify.prisma.vote.findMany({
        where: {
          position: { in: ['pour', 'contre'] },
          parlementaire: { groupeId: { not: null } },
          ...(dateFrom && { scrutin: { date: { gte: dateFrom } } }),
        },
        select: {
          position: true,
          parlementaire: {
            select: {
              id: true,
              slug: true,
              nom: true,
              prenom: true,
              photoUrl: true,
              groupe: {
                select: { id: true, nom: true, couleur: true },
              },
            },
          },
          scrutin: {
            select: { id: true, sort: true },
          },
        },
        take: 10000, // Limiter pour performance
      });

      // Calculer la position majoritaire du groupe par scrutin
      const groupePositions: Map<string, Map<string, { pour: number; contre: number }>> = new Map();

      for (const vote of votes) {
        if (!vote.parlementaire.groupe) continue;
        const groupeId = vote.parlementaire.groupe.id;
        const scrutinId = vote.scrutin.id;
        const key = `${groupeId}-${scrutinId}`;

        if (!groupePositions.has(key)) {
          groupePositions.set(key, new Map());
        }
        const positions = groupePositions.get(key)!;
        if (!positions.has(scrutinId)) {
          positions.set(scrutinId, { pour: 0, contre: 0 });
        }
        const pos = positions.get(scrutinId)!;
        if (vote.position === 'pour') pos.pour++;
        else if (vote.position === 'contre') pos.contre++;
      }

      // Compter les dissidences par parlementaire
      const dissidences: Map<string, { parlementaire: typeof votes[0]['parlementaire']; count: number; total: number }> = new Map();

      for (const vote of votes) {
        if (!vote.parlementaire.groupe) continue;
        const groupeId = vote.parlementaire.groupe.id;
        const scrutinId = vote.scrutin.id;
        const key = `${groupeId}-${scrutinId}`;

        const positions = groupePositions.get(key);
        if (!positions) continue;

        const pos = positions.get(scrutinId);
        if (!pos) continue;

        const majoritaire = pos.pour > pos.contre ? 'pour' : 'contre';
        const isDissidence = vote.position !== majoritaire && Math.abs(pos.pour - pos.contre) > 5;

        if (!dissidences.has(vote.parlementaire.id)) {
          dissidences.set(vote.parlementaire.id, { parlementaire: vote.parlementaire, count: 0, total: 0 });
        }
        const d = dissidences.get(vote.parlementaire.id)!;
        d.total++;
        if (isDissidence) d.count++;
      }

      // Trier par taux de dissidence
      const result = Array.from(dissidences.values())
        .filter((d) => d.total >= 10) // Au moins 10 votes
        .map((d) => ({
          id: d.parlementaire.id,
          slug: d.parlementaire.slug,
          nom: d.parlementaire.nom,
          prenom: d.parlementaire.prenom,
          photoUrl: d.parlementaire.photoUrl,
          groupe: d.parlementaire.groupe?.nom,
          couleur: d.parlementaire.groupe?.couleur,
          dissidences: d.count,
          totalVotes: d.total,
          tauxDissidence: Math.round((d.count / d.total) * 100),
        }))
        .sort((a, b) => b.tauxDissidence - a.tauxDissidence)
        .slice(0, limit);

      return { data: result };
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
    handler: async (request, reply) => {
      const { periode, limit = 15 } = request.query as { periode?: string; limit?: number };
      const dateFrom = getDateFromPeriode(periode);

      const scrutins = await fastify.prisma.scrutin.findMany({
        where: dateFrom ? { date: { gte: dateFrom } } : undefined,
        select: { tags: true },
      });

      const themeCounts: Record<string, number> = {};
      for (const s of scrutins) {
        for (const tag of s.tags) {
          themeCounts[tag] = (themeCounts[tag] || 0) + 1;
        }
      }

      const result = Object.entries(themeCounts)
        .map(([theme, count]) => ({ theme, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return { data: result };
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
    handler: async (request, reply) => {
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
    handler: async (request, reply) => {
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
