// =============================================================================
// Module Homepage - Endpoint agrégé pour la page d'accueil
// Évite les 6+ appels parallèles qui peuvent surcharger le serveur
// =============================================================================

import { FastifyPluginAsync } from 'fastify';

// Cache 1 heure - route optimisée
const CACHE_TTL = 3600;

const dossierChambre = (legislature: number) => legislature === 0 ? 'senat' : 'assemblee';

interface HomepageStats {
  deputes: number;
  senateurs: number;
  scrutins: number;
  dossiers: number;
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

      const dossiersCount = await fastify.prisma.dossierLegislatif.count({
        where: { scrutins: { some: {} } },
      });

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

      // Dernières actions de lobbying déclarées
      const recentActions = await fastify.prisma.actionLobby.findMany({
        select: {
          id: true,
          description: true,
          cible: true,
          dateDebut: true,
          lobbyiste: {
            select: {
              id: true,
              nom: true,
              type: true,
              secteur: true,
              siteWeb: true,
            },
          },
        },
        orderBy: { dateDebut: 'desc' },
        take: 6,
      });

      // Trending dossiers: recently voted + 1-2 "big" dossiers from last 2 months
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const dossierSelect = {
        id: true,
        uid: true,
        titre: true,
        titreCourt: true,
        legislature: true,
        etat: true,
        procedureLibelle: true,
        _count: { select: { scrutins: true } },
        scrutins: {
          orderBy: { date: 'desc' as const },
          take: 1,
          select: { date: true },
        },
      };

      // 1) Dossiers with most scrutins in last 2 months (big/hot dossiers) — max 2
      const bigDossiers = await fastify.prisma.dossierLegislatif.findMany({
        where: {
          scrutins: { some: { date: { gte: twoMonthsAgo } } },
        },
        select: dossierSelect,
        orderBy: { scrutins: { _count: 'desc' } },
        take: 2,
      });

      // 2) Most recently voted dossiers — fill the rest up to 8 total
      const bigIds = bigDossiers.map(d => d.id);
      const recentlyVotedDossiers = await fastify.prisma.dossierLegislatif.findMany({
        where: {
          id: { notIn: bigIds },
          scrutins: { some: {} },
        },
        select: dossierSelect,
      });

      // Sort by latest scrutin date desc
      recentlyVotedDossiers.sort((a, b) => {
        const da = a.scrutins[0]?.date;
        const db = b.scrutins[0]?.date;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db.getTime() - da.getTime();
      });

      const fillCount = 8 - bigDossiers.length;
      const trendingDossiers = [...bigDossiers, ...recentlyVotedDossiers.slice(0, fillCount)];

      // Fetch vote stats (adopté/rejeté) per dossier
      const dossierIds = trendingDossiers.map(d => d.id);
      const voteStats = await fastify.prisma.scrutin.groupBy({
        by: ['dossierId', 'sort'],
        where: { dossierId: { in: dossierIds } },
        _count: true,
      });

      const statsMap = new Map<string, { adopte: number; rejete: number }>();
      for (const row of voteStats) {
        if (!row.dossierId) continue;
        const entry = statsMap.get(row.dossierId) || { adopte: 0, rejete: 0 };
        if (row.sort === 'adopte') entry.adopte = row._count;
        else if (row.sort === 'rejete') entry.rejete = row._count;
        statsMap.set(row.dossierId, entry);
      }

      const stats: HomepageStats = {
        deputes: deputesCount,
        senateurs: senateursCount,
        scrutins: scrutinsCount,
        dossiers: dossiersCount,
        lobbyistes: lobbyistesCount,
        actionsLobby: actionsCount,
        interventions: interventionsCount,
        amendements: amendementsCount,
      };

      const result = {
        stats,
        recentScrutins,
        recentActions,
        trendingDossiers: trendingDossiers.map((d) => {
          const vs = statsMap.get(d.id) || { adopte: 0, rejete: 0 };
          return {
            id: d.id,
            uid: d.uid,
            titre: d.titre,
            titreCourt: d.titreCourt,
            chambre: dossierChambre(d.legislature),
            etat: d.etat,
            procedureLibelle: d.procedureLibelle,
            scrutinsCount: d._count.scrutins,
            lastScrutinDate: d.scrutins[0]?.date || null,
            voteStats: vs,
          };
        }),
        lastUpdate: lastSync?.completedAt || null,
      };

      // Mettre en cache (1 heure)
      await fastify.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

      return result;
    },
  });
};
