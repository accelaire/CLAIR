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
  // Élargit la recherche aux parlementaires dont le mandat est clos (législatures
  // antérieures). Défaut `false` : la recherche décrit la chambre telle qu'elle est
  // aujourd'hui, les anciens ne remontent que sur demande explicite.
  // NB : pas de `z.coerce.boolean()` — il rendrait `"false"` truthy.
  inclureAnciens: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .default(false)
    .transform((v) => v === true || v === 'true' || v === '1'),
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
          inclureAnciens: {
            type: 'string',
            enum: ['true', 'false', '1', '0'],
            default: 'false',
            description: 'Inclut les parlementaires dont le mandat est clos (législatures antérieures)',
          },
        },
      },
    },
    handler: async (request) => {
      const { q, type, limit, page, inclureAnciens } = searchQuerySchema.parse(request.query);
      return searchWithDatabase(fastify, q, type, limit, page, inclureAnciens);
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
  id: true, slug: true, chambre: true, nom: true, prenom: true, photoUrl: true, actif: true, sexe: true,
  groupe: { select: { nom: true, couleur: true } },
  circonscription: { select: { departement: true, nom: true } },
  // Dernier mandat : sert à dater un ancien (« ancien député, XVIe législature ») et
  // à réinjecter le groupe/circonscription d'époque, ceux de `Parlementaire` étant
  // ceux du mandat le plus récent (cf. project_groupe_epoque).
  mandatsParlementaires: {
    orderBy: [{ dateDebut: 'desc' as const }],
    take: 1,
    select: {
      legislature: true, mandature: true, chambre: true, dateDebut: true, dateFin: true,
      groupe: { select: { nom: true, couleur: true } },
      circonscription: { select: { departement: true, nom: true } },
    },
  },
};

const transformParlementaire = (d: any) => {
  const dernierMandat = d.mandatsParlementaires?.[0];
  // Pour un ancien, le contexte pertinent est celui de son dernier mandat, pas
  // l'état courant de la fiche.
  const groupe = d.actif ? d.groupe : (dernierMandat?.groupe ?? d.groupe);
  const circo = d.actif ? d.circonscription : (dernierMandat?.circonscription ?? d.circonscription);

  return {
    id: d.id, slug: d.slug, chambre: d.chambre, nom: d.nom, prenom: d.prenom,
    nomComplet: `${d.prenom} ${d.nom}`, photoUrl: d.photoUrl,
    groupe: groupe?.nom, groupeCouleur: groupe?.couleur,
    circonscription: circo?.nom, departement: circo?.departement,
    actif: d.actif,
    ancien: !d.actif,
    sexe: d.sexe,
    dernierMandat: dernierMandat
      ? {
          chambre: dernierMandat.chambre,
          legislature: dernierMandat.legislature,
          mandature: dernierMandat.mandature,
          dateDebut: dernierMandat.dateDebut,
          dateFin: dernierMandat.dateFin,
        }
      : null,
    _type: d.chambre === 'senat' ? 'senateur' : 'depute',
  };
};

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
  inclureAnciens: boolean,
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
    searchParlementaires(fastify, searchTerm, 'assemblee', pg('deputes').skip, pg('deputes').take, inclureAnciens)
      .then(r => { searchResults.deputes = r; }),
    searchParlementaires(fastify, searchTerm, 'senat', pg('senateurs').skip, pg('senateurs').take, inclureAnciens)
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
    searchCommissions(fastify, searchTerm, pg('commissions').take, pg('commissions').skip, inclureAnciens)
      .then(r => { searchResults.commissions = r; }),
    searchSujets(fastify, searchTerm, pg('sujets').take, pg('sujets').skip)
      .then(r => { searchResults.sujets = r; }),
  ];

  // Sans le toggle, l'utilisateur ne peut pas deviner que des enregistrements clos
  // correspondent aussi. On compte ce qu'il ne voit pas (parlementaires + organes
  // dissous) pour le lui proposer d'un clic.
  const anciensDisponiblesTask: Promise<number> = inclureAnciens
    ? Promise.resolve(0)
    : Promise.all([
        fastify.prisma.parlementaire.count({
          where: { ...buildParlementaireSearchCondition(searchTerm), actif: false },
        }),
        fastify.prisma.commission.count({
          where: {
            actif: false,
            OR: [
              { nom: { contains: searchTerm, mode: 'insensitive' as const } },
              { nomCourt: { contains: searchTerm, mode: 'insensitive' as const } },
            ],
          },
        }),
      ]).then(([p, c]) => p + c);

  const [, anciensDisponibles] = await Promise.all([Promise.all(tasks), anciensDisponiblesTask]);

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
      meta: { query: q, counts, inclureAnciens, anciensDisponibles },
    };
  }

  const result = searchResults[type];
  const typeTotal = result?.total ?? 0;
  return {
    data: result?.data ?? [],
    meta: {
      query: q, type, counts,
      inclureAnciens, anciensDisponibles,
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

interface NamedMatch {
  id: string;
  nom: string;
  prenom: string;
}

/**
 * Enregistrements d'une cohorte (`actif` fixé) qui matchent le terme : les
 * correspondances EXACTES si elles existent, sinon le fuzzy en dernier recours.
 * Renvoie nom/prénom pour permettre à l'appelant de trier l'ensemble fusionné.
 */
async function matchParlementaireRecords(
  fastify: any,
  searchTerm: string,
  chambre: string,
  actif: boolean,
): Promise<NamedMatch[]> {
  const exact: NamedMatch[] = await fastify.prisma.parlementaire.findMany({
    where: { ...buildParlementaireSearchCondition(searchTerm), chambre, actif },
    select: { id: true, nom: true, prenom: true },
  });
  if (exact.length > 0) return exact;

  const candidates: FuzzyCandidate[] = await fastify.prisma.parlementaire.findMany({
    where: { chambre, actif },
    select: { id: true, nom: true, prenom: true, slug: true },
  });
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return fuzzySearchCandidates(searchTerm, candidates, candidates.length)
    .map((r) => byId.get(r.id))
    .filter((c): c is FuzzyCandidate => Boolean(c))
    .map((c) => ({ id: c.id, nom: c.nom, prenom: c.prenom }));
}

async function searchParlementaires(
  fastify: any,
  searchTerm: string,
  chambre: string,
  skip: number,
  take: number,
  inclureAnciens: boolean,
): Promise<CategorySearchResult> {
  // Additif : le set des actifs (identique au mode sans toggle) PLUS les anciens.
  // Puis fusion et tri alphabétique de l'ensemble : anciens et actifs sont
  // ENTREMÊLÉS par nom, pas empilés en deux blocs (les cohortes sont mutuellement
  // exclusives, donc pas de doublon). La collation Postgres rangeant les accents
  // après l'ASCII, on trie en JS avec `localeCompare('fr')`.
  const actifs = await matchParlementaireRecords(fastify, searchTerm, chambre, true);
  const anciens = inclureAnciens
    ? await matchParlementaireRecords(fastify, searchTerm, chambre, false)
    : [];
  const merged = [...actifs, ...anciens];
  merged.sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
  const total = merged.length;

  const pageIds = merged.slice(skip, skip + take).map((r) => r.id);
  if (pageIds.length === 0) return { data: [], total };

  const rows = await fastify.prisma.parlementaire.findMany({
    where: { id: { in: pageIds } },
    select: parlementaireSelect,
  });
  const order = new Map(pageIds.map((id: string, idx: number) => [id, idx]));
  rows.sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { data: rows.map(transformParlementaire), total };
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

/**
 * Enregistrements d'une cohorte de commissions (`actif` fixé), exact d'abord puis
 * fuzzy en dernier recours. Symétrique de `matchParlementaireRecords`.
 */
async function matchCommissionRecords(
  fastify: any,
  searchTerm: string,
  actif: boolean,
): Promise<Array<{ id: string; nom: string }>> {
  const exact: Array<{ id: string; nom: string }> = await fastify.prisma.commission.findMany({
    where: {
      actif,
      OR: [
        { nom: { contains: searchTerm, mode: 'insensitive' as const } },
        { nomCourt: { contains: searchTerm, mode: 'insensitive' as const } },
      ],
    },
    select: { id: true, nom: true },
  });
  if (exact.length > 0) return exact;

  const rows: Array<{ id: string; nom: string; nomCourt: string | null }> =
    await fastify.prisma.commission.findMany({
      where: { actif },
      select: { id: true, nom: true, nomCourt: true },
    });
  const byId = new Map(rows.map((c) => [c.id, c]));
  const candidates: GenericFuzzyCandidate[] = rows.map((c) => ({
    id: c.id,
    labels: [c.nom, c.nomCourt].filter(Boolean) as string[],
  }));
  return fuzzySearchGeneric(searchTerm, candidates, candidates.length)
    .map((r) => byId.get(r.id))
    .filter((c): c is { id: string; nom: string; nomCourt: string | null } => Boolean(c))
    .map((c) => ({ id: c.id, nom: c.nom }));
}

async function searchCommissions(
  fastify: any,
  searchTerm: string,
  limit: number,
  skip: number,
  inclureAnciens: boolean,
): Promise<CategorySearchResult> {
  // Additif comme les parlementaires : les commissions en cours PLUS les organes
  // clos (enquêtes, missions, CMP dissoutes), fusionnés et triés alphabétiquement —
  // entremêlés, pas en deux blocs.
  const actifs = await matchCommissionRecords(fastify, searchTerm, true);
  const closes = inclureAnciens
    ? await matchCommissionRecords(fastify, searchTerm, false)
    : [];
  const merged = [...actifs, ...closes];
  merged.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const total = merged.length;

  const pageIds = merged.slice(skip, skip + limit).map((r) => r.id);
  if (pageIds.length === 0) return { data: [], total };

  const rows = await fastify.prisma.commission.findMany({
    where: { id: { in: pageIds } },
    select: commissionSelect,
  });
  const order = new Map(pageIds.map((id: string, idx: number) => [id, idx]));
  rows.sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return { data: rows.map((c: any) => ({ ...c, _type: 'commission' as const })), total };
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
