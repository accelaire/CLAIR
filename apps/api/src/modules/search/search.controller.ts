// =============================================================================
// Module Search - Controller (Routes)
// Recherche via Meilisearch avec fallback PostgreSQL
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { indexAll, clearAllIndexes } from './indexing.service';

const searchQuerySchema = z.object({
  q: z.string().min(2, 'La recherche doit contenir au moins 2 caractères'),
  type: z.enum(['all', 'deputes', 'senateurs', 'scrutins', 'lobbyistes']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET /api/v1/search - Recherche globale via Meilisearch
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Search'],
      summary: 'Recherche globale',
      description: 'Recherche dans les députés, sénateurs, scrutins et lobbyistes via Meilisearch',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2, description: 'Terme de recherche' },
          type: { type: 'string', enum: ['all', 'deputes', 'senateurs', 'scrutins', 'lobbyistes'], default: 'all' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
    handler: async (request) => {
      const { q, type, limit } = searchQuerySchema.parse(request.query);

      // Essayer Meilisearch d'abord
      try {
        return await searchWithMeilisearch(fastify, q, type, limit);
      } catch (error) {
        fastify.log.warn('Meilisearch search failed, falling back to database');
        return await searchWithDatabase(fastify, q, type, limit);
      }
    },
  });

  // ===========================================================================
  // GET /api/v1/search/suggest - Suggestions de recherche
  // ===========================================================================
  fastify.get('/suggest', {
    schema: {
      tags: ['Search'],
      summary: 'Suggestions de recherche',
      description: 'Retourne des suggestions basées sur le début de la saisie',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
        },
      },
    },
    handler: async (request) => {
      const { q, limit = 5 } = request.query as { q: string; limit?: number };

      try {
        // Recherche rapide multi-index
        const [deputesRes, scrutinsRes] = await Promise.all([
          fastify.meiliIndexes.deputes.search(q, { limit }),
          fastify.meiliIndexes.scrutins.search(q, { limit: Math.max(2, limit - 3) }),
        ]);

        const suggestions = [
          ...deputesRes.hits.map((d) => ({
            type: 'depute',
            value: d.nomComplet,
            slug: d.slug,
            meta: d.groupe,
          })),
          ...scrutinsRes.hits.map((s) => ({
            type: 'scrutin',
            value: s.titre.length > 60 ? s.titre.substring(0, 60) + '...' : s.titre,
            numero: s.numero,
          })),
        ];

        return { data: suggestions };
      } catch {
        // Fallback database
        return await suggestFromDatabase(fastify, q, limit);
      }
    },
  });

  // ===========================================================================
  // POST /api/v1/search/reindex - Réindexer toutes les données (admin)
  // ===========================================================================
  fastify.post('/reindex', {
    schema: {
      tags: ['Search'],
      summary: 'Réindexer Meilisearch',
      description: 'Réindexe toutes les données dans Meilisearch (admin uniquement)',
    },
    handler: async (request) => {
      // TODO: Add auth check for admin
      const results = await indexAll(fastify);
      return {
        success: true,
        message: 'Indexation terminée',
        indexed: results,
      };
    },
  });

  // ===========================================================================
  // DELETE /api/v1/search/indexes - Vider les index (admin)
  // ===========================================================================
  fastify.delete('/indexes', {
    schema: {
      tags: ['Search'],
      summary: 'Vider les index Meilisearch',
      description: 'Supprime tous les documents des index (admin uniquement)',
    },
    handler: async () => {
      // TODO: Add auth check for admin
      await clearAllIndexes(fastify);
      return {
        success: true,
        message: 'Index vidés',
      };
    },
  });
};

// =============================================================================
// Recherche Meilisearch
// =============================================================================

async function searchWithMeilisearch(
  fastify: any,
  q: string,
  type: string,
  limit: number
) {
  const results: {
    deputes: any[];
    senateurs: any[];
    scrutins: any[];
    lobbyistes: any[];
  } = {
    deputes: [],
    senateurs: [],
    scrutins: [],
    lobbyistes: [],
  };

  const promises: Promise<void>[] = [];

  // Recherche députés (chambre = assemblee)
  if (type === 'all' || type === 'deputes') {
    promises.push(
      fastify.meiliIndexes.deputes.search(q, {
        limit,
        filter: 'chambre = assemblee',
      }).then((res: any) => {
        results.deputes = res.hits.map((hit: any) => ({
          ...hit,
          _type: 'depute',
        }));
      })
    );
  }

  // Recherche sénateurs (chambre = senat)
  if (type === 'all' || type === 'senateurs') {
    promises.push(
      fastify.meiliIndexes.deputes.search(q, {
        limit,
        filter: 'chambre = senat',
      }).then((res: any) => {
        results.senateurs = res.hits.map((hit: any) => ({
          ...hit,
          _type: 'senateur',
        }));
      })
    );
  }

  if (type === 'all' || type === 'scrutins') {
    promises.push(
      fastify.meiliIndexes.scrutins.search(q, { limit }).then((res: any) => {
        results.scrutins = res.hits.map((hit: any) => ({
          ...hit,
          _type: 'scrutin',
        }));
      })
    );
  }

  if (type === 'all' || type === 'lobbyistes') {
    promises.push(
      fastify.meiliIndexes.lobbyistes.search(q, { limit }).then((res: any) => {
        results.lobbyistes = res.hits.map((hit: any) => ({
          ...hit,
          _type: 'lobbyiste',
        }));
      })
    );
  }

  await Promise.all(promises);

  if (type === 'all') {
    const allResults = [
      ...results.deputes,
      ...results.senateurs,
      ...results.scrutins,
      ...results.lobbyistes,
    ];

    return {
      data: allResults.slice(0, limit),
      meta: {
        query: q,
        engine: 'meilisearch',
        counts: {
          deputes: results.deputes.length,
          senateurs: results.senateurs.length,
          scrutins: results.scrutins.length,
          lobbyistes: results.lobbyistes.length,
          total: allResults.length,
        },
      },
    };
  }

  return {
    data: results[type as keyof typeof results],
    meta: {
      query: q,
      type,
      engine: 'meilisearch',
      count: results[type as keyof typeof results].length,
    },
  };
}

// =============================================================================
// Fallback Database
// =============================================================================

async function searchWithDatabase(
  fastify: any,
  q: string,
  type: string,
  limit: number
) {
  const searchTerm = q.toLowerCase();
  const results: {
    deputes: any[];
    senateurs: any[];
    scrutins: any[];
    lobbyistes: any[];
  } = {
    deputes: [],
    senateurs: [],
    scrutins: [],
    lobbyistes: [],
  };

  const promises: Promise<void>[] = [];

  // Helper pour transformer les parlementaires
  const transformParlementaire = (d: any) => ({
    id: d.id,
    slug: d.slug,
    chambre: d.chambre,
    nom: d.nom,
    prenom: d.prenom,
    nomComplet: `${d.prenom} ${d.nom}`,
    photoUrl: d.photoUrl,
    groupe: d.groupe?.nom,
    groupeCouleur: d.groupe?.couleur,
    circonscription: d.circonscription?.nom,
    departement: d.circonscription?.departement,
    _type: d.chambre === 'senat' ? 'senateur' : 'depute',
  });

  // Recherche députés (chambre = assemblee)
  if (type === 'all' || type === 'deputes') {
    promises.push(
      fastify.prisma.parlementaire
        .findMany({
          where: {
            OR: [
              { nom: { contains: searchTerm, mode: 'insensitive' } },
              { prenom: { contains: searchTerm, mode: 'insensitive' } },
              { slug: { contains: searchTerm, mode: 'insensitive' } },
            ],
            chambre: 'assemblee',
            actif: true,
          },
          select: {
            id: true,
            slug: true,
            chambre: true,
            nom: true,
            prenom: true,
            photoUrl: true,
            groupe: {
              select: { nom: true, couleur: true },
            },
            circonscription: {
              select: { departement: true, nom: true },
            },
          },
          take: limit,
        })
        .then((parlementaires: any[]) => {
          results.deputes = parlementaires.map(transformParlementaire);
        })
    );
  }

  // Recherche sénateurs (chambre = senat)
  if (type === 'all' || type === 'senateurs') {
    promises.push(
      fastify.prisma.parlementaire
        .findMany({
          where: {
            OR: [
              { nom: { contains: searchTerm, mode: 'insensitive' } },
              { prenom: { contains: searchTerm, mode: 'insensitive' } },
              { slug: { contains: searchTerm, mode: 'insensitive' } },
            ],
            chambre: 'senat',
            actif: true,
          },
          select: {
            id: true,
            slug: true,
            chambre: true,
            nom: true,
            prenom: true,
            photoUrl: true,
            groupe: {
              select: { nom: true, couleur: true },
            },
            circonscription: {
              select: { departement: true, nom: true },
            },
          },
          take: limit,
        })
        .then((parlementaires: any[]) => {
          results.senateurs = parlementaires.map(transformParlementaire);
        })
    );
  }

  if (type === 'all' || type === 'scrutins') {
    promises.push(
      fastify.prisma.scrutin
        .findMany({
          where: {
            titre: { contains: searchTerm, mode: 'insensitive' },
          },
          select: {
            id: true,
            numero: true,
            chambre: true,
            date: true,
            titre: true,
            sort: true,
            typeVote: true,
            importance: true,
            tags: true,
            nombrePour: true,
            nombreContre: true,
          },
          orderBy: { date: 'desc' },
          take: limit,
        })
        .then((scrutins: any[]) => {
          results.scrutins = scrutins.map((s) => ({
            ...s,
            _type: 'scrutin',
          }));
        })
    );
  }

  if (type === 'all' || type === 'lobbyistes') {
    promises.push(
      fastify.prisma.lobbyiste
        .findMany({
          where: {
            nom: { contains: searchTerm, mode: 'insensitive' },
          },
          select: {
            id: true,
            nom: true,
            type: true,
            secteur: true,
            budgetAnnuel: true,
            nbLobbyistes: true,
            ville: true,
          },
          take: limit,
        })
        .then((lobbyistes: any[]) => {
          results.lobbyistes = lobbyistes.map((l) => ({
            ...l,
            _type: 'lobbyiste',
          }));
        })
    );
  }

  await Promise.all(promises);

  if (type === 'all') {
    const allResults = [
      ...results.deputes,
      ...results.senateurs,
      ...results.scrutins,
      ...results.lobbyistes,
    ];

    return {
      data: allResults.slice(0, limit),
      meta: {
        query: q,
        engine: 'database',
        counts: {
          deputes: results.deputes.length,
          senateurs: results.senateurs.length,
          scrutins: results.scrutins.length,
          lobbyistes: results.lobbyistes.length,
          total: allResults.length,
        },
      },
    };
  }

  return {
    data: results[type as keyof typeof results],
    meta: {
      query: q,
      type,
      engine: 'database',
      count: results[type as keyof typeof results].length,
    },
  };
}

async function suggestFromDatabase(fastify: any, q: string, limit: number) {
  const searchTerm = q.toLowerCase();

  const [parlementaires, scrutins] = await Promise.all([
    fastify.prisma.parlementaire.findMany({
      where: {
        OR: [
          { nom: { startsWith: searchTerm, mode: 'insensitive' } },
          { prenom: { startsWith: searchTerm, mode: 'insensitive' } },
        ],
        actif: true,
      },
      select: {
        slug: true,
        chambre: true,
        nom: true,
        prenom: true,
        groupe: { select: { nom: true } },
      },
      take: limit,
    }),
    fastify.prisma.scrutin.findMany({
      where: {
        titre: { contains: searchTerm, mode: 'insensitive' },
      },
      select: {
        numero: true,
        chambre: true,
        titre: true,
      },
      orderBy: { date: 'desc' },
      take: Math.max(2, limit - 3),
    }),
  ]);

  const suggestions = [
    ...parlementaires.map((d: any) => ({
      type: d.chambre === 'senat' ? 'senateur' : 'depute',
      value: `${d.prenom} ${d.nom}`,
      slug: d.slug,
      chambre: d.chambre,
      meta: d.groupe?.nom,
    })),
    ...scrutins.map((s: any) => ({
      type: 'scrutin',
      value: s.titre.length > 60 ? s.titre.substring(0, 60) + '...' : s.titre,
      numero: s.numero,
      chambre: s.chambre,
    })),
  ];

  return { data: suggestions };
}
