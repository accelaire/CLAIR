// =============================================================================
// Module Homepage - Endpoint agrégé pour la page d'accueil
// Évite les 6+ appels parallèles qui peuvent surcharger le serveur
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { isInternalRequest } from '../../utils/internal-auth';

// Cache 27h — survit au sync (CRON 5h, durée max ~2h) + marge
// Le cache est renouvelé activement par l'ingestion après chaque sync
const CACHE_TTL = 97200;

// Cache plus court pour l'agenda (change quotidiennement)
const UPCOMING_CACHE_TTL = 900;

const dossierChambre = (legislature: number) => legislature === 0 ? 'senat' : 'assemblee';

interface HomepageStats {
  deputes: number;
  senateurs: number;
  /** Toutes législatures/sessions confondues (mandats clos inclus) — met en avant
   *  la profondeur d'archive derrière le compte des seuls élus en exercice. */
  deputesTotal: number;
  senateursTotal: number;
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

      // Batch 1 — counts parallèles (requêtes légères, ~2ms chacune)
      const [
        deputesCount,
        senateursCount,
        deputesTotalCount,
        senateursTotalCount,
        scrutinsCount,
        lobbyistesCount,
        actionsCount,
        interventionsCount,
        amendementsCount,
        dossiersCount,
      ] = await Promise.all([
        fastify.prisma.parlementaire.count({ where: { chambre: 'assemblee', actif: true } }),
        fastify.prisma.parlementaire.count({ where: { chambre: 'senat', actif: true } }),
        // Sans filtre `actif` : inclut les mandats clos (profondeur d'archive).
        fastify.prisma.parlementaire.count({ where: { chambre: 'assemblee' } }),
        fastify.prisma.parlementaire.count({ where: { chambre: 'senat' } }),
        fastify.prisma.scrutin.count(),
        fastify.prisma.lobbyiste.count(),
        fastify.prisma.actionLobby.count(),
        fastify.prisma.intervention.count(),
        fastify.prisma.amendement.count(),
        fastify.prisma.dossierLegislatif.count({ where: { scrutins: { some: {} } } }),
      ]);

      // Batch 2 — requêtes avec joins/filtres
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
        _count: { select: { scrutins: true, amendements: true } },
        scrutins: {
          orderBy: { date: 'desc' as const },
          take: 1,
          select: { date: true },
        },
      };

      const [lastSync, recentScrutins, recentActions, bigDossiers] = await Promise.all([
        fastify.prisma.syncLog.findFirst({
          where: { statut: 'completed' },
          orderBy: { completedAt: 'desc' },
          select: { completedAt: true },
        }),
        fastify.prisma.scrutin.findMany({
          where: { importance: { gte: 3 } },
          select: {
            id: true, numero: true, chambre: true, session: true,
            date: true, titre: true, sort: true,
            nombrePour: true, nombreContre: true, importance: true,
          },
          orderBy: [{ date: 'desc' }, { numero: 'desc' }],
          take: 6,
        }),
        fastify.prisma.actionLobby.findMany({
          select: {
            id: true, cible: true, dateDebut: true,
            actionDescription: { select: { texte: true } },
            lobbyiste: {
              select: { id: true, nom: true, type: true, secteur: true, siteWeb: true },
            },
          },
          orderBy: { dateDebut: 'desc' },
          take: 6,
        }),
        fastify.prisma.dossierLegislatif.findMany({
          where: { scrutins: { some: { date: { gte: twoMonthsAgo } } } },
          select: dossierSelect,
          orderBy: { scrutins: { _count: 'desc' } },
          take: 2,
        }),
      ]);

      // Batch 3 — dossiers récents par date de dernier scrutin (pas par volume)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const bigIds = bigDossiers.map(d => d.id);

      const recentlyVotedDossiers = await fastify.prisma.dossierLegislatif.findMany({
        where: {
          id: { notIn: bigIds },
          scrutins: { some: { date: { gte: threeMonthsAgo } } },
        },
        select: dossierSelect,
        // Prend un pool large pour trier par date côté JS
        take: 30,
      });

      // Sort by latest scrutin date desc (fraîcheur prime)
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

      // Batch 4 — agenda à venir (TTL court séparé), liste unifiée chronologique
      const upcomingCacheKey = 'homepage:upcoming';
      let upcoming: { events: unknown[] } | null = null;
      const cachedUpcoming = await fastify.redis.get(upcomingCacheKey);
      if (cachedUpcoming) {
        upcoming = JSON.parse(cachedUpcoming);
      } else {
        const now = new Date();
        const TARGET_DAYS = 7;
        const allEvents = await fastify.prisma.reunion.findMany({
          where: {
            dateDebut: { gte: now },
            etat: 'confirme',
            type: { in: ['seance', 'commission'] },
          },
          orderBy: { dateDebut: 'asc' },
          take: 200,
          select: {
            id: true, uid: true, type: true, dateDebut: true, dateFin: true,
            lieu: true, odjResume: true, etat: true, captationVideo: true,
            compteRenduRef: true,
            commission: {
              select: { slug: true, nom: true, nomCourt: true, chambre: true, organeRef: true },
            },
          },
        });
        const seenDays = new Set<string>();
        const events: typeof allEvents = [];
        for (const ev of allEvents) {
          const day = ev.dateDebut.toISOString().split('T')[0]!;
          seenDays.add(day);
          if (seenDays.size > TARGET_DAYS) break;
          events.push(ev);
        }
        upcoming = { events };
        await fastify.redis.setex(upcomingCacheKey, UPCOMING_CACHE_TTL, JSON.stringify(upcoming));
      }

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
        deputesTotal: deputesTotalCount,
        senateursTotal: senateursTotalCount,
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
        recentActions: recentActions.map((a) => ({
          ...a,
          description: a.actionDescription.texte,
          actionDescription: undefined,
        })),
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
            amendementsCount: d._count.amendements,
            lastScrutinDate: d.scrutins[0]?.date || null,
            voteStats: vs,
          };
        }),
        lastUpdate: lastSync?.completedAt || null,
        upcoming,
      };

      // Mettre en cache (27h)
      await fastify.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

      return result;
    },
  });

  // ===========================================================================
  // POST /api/v1/homepage/warm - Invalide et recharge le cache
  // Appelé par l'ingestion après chaque smart-sync
  // ===========================================================================
  fastify.post('/warm', {
    schema: {
      tags: ['Homepage'],
      summary: 'Invalider et recharger le cache homepage',
      description: 'Appelé par le service d\'ingestion après la synchronisation quotidienne',
    },
    handler: async (request, reply) => {
      // Protégé par le secret interne partagé entre l'API et le scheduler.
      // C'est ce même secret qui identifie le frontend (voir utils/internal-auth.ts),
      // avec une comparaison en temps constant.
      if (!isInternalRequest(request)) {
        fastify.log.warn(
          { ip: request.ip, ua: request.headers['user-agent'] || 'none' },
          'Cache warm 403',
        );
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Supprimer les caches existants — le rebuild sera fait par le scheduler via GET
      await fastify.redis.del('homepage:data');
      await fastify.redis.del('homepage:upcoming');

      return { ok: true, message: 'Cache invalidated' };
    },
  });
};
