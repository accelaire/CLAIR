// =============================================================================
// Module Search - Controller (Routes)
// Recherche PostgreSQL native avec fallback fuzzy pour les parlementaires
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { buildParlementaireSearchCondition } from '../../utils/search';
import { fuzzySearchCandidates, FuzzyCandidate } from '../../utils/fuzzy-search';

const searchQuerySchema = z.object({
  q: z.string().min(2, 'La recherche doit contenir au moins 2 caractères'),
  type: z.enum(['all', 'deputes', 'senateurs', 'scrutins', 'lobbyistes', 'dossiers']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET /api/v1/search - Recherche globale PostgreSQL
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Search'],
      summary: 'Recherche globale',
      description: 'Recherche dans les parlementaires, scrutins, lobbyistes et dossiers',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2, description: 'Terme de recherche' },
          type: { type: 'string', enum: ['all', 'deputes', 'senateurs', 'scrutins', 'lobbyistes', 'dossiers'], default: 'all' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
    handler: async (request) => {
      const { q, type, limit } = searchQuerySchema.parse(request.query);
      return searchWithDatabase(fastify, q, type, limit);
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
      return suggestFromDatabase(fastify, q, limit);
    },
  });
};

// =============================================================================
// Recherche principale (PostgreSQL)
// =============================================================================

async function searchWithDatabase(
  fastify: any,
  q: string,
  type: string,
  limit: number
) {
  const searchTerm = q.toLowerCase().trim();
  const results: Record<string, any[]> = {
    deputes: [],
    senateurs: [],
    scrutins: [],
    lobbyistes: [],
    dossiers: [],
  };

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

  const parlementaireSelect = {
    id: true,
    slug: true,
    chambre: true,
    nom: true,
    prenom: true,
    photoUrl: true,
    groupe: { select: { nom: true, couleur: true } },
    circonscription: { select: { departement: true, nom: true } },
  };

  const searchParlementaires = async (chambre: string) => {
    let rows = await fastify.prisma.parlementaire.findMany({
      where: { ...buildParlementaireSearchCondition(searchTerm), chambre, actif: true },
      select: parlementaireSelect,
      take: limit,
    });
    if (rows.length === 0) {
      rows = await fuzzySearchParlementairesDB(fastify, searchTerm, chambre, parlementaireSelect, limit);
    }
    return rows.map(transformParlementaire);
  };

  const tasks: Promise<void>[] = [];

  if (type === 'all' || type === 'deputes') {
    tasks.push(searchParlementaires('assemblee').then(r => { results.deputes = r; }));
  }
  if (type === 'all' || type === 'senateurs') {
    tasks.push(searchParlementaires('senat').then(r => { results.senateurs = r; }));
  }
  if (type === 'all' || type === 'scrutins') {
    tasks.push(
      fastify.prisma.scrutin.findMany({
        where: { titre: { contains: searchTerm, mode: 'insensitive' } },
        select: {
          id: true, numero: true, chambre: true, session: true, date: true,
          titre: true, sort: true, typeVote: true, importance: true, tags: true,
          nombrePour: true, nombreContre: true,
        },
        orderBy: [{ date: 'desc' }, { numero: 'desc' }],
        take: limit,
      }).then((rows: any[]) => {
        results.scrutins = rows.map(s => ({ ...s, _type: 'scrutin' }));
      })
    );
  }
  if (type === 'all' || type === 'lobbyistes') {
    tasks.push(
      fastify.prisma.lobbyiste.findMany({
        where: {
          OR: [
            { nom: { contains: searchTerm, mode: 'insensitive' } },
            { secteur: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nom: true, type: true, secteur: true, budgetAnnuel: true, nbLobbyistes: true, ville: true },
        take: limit,
      }).then((rows: any[]) => {
        results.lobbyistes = rows.map(l => ({ ...l, _type: 'lobbyiste' }));
      })
    );
  }
  if (type === 'all' || type === 'dossiers') {
    tasks.push(
      fastify.prisma.dossierLegislatif.findMany({
        where: {
          OR: [
            { titre: { contains: searchTerm, mode: 'insensitive' } },
            { loiNumero: { contains: searchTerm, mode: 'insensitive' } },
          ],
          scrutins: { some: {} },
        },
        select: { id: true, uid: true, titre: true, legislature: true, etat: true, procedureLibelle: true, loiNumero: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }).then((rows: any[]) => {
        results.dossiers = rows.map(d => ({ ...d, _type: 'dossier' }));
      })
    );
  }

  await Promise.all(tasks);

  if (type === 'all') {
    const allResults = [
      ...results.deputes,
      ...results.senateurs,
      ...results.scrutins,
      ...results.lobbyistes,
      ...results.dossiers,
    ];
    return {
      data: allResults.slice(0, limit),
      meta: {
        query: q,
        counts: {
          deputes: results.deputes.length,
          senateurs: results.senateurs.length,
          scrutins: results.scrutins.length,
          lobbyistes: results.lobbyistes.length,
          dossiers: results.dossiers.length,
          total: allResults.length,
        },
      },
    };
  }

  return {
    data: results[type],
    meta: { query: q, type, count: results[type].length },
  };
}

// =============================================================================
// Suggestions
// =============================================================================

async function suggestFromDatabase(fastify: any, q: string, limit: number) {
  const searchTerm = q.toLowerCase().trim();
  const parlementaireSelect = {
    slug: true, chambre: true, nom: true, prenom: true,
    groupe: { select: { nom: true } },
  };

  let [parlementaires, scrutins] = await Promise.all([
    fastify.prisma.parlementaire.findMany({
      where: { ...buildParlementaireSearchCondition(searchTerm), actif: true },
      select: parlementaireSelect,
      take: limit,
    }),
    fastify.prisma.scrutin.findMany({
      where: { titre: { contains: searchTerm, mode: 'insensitive' } },
      select: { numero: true, chambre: true, session: true, titre: true },
      orderBy: [{ date: 'desc' }, { numero: 'desc' }],
      take: Math.max(2, limit - 3),
    }),
  ]);

  if (parlementaires.length === 0) {
    parlementaires = await fuzzySearchParlementairesDB(fastify, searchTerm, undefined, parlementaireSelect, limit);
  }

  return {
    data: [
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
        session: s.session,
      })),
    ],
  };
}

// =============================================================================
// Fuzzy fallback pour les parlementaires
// =============================================================================

async function fuzzySearchParlementairesDB(
  fastify: any,
  search: string,
  chambre: string | undefined,
  select: any,
  limit: number
) {
  const candidates: FuzzyCandidate[] = await fastify.prisma.parlementaire.findMany({
    where: { actif: true, ...(chambre && { chambre }) },
    select: { id: true, nom: true, prenom: true, slug: true },
  });

  const fuzzyResults = fuzzySearchCandidates(search, candidates, limit);
  if (fuzzyResults.length === 0) return [];

  const matchingIds = fuzzyResults.map(r => r.id);
  const parlementaires = await fastify.prisma.parlementaire.findMany({
    where: { id: { in: matchingIds } },
    select,
  });

  const idOrder = new Map(matchingIds.map((id: string, idx: number) => [id, idx]));
  parlementaires.sort((a: any, b: any) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

  return parlementaires;
}
