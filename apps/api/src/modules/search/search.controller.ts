// =============================================================================
// Module Search - Controller (Routes)
// Recherche via Meilisearch avec fallback PostgreSQL
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { indexAll, clearAllIndexes } from './indexing.service';
import { buildParlementaireSearchCondition } from '../../utils/search';

// Timeout pour les requêtes (évite les blocages)
const MEILISEARCH_TIMEOUT_MS = 1500; // Réduit de 3s à 1.5s
const DATABASE_TIMEOUT_MS = 5000;    // Timeout pour le fallback DB
const MAX_RETRIES = 2;               // Nombre de retries pour le fallback DB

// Circuit breaker pour Meilisearch - évite de perdre du temps si Meilisearch est down
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
  threshold: 3,           // Ouvre le circuit après 3 échecs
  resetTimeMs: 60000,     // Réessaie après 1 minute
};

function checkCircuitBreaker(): boolean {
  if (!circuitBreaker.isOpen) return true;

  // Vérifier si on peut réessayer (après resetTimeMs)
  if (Date.now() - circuitBreaker.lastFailure > circuitBreaker.resetTimeMs) {
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    return true;
  }
  return false;
}

function recordMeilisearchFailure() {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  if (circuitBreaker.failures >= circuitBreaker.threshold) {
    circuitBreaker.isOpen = true;
  }
}

function recordMeilisearchSuccess() {
  circuitBreaker.failures = 0;
  circuitBreaker.isOpen = false;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Search timeout')), ms)
    ),
  ]);
}

// Retry avec backoff exponentiel
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  timeoutMs: number,
  logger?: any
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (err) {
      lastError = err as Error;
      if (logger && attempt < maxRetries) {
        logger.warn({ attempt, err: lastError.message }, 'Search retry');
      }
      // Petit délai avant retry (backoff: 100ms, 200ms, 400ms...)
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

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

      // Vérifier le circuit breaker avant d'essayer Meilisearch
      if (checkCircuitBreaker()) {
        try {
          const result = await searchWithMeilisearch(fastify, q, type, limit);
          recordMeilisearchSuccess();
          return result;
        } catch (error) {
          recordMeilisearchFailure();
          fastify.log.warn(
            { circuitOpen: circuitBreaker.isOpen, failures: circuitBreaker.failures },
            'Meilisearch search failed, falling back to database'
          );
        }
      }

      // Fallback sur DB avec retry - garantit un résultat complet ou erreur
      try {
        return await withRetry(
          () => searchWithDatabase(fastify, q, type, limit),
          MAX_RETRIES,
          DATABASE_TIMEOUT_MS,
          fastify.log
        );
      } catch (error) {
        fastify.log.error({ err: error }, 'Search failed after retries');
        // Renvoyer une erreur propre plutôt que des résultats partiels
        throw new Error('La recherche est temporairement indisponible. Veuillez réessayer.');
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
        // Recherche rapide multi-index avec timeout
        const [deputesRes, scrutinsRes] = await withTimeout(
          Promise.all([
            fastify.meiliIndexes.deputes.search(q, { limit }),
            fastify.meiliIndexes.scrutins.search(q, { limit: Math.max(2, limit - 3) }),
          ]),
          MEILISEARCH_TIMEOUT_MS
        );

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
    handler: async (_request) => {
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

  // Attendre toutes les promesses avec timeout
  await withTimeout(Promise.all(promises), MEILISEARCH_TIMEOUT_MS);

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
  const searchTerm = q.toLowerCase().trim();
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

  // Construire les conditions de recherche pour parlementaires
  const buildParlementaireWhere = (chambre: string) => ({
    ...buildParlementaireSearchCondition(searchTerm),
    chambre,
    actif: true,
  });

  const parlementaireSelect = {
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
  };

  // Recherche députés (chambre = assemblee)
  if (type === 'all' || type === 'deputes') {
    promises.push(
      fastify.prisma.parlementaire
        .findMany({
          where: buildParlementaireWhere('assemblee'),
          select: parlementaireSelect,
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
          where: buildParlementaireWhere('senat'),
          select: parlementaireSelect,
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
          orderBy: [{ date: 'desc' }, { numero: 'desc' }],
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

  // Attendre toutes les promesses - si une échoue, tout échoue (pas de résultats partiels)
  // Le retry au niveau du handler s'occupera de réessayer
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
  const searchTerm = q.toLowerCase().trim();

  // Utiliser la fonction utilitaire pour la recherche parlementaires
  const parlementaireWhere = {
    ...buildParlementaireSearchCondition(searchTerm),
    actif: true,
  };

  try {
    const [parlementaires, scrutins] = await Promise.all([
      fastify.prisma.parlementaire.findMany({
        where: parlementaireWhere,
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
        orderBy: [{ date: 'desc' }, { numero: 'desc' }],
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
  } catch (err) {
    fastify.log.error({ err }, 'Suggest from database failed');
    return { data: [] };
  }
}
