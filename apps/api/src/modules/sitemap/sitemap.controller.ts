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
import { lastmodParlementaire } from './lastmod-parlementaire';

/** Le sitemap est régénéré une fois par jour, après l'ingestion de 04:00 UTC. */
const CACHE_TTL_24H = 86400;

// Versionnée : la charge utile a gagné un champ `lastModified` par parlementaire.
// Sous l'ancienne clé, la version en cache (24 h) l'aurait masqué jusqu'au
// lendemain du déploiement.
const CACHE_KEY = 'sitemap:all:v2';

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
    const [deputesBruts, senateursBruts, scrutins, lobbyistes, dossiers, sujets, derniersScrutins] =
      await Promise.all([
        fastify.prisma.parlementaire.findMany({
          where: { chambre: 'assemblee', actif: true },
          select: { slug: true, chambre: true, updatedAt: true, iaGeneratedAt: true },
        }),
        fastify.prisma.parlementaire.findMany({
          where: { chambre: 'senat', actif: true },
          select: { slug: true, chambre: true, updatedAt: true, iaGeneratedAt: true },
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
        // Date d'arrivée du dernier scrutin de chaque chambre : voir
        // `lastmod-parlementaire.ts`. ~20 000 lignes, quelques dizaines de ms.
        fastify.prisma.scrutin.groupBy({
          by: ['chambre'],
          _max: { createdAt: true },
        }),
      ]);

    const dernierScrutinParChambre = new Map<string, Date>(
      derniersScrutins
        .filter((r) => r._max.createdAt)
        .map((r) => [r.chambre, r._max.createdAt as Date]),
    );

    // `updatedAt` reste exposé : le front s'en sert pour dater les pages de
    // liste (« dernière ingestion »), où il est juste. `lastModified` est la
    // date à publier pour la fiche elle-même.
    const avecLastmod = (p: (typeof deputesBruts)[number]) => ({
      slug: p.slug,
      updatedAt: p.updatedAt,
      lastModified: lastmodParlementaire(p, dernierScrutinParChambre),
    });
    const deputes = deputesBruts.map(avecLastmod);
    const senateurs = senateursBruts.map(avecLastmod);

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
