// =============================================================================
// Module Homepage - Endpoint agrégé pour la page d'accueil
// Évite les 6+ appels parallèles qui peuvent surcharger le serveur
// =============================================================================

import { FastifyPluginAsync } from 'fastify';

// Cache 1 heure - route optimisée
const CACHE_TTL = 3600;

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

      // Exécuter les requêtes SÉQUENTIELLEMENT pour éviter de saturer le pool
      // de connexions Prisma (max 15) et provoquer des timeouts
      const deputesCount = await fastify.prisma.parlementaire.count({
        where: { chambre: 'assemblee', actif: true },
      });

      const senateursCount = await fastify.prisma.parlementaire.count({
        where: { chambre: 'senat', actif: true },
      });

      const scrutinsCount = await fastify.prisma.scrutin.count();

      const lobbyistesCount = await fastify.prisma.lobbyiste.count();
      const actionsCount = await fastify.prisma.actionLobby.count();

      const interventionsCount = await fastify.prisma.intervention.count();
      const amendementsCount = await fastify.prisma.amendement.count();

      // Dernière mise à jour (dernier sync réussi)
      const lastSync = await fastify.prisma.syncLog.findFirst({
        where: { statut: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });

      const recentScrutins = await fastify.prisma.scrutin.findMany({
        where: {
          importance: { gte: 3 },
        },
        select: {
          id: true,
          numero: true,
          chambre: true,
          session: true,
          date: true,
          titre: true,
          sort: true,
          nombrePour: true,
          nombreContre: true,
          importance: true,
        },
        orderBy: [{ date: 'desc' }, { numero: 'desc' }],
        take: 6,
      });

      const stats: HomepageStats = {
        deputes: deputesCount,
        senateurs: senateursCount,
        scrutins: scrutinsCount,
        lobbyistes: lobbyistesCount,
        actionsLobby: actionsCount,
        interventions: interventionsCount,
        amendements: amendementsCount,
      };

      const result = {
        stats,
        recentScrutins,
        lastUpdate: lastSync?.completedAt || null,
      };

      // Mettre en cache (1 heure)
      await fastify.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

      return result;
    },
  });
};
