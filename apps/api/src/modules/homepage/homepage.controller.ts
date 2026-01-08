// =============================================================================
// Module Homepage - Endpoint agrégé pour la page d'accueil
// Évite les 6+ appels parallèles qui peuvent surcharger le serveur
// =============================================================================

import { FastifyPluginAsync } from 'fastify';

const CACHE_TTL = 300; // 5 minutes - données homepage pas critiques

interface HomepageStats {
  deputes: number;
  senateurs: number;
  scrutins: number;
  lobbyistes: number;
  actionsLobby: number;
  interventions: number;
  amendements: number;
}

export const homepageRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET /api/v1/homepage - Données agrégées pour la page d'accueil
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Homepage'],
      summary: 'Données agrégées pour la page d\'accueil',
      description: 'Retourne toutes les stats et scrutins récents en un seul appel',
    },
    handler: async (_request, _reply) => {
      const cacheKey = 'homepage:data';

      // Vérifier le cache
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Exécuter toutes les requêtes en parallèle (côté serveur c'est OK)
      const [
        deputesCount,
        senateursCount,
        scrutinsCount,
        lobbyingStats,
        analyticsStats,
        recentScrutins,
      ] = await Promise.all([
        // Counts optimisés (pas de findMany, juste count)
        fastify.prisma.parlementaire.count({
          where: { chambre: 'assemblee', actif: true },
        }),
        fastify.prisma.parlementaire.count({
          where: { chambre: 'senat', actif: true },
        }),
        fastify.prisma.scrutin.count(),

        // Stats lobbying
        Promise.all([
          fastify.prisma.lobbyiste.count(),
          fastify.prisma.actionLobby.count(),
        ]).then(([lobbyistes, actions]) => ({ lobbyistes, actions })),

        // Stats analytics
        Promise.all([
          fastify.prisma.intervention.count(),
          fastify.prisma.amendement.count(),
        ]).then(([interventions, amendements]) => ({ interventions, amendements })),

        // Scrutins importants récents
        fastify.prisma.scrutin.findMany({
          where: {
            importance: { gte: 3 },
          },
          select: {
            id: true,
            numero: true,
            chambre: true,
            date: true,
            titre: true,
            sort: true,
            nombrePour: true,
            nombreContre: true,
            importance: true,
          },
          orderBy: [{ date: 'desc' }, { numero: 'desc' }],
          take: 6,
        }),
      ]);

      const stats: HomepageStats = {
        deputes: deputesCount,
        senateurs: senateursCount,
        scrutins: scrutinsCount,
        lobbyistes: lobbyingStats.lobbyistes,
        actionsLobby: lobbyingStats.actions,
        interventions: analyticsStats.interventions,
        amendements: analyticsStats.amendements,
      };

      const result = {
        stats,
        recentScrutins,
      };

      // Mettre en cache
      await fastify.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

      return result;
    },
  });
};
