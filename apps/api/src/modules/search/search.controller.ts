import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { buildParlementaireSearchCondition } from '../../utils/search';
import { fuzzySearchCandidates, FuzzyCandidate, fuzzySearchGeneric, GenericFuzzyCandidate } from '../../utils/fuzzy-search';

const SEARCH_TYPES = ['all', 'deputes', 'senateurs', 'scrutins', 'lobbyistes', 'dossiers', 'groupes', 'commissions', 'sujets'] as const;

const searchQuerySchema = z.object({
  q: z.string().min(2, 'La recherche doit contenir au moins 2 caractères'),
  type: z.enum(SEARCH_TYPES).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  page: z.coerce.number().int().min(1).default(1),
});

interface CategorySearchResult {
  data: any[];
  total: number;
}

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      tags: ['Search'],
      summary: 'Recherche globale',
      description: 'Recherche dans les parlementaires, scrutins, lobbyistes, dossiers, groupes, commissions et sujets',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2, description: 'Terme de recherche' },
          type: { type: 'string', enum: [...SEARCH_TYPES], default: 'all' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 30 },
          page: { type: 'integer', minimum: 1, default: 1, description: 'Page (ignoré pour type=all)' },
        },
      },
    },
    handler: async (request) => {
      const { q, type, limit, page } = searchQuerySchema.parse(request.query);
      return searchWithDatabase(fastify, q, type, limit, page);
    },
  });

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
// Recherche principale
// =============================================================================

const parlementaireSelect = {
  id: true, slug: true, chambre: true, nom: true, prenom: true, photoUrl: true,
  groupe: { select: { nom: true, couleur: true } },
  circonscription: { select: { departement: true, nom: true } },
};

const transformParlementaire = (d: any) => ({
  id: d.id, slug: d.slug, chambre: d.chambre, nom: d.nom, prenom: d.prenom,
  nomComplet: `${d.prenom} ${d.nom}`, photoUrl: d.photoUrl,
  groupe: d.groupe?.nom, groupeCouleur: d.groupe?.couleur,
  circonscription: d.circonscription?.nom, departement: d.circonscription?.departement,
  _type: d.chambre === 'senat' ? 'senateur' : 'depute',
});

const groupeSelect = {
  id: true, slug: true, nom: true, nomComplet: true, couleur: true,
  chambre: true, actif: true, statsMembresActifs: true,
};

const commissionSelect = {
  id: true, slug: true, nom: true, nomCourt: true,
  chambre: true, type: true, actif: true,
};

const sujetSelect = {
  id: true, slug: true, label: true, description: true,
  category: true, status: true, dossierCount: true, scrutinCount: true,
};

async function searchWithDatabase(
  fastify: any,
  q: string,
  type: string,
  limit: number,
  page: number,
) {
  const searchTerm = q.toLowerCase().trim();
  const skip = (page - 1) * limit;
  const isAll = type === 'all';
  const PREVIEW_LIMIT = 5;

  // Always search ALL categories for accurate cross-category counts.
  // Active type gets full pagination; others get preview-size results.
  const pg = (cat: string) => type === cat
    ? { skip, take: limit }
    : { skip: 0, take: PREVIEW_LIMIT };

  const searchResults: Partial<Record<string, CategorySearchResult>> = {};
  const tasks: Promise<void>[] = [
    searchParlementaires(fastify, searchTerm, 'assemblee', pg('deputes').skip, pg('deputes').take)
      .then(r => { searchResults.deputes = r; }),
    searchParlementaires(fastify, searchTerm, 'senat', pg('senateurs').skip, pg('senateurs').take)
      .then(r => { searchResults.senateurs = r; }),
    searchExact(
      fastify.prisma.scrutin,
      { titre: { contains: searchTerm, mode: 'insensitive' as const } },
      {
        id: true, numero: true, chambre: true, session: true, date: true,
        titre: true, sort: true, typeVote: true, importance: true, tags: true,
        nombrePour: true, nombreContre: true,
      },
      [{ date: 'desc' }, { numero: 'desc' }],
      pg('scrutins').skip, pg('scrutins').take,
      (s: any) => ({ ...s, _type: 'scrutin' as const }),
    ).then(r => { searchResults.scrutins = r; }),
    searchExact(
      fastify.prisma.lobbyiste,
      {
        OR: [
          { nom: { contains: searchTerm, mode: 'insensitive' as const } },
          { secteur: { contains: searchTerm, mode: 'insensitive' as const } },
        ],
      },
      { id: true, nom: true, type: true, secteur: true, budgetAnnuel: true, nbLobbyistes: true, ville: true },
      undefined,
      pg('lobbyistes').skip, pg('lobbyistes').take,
      (l: any) => ({ ...l, _type: 'lobbyiste' as const }),
    ).then(r => { searchResults.lobbyistes = r; }),
    searchExact(
      fastify.prisma.dossierLegislatif,
      {
        OR: [
          { titre: { contains: searchTerm, mode: 'insensitive' as const } },
          { loiNumero: { contains: searchTerm, mode: 'insensitive' as const } },
        ],
        scrutins: { some: {} },
      },
      { id: true, uid: true, titre: true, legislature: true, etat: true, procedureLibelle: true, loiNumero: true },
      { updatedAt: 'desc' },
      pg('dossiers').skip, pg('dossiers').take,
      (d: any) => ({ ...d, _type: 'dossier' as const }),
    ).then(r => { searchResults.dossiers = r; }),
    searchGroupes(fastify, searchTerm, pg('groupes').take, pg('groupes').skip)
      .then(r => { searchResults.groupes = r; }),
    searchCommissions(fastify, searchTerm, pg('commissions').take, pg('commissions').skip)
      .then(r => { searchResults.commissions = r; }),
    searchSujets(fastify, searchTerm, pg('sujets').take, pg('sujets').skip)
      .then(r => { searchResults.sujets = r; }),
  ];

  await Promise.all(tasks);

  const counts = {
    deputes: searchResults.deputes?.total ?? 0,
    senateurs: searchResults.senateurs?.total ?? 0,
    scrutins: searchResults.scrutins?.total ?? 0,
    lobbyistes: searchResults.lobbyistes?.total ?? 0,
    dossiers: searchResults.dossiers?.total ?? 0,
    groupes: searchResults.groupes?.total ?? 0,
    commissions: searchResults.commissions?.total ?? 0,
    sujets: searchResults.sujets?.total ?? 0,
    total: 0,
  };
  counts.total = counts.deputes + counts.senateurs + counts.scrutins + counts.lobbyistes
    + counts.dossiers + counts.groupes + counts.commissions + counts.sujets;

  if (isAll) {
    return {
      sections: {
        deputes: searchResults.deputes?.data ?? [],
        senateurs: searchResults.senateurs?.data ?? [],
        scrutins: searchResults.scrutins?.data ?? [],
        lobbyistes: searchResults.lobbyistes?.data ?? [],
        dossiers: searchResults.dossiers?.data ?? [],
        groupes: searchResults.groupes?.data ?? [],
        commissions: searchResults.commissions?.data ?? [],
        sujets: searchResults.sujets?.data ?? [],
      },
      meta: { query: q, counts },
    };
  }

  const result = searchResults[type];
  const typeTotal = result?.total ?? 0;
  return {
    data: result?.data ?? [],
    meta: {
      query: q, type, counts,
      page, limit,
      total: typeTotal,
      totalPages: Math.ceil(typeTotal / limit),
      hasNext: page * limit < typeTotal,
    },
  };
}

// =============================================================================
// Search helpers
// =============================================================================

async function searchExact(
  model: any,
  where: any,
  select: any,
  orderBy: any,
  skip: number,
  take: number,
  transform: (row: any) => any,
): Promise<CategorySearchResult> {
  const [rows, total] = await Promise.all([
    model.findMany({ where, select, ...(orderBy && { orderBy }), skip, take }),
    model.count({ where }),
  ]);
  return { data: rows.map(transform), total };
}

// =============================================================================
// Parlementaires (exact + fuzzy)
// =============================================================================

async function searchParlementaires(
  fastify: any,
  searchTerm: string,
  chambre: string,
  skip: number,
  take: number,
): Promise<CategorySearchResult> {
  const where = { ...buildParlementaireSearchCondition(searchTerm), chambre, actif: true };

  const [rows, dbTotal] = await Promise.all([
    fastify.prisma.parlementaire.findMany({ where, select: parlementaireSelect, skip, take }),
    fastify.prisma.parlementaire.count({ where }),
  ]);

  if (dbTotal > 0) {
    return { data: rows.map(transformParlementaire), total: dbTotal };
  }

  // Fuzzy fallback — score all candidates, paginate in-memory
  const candidates: FuzzyCandidate[] = await fastify.prisma.parlementaire.findMany({
    where: { actif: true, chambre },
    select: { id: true, nom: true, prenom: true, slug: true },
  });

  const allFuzzy = fuzzySearchCandidates(searchTerm, candidates, candidates.length);
  if (allFuzzy.length === 0) return { data: [], total: 0 };

  const pageSlice = allFuzzy.slice(skip, skip + take);
  if (pageSlice.length === 0) return { data: [], total: allFuzzy.length };

  const matchingIds = pageSlice.map(r => r.id);
  const parlementaires = await fastify.prisma.parlementaire.findMany({
    where: { id: { in: matchingIds } },
    select: parlementaireSelect,
  });

  const idOrder = new Map(matchingIds.map((id: string, idx: number) => [id, idx]));
  parlementaires.sort((a: any, b: any) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

  return { data: parlementaires.map(transformParlementaire), total: allFuzzy.length };
}

// =============================================================================
// Fuzzy fallback — generic (groupes, commissions, sujets)
// =============================================================================

async function fuzzyFallbackGeneric(
  fastify: any,
  model: string,
  searchTerm: string,
  candidateSelect: any,
  labelsExtractor: (row: any) => string[],
  dataSelect: any,
  take: number,
  skip: number,
): Promise<CategorySearchResult> {
  const allCandidates = await (fastify.prisma as any)[model].findMany({
    where: { actif: true },
    select: candidateSelect,
  });
  const candidates: GenericFuzzyCandidate[] = allCandidates.map((r: any) => ({
    id: r.id,
    labels: labelsExtractor(r),
  }));

  const allFuzzy = fuzzySearchGeneric(searchTerm, candidates, candidates.length);
  if (allFuzzy.length === 0) return { data: [], total: 0 };

  const pageSlice = allFuzzy.slice(skip, skip + take);
  if (pageSlice.length === 0) return { data: [], total: allFuzzy.length };

  const ids = pageSlice.map(r => r.id);
  const rows = await (fastify.prisma as any)[model].findMany({
    where: { id: { in: ids } },
    select: dataSelect,
  });

  const idOrder = new Map(ids.map((id: string, idx: number) => [id, idx]));
  rows.sort((a: any, b: any) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
  return { data: rows, total: allFuzzy.length };
}

// =============================================================================
// Recherche groupes politiques
// =============================================================================

async function searchGroupes(fastify: any, searchTerm: string, limit: number, skip: number): Promise<CategorySearchResult> {
  const where = {
    actif: true,
    OR: [
      { nom: { contains: searchTerm, mode: 'insensitive' as const } },
      { nomComplet: { contains: searchTerm, mode: 'insensitive' as const } },
    ],
  };

  const [rows, dbTotal] = await Promise.all([
    fastify.prisma.groupePolitique.findMany({ where, select: groupeSelect, skip, take: limit }),
    fastify.prisma.groupePolitique.count({ where }),
  ]);

  if (dbTotal > 0) {
    return { data: rows.map((g: any) => ({ ...g, _type: 'groupe' as const })), total: dbTotal };
  }

  const fuzzy = await fuzzyFallbackGeneric(
    fastify, 'groupePolitique', searchTerm,
    { id: true, nom: true, nomComplet: true },
    (g: any) => [g.nom, g.nomComplet].filter(Boolean),
    groupeSelect, limit, skip,
  );
  return { data: fuzzy.data.map((g: any) => ({ ...g, _type: 'groupe' as const })), total: fuzzy.total };
}

// =============================================================================
// Recherche commissions
// =============================================================================

async function searchCommissions(fastify: any, searchTerm: string, limit: number, skip: number): Promise<CategorySearchResult> {
  const where = {
    actif: true,
    OR: [
      { nom: { contains: searchTerm, mode: 'insensitive' as const } },
      { nomCourt: { contains: searchTerm, mode: 'insensitive' as const } },
    ],
  };

  const [rows, dbTotal] = await Promise.all([
    fastify.prisma.commission.findMany({ where, select: commissionSelect, skip, take: limit }),
    fastify.prisma.commission.count({ where }),
  ]);

  if (dbTotal > 0) {
    return { data: rows.map((c: any) => ({ ...c, _type: 'commission' as const })), total: dbTotal };
  }

  const fuzzy = await fuzzyFallbackGeneric(
    fastify, 'commission', searchTerm,
    { id: true, nom: true, nomCourt: true },
    (c: any) => [c.nom, c.nomCourt].filter(Boolean),
    commissionSelect, limit, skip,
  );
  return { data: fuzzy.data.map((c: any) => ({ ...c, _type: 'commission' as const })), total: fuzzy.total };
}

// =============================================================================
// Recherche sujets
// =============================================================================

async function searchSujets(fastify: any, searchTerm: string, limit: number, skip: number): Promise<CategorySearchResult> {
  const where = {
    actif: true,
    OR: [
      { label: { contains: searchTerm, mode: 'insensitive' as const } },
      { description: { contains: searchTerm, mode: 'insensitive' as const } },
    ],
  };

  const [rows, dbTotal] = await Promise.all([
    fastify.prisma.sujet.findMany({ where, select: sujetSelect, orderBy: { scrutinCount: 'desc' as const }, skip, take: limit }),
    fastify.prisma.sujet.count({ where }),
  ]);

  if (dbTotal > 0) {
    return { data: rows.map((s: any) => ({ ...s, _type: 'sujet' as const })), total: dbTotal };
  }

  const fuzzy = await fuzzyFallbackGeneric(
    fastify, 'sujet', searchTerm,
    { id: true, label: true, description: true },
    (s: any) => [s.label, s.description].filter(Boolean),
    sujetSelect, limit, skip,
  );
  return { data: fuzzy.data.map((s: any) => ({ ...s, _type: 'sujet' as const })), total: fuzzy.total };
}

// =============================================================================
// Suggestions
// =============================================================================

async function suggestFromDatabase(fastify: any, q: string, limit: number) {
  const searchTerm = q.toLowerCase().trim();
  const select = {
    slug: true, chambre: true, nom: true, prenom: true,
    groupe: { select: { nom: true } },
  };

  let [parlementaires, scrutins] = await Promise.all([
    fastify.prisma.parlementaire.findMany({
      where: { ...buildParlementaireSearchCondition(searchTerm), actif: true },
      select,
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
    const candidates: FuzzyCandidate[] = await fastify.prisma.parlementaire.findMany({
      where: { actif: true },
      select: { id: true, nom: true, prenom: true, slug: true },
    });
    const fuzzyResults = fuzzySearchCandidates(searchTerm, candidates, limit);
    if (fuzzyResults.length > 0) {
      const matchingIds = fuzzyResults.map(r => r.id);
      parlementaires = await fastify.prisma.parlementaire.findMany({
        where: { id: { in: matchingIds } },
        select,
      });
      const idOrder = new Map(matchingIds.map((id: string, idx: number) => [id, idx]));
      parlementaires.sort((a: any, b: any) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
    }
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
