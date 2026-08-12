// =============================================================================
// Module Sitemap - Controller (Routes)
// Routes: /api/v1/sitemap
// =============================================================================
//
// Endpoint dédié à la génération du sitemap du site.
//
// Le sitemap paginait auparavant les listes publiques : ~300 requêtes, dont 218
// pour les seuls scrutins, ce qui saturait le rate-limit (200 req/min) et
// tronquait le résultat à mi-parcours. Chaque page transportait en plus des
// objets complets alors que le sitemap n'a besoin que de quoi construire une
// URL et une date.
//
// Ici : une seule requête, uniquement les champs nécessaires, ~2,5 Mo pour les
// ~28 000 entrées.
// =============================================================================

import { FastifyPluginAsync } from 'fastify';

/** Le sitemap est régénéré une fois par jour, après l'ingestion de 04:00 UTC. */
const CACHE_TTL_24H = 86400;

const CACHE_KEY = 'sitemap:all';

export const sitemapRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      tags: ['Sitemap'],
      summary: 'Données minimales pour la génération du sitemap',
      description:
        "Retourne, pour chaque type d'entité indexable, uniquement les champs " +
        "nécessaires à la construction d'une URL et d'une date de dernière " +
        'modification. Périmètre identique à celui des listes publiques ' +
        '(parlementaires, groupes et sujets actifs uniquement).',
    },
  }, async (_request, reply) => {
    const cached = await fastify.redis.get(CACHE_KEY);
    if (cached) {
      return reply.type('application/json').send(cached);
    }

    // Les groupes ne sont volontairement pas ici : leur liste publique ne
    // retourne que la législature/session courante, logique qui vit dans
    // GroupesService. La dupliquer ici la ferait dériver, et ça ne coûte qu'une
    // requête de plus au sitemap pour une poignée d'entrées.
    const [deputes, senateurs, scrutins, lobbyistes, dossiers, sujets] =
      await Promise.all([
        fastify.prisma.parlementaire.findMany({
          where: { chambre: 'assemblee', actif: true },
          select: { slug: true, updatedAt: true },
        }),
        fastify.prisma.parlementaire.findMany({
          where: { chambre: 'senat', actif: true },
          select: { slug: true, updatedAt: true },
        }),
        fastify.prisma.scrutin.findMany({
          select: { numero: true, chambre: true, session: true, date: true },
          orderBy: { date: 'desc' },
        }),
        fastify.prisma.lobbyiste.findMany({
          select: { id: true, updatedAt: true },
        }),
        // Même périmètre que la liste publique /dossiers : uniquement les
        // dossiers rattachés à au moins un scrutin. Sans ce filtre on
        // publierait des milliers d'URLs sans page correspondante.
        fastify.prisma.dossierLegislatif.findMany({
          where: { scrutins: { some: {} } },
          select: { uid: true, dateDepot: true },
        }),
        fastify.prisma.sujet.findMany({
          where: { actif: true },
          select: { slug: true, updatedAt: true },
        }),
      ]);

    const result = {
      deputes,
      senateurs,
      scrutins,
      lobbyistes,
      dossiers,
      sujets,
      generatedAt: new Date().toISOString(),
    };

    const payload = JSON.stringify(result);
    await fastify.redis.setex(CACHE_KEY, CACHE_TTL_24H, payload);

    return reply.type('application/json').send(payload);
  });
};
