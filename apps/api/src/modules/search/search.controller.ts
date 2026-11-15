import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { buildParlementaireSearchCondition } from '../../utils/search';
import { fuzzySearchCandidates, FuzzyCandidate, fuzzySearchGeneric, GenericFuzzyCandidate } from '../../utils/fuzzy-search';
import { GouvernementsService } from '../gouvernements/gouvernements.service';
import { ROLES_PERSONNE, comptesParRole, meilleur, rechercherPersonnes } from './personnes';

// `deputes` et `senateurs` : la recherche par chambre d'avant les personnes,
// gardée telle quelle pour les clients de l'API (anciens sur `inclureAnciens`).
const SEARCH_TYPES = [
  'all', 'personnes', 'gouvernements', 'deputes', 'senateurs', 'scrutins', 'lobbyistes', 'dossiers', 'groupes', 'commissions', 'sujets',
] as const;

const searchQuerySchema = z.object({
  q: z.string().min(2, 'La recherche doit contenir au moins 2 caractères'),
  type: z.enum(SEARCH_TYPES).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  page: z.coerce.number().int().min(1).default(1),
  /** Sous-filtre des personnes : la chambre de sa fiche, ou le Gouvernement. */
  role: z.enum(ROLES_PERSONNE).optional(),
  // Sections `deputes` et `senateurs` seulement : y ajoute les parlementaires
  // dont le mandat est clos. Les personnes et les commissions comprennent
  // toujours les anciens, classés après. NB : pas de `z.coerce.boolean()` —
  // il rendrait `"false"` truthy.
  inclureAnciens: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .default(false)
    .transform((v) => v === true || v === 'true' || v === '1'),
});

interface CategorySearchResult {
  data: unknown[];
  total: number;
  /** Noms proches seulement (Jaro-Winkler), aucune correspondance exacte. */
  approximatif?: boolean;
}

/** Rangée d'un `select` Prisma dont la forme n'est pas connue statiquement. */
type SearchRow = Record<string, unknown> & { id: string };

/** Sous-ensemble d'un delegate Prisma utilisé par les helpers génériques. */
interface PrismaSearchDelegate {
  findMany(args: Record<string, unknown>): Promise<SearchRow[]>;
  count(args: Record<string, unknown>): Promise<number>;
}

/**
 * Accès à un delegate Prisma par nom de modèle. Les helpers de recherche sont
 * génériques (même pipeline pour groupes/commissions/sujets) : le modèle n'est
 * connu qu'à l'exécution, d'où l'indirection.
 */
function prismaDelegate(fastify: FastifyInstance, model: string): PrismaSearchDelegate {
  const delegates = fastify.prisma as unknown as Record<string, PrismaSearchDelegate>;
  const delegate = delegates[model];
  if (!delegate) throw new Error(`Modèle Prisma inconnu: ${model}`);
  return delegate;
}

/** Trie `rows` selon l'ordre des ids fourni (pertinence fuzzy). */
function sortByIdOrder<T extends { id: string }>(rows: T[], order: Map<string, number>): void {
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/**
 * Vue « recherche générique » d'un delegate Prisma concret. Les delegates générés
 * ont des signatures surchargées qui ne s'unifient pas avec PrismaSearchDelegate.
 */
function asSearchDelegate(delegate: unknown): PrismaSearchDelegate {
  return delegate as PrismaSearchDelegate;
}

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      tags: ['Search'],
      summary: 'Recherche globale',
      description:
        "Recherche dans les personnes (parlementaires et membres du Gouvernement depuis 2007, un résultat par personne, anciens compris), les gouvernements (par leur Premier ministre), les scrutins, lobbyistes, dossiers, groupes, commissions et sujets. Les noms approchants ne sont proposés que si rien ne correspond exactement (`meta.approximatif`).",
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2, description: 'Terme de recherche' },
          type: { type: 'string', enum: [...SEARCH_TYPES], default: 'all' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 30 },
          page: { type: 'integer', minimum: 1, default: 1, description: 'Page (ignoré pour type=all)' },
          role: {
            type: 'string',
            enum: [...ROLES_PERSONNE],
            description: 'Avec type=personnes : seulement les fiches de députés, de sénateurs, ou les membres du Gouvernement',
          },
          inclureAnciens: {
            type: 'string',
            enum: ['true', 'false', '1', '0'],
            default: 'false',
            description: 'Sections deputes et senateurs seulement : inclut les parlementaires dont le mandat est clos',
          },
        },
      },
    },
    handler: async (request) => {
      const { q, type, limit, page, role, inclureAnciens } = searchQuerySchema.parse(request.query);
      return searchWithDatabase(fastify, q, type, limit, page, inclureAnciens, role);
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

/** Parlementaire tel que projeté par `parlementaireSelect`. */
type ParlementaireSearchRow = Prisma.ParlementaireGetPayload<{ select: typeof parlementaireSelect }>;

const transformParlementaire = (d: ParlementaireSearchRow) => {
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

/** Les catégories de la recherche, dans l'ordre de la page ; `deputes` et `senateurs` à part (compatibilité). */
const CATEGORIES = ['personnes', 'gouvernements', 'groupes', 'commissions', 'scrutins', 'sujets', 'lobbyistes', 'dossiers'] as const;
type Categorie = (typeof CATEGORIES)[number];

async function searchWithDatabase(
  fastify: FastifyInstance,
  q: string,
  type: string,
  limit: number,
  page: number,
  inclureAnciens: boolean,
  role?: (typeof ROLES_PERSONNE)[number],
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
  const personnesTask = rechercherPersonnes(fastify, searchTerm);
  const gouvernementsTask = new GouvernementsService(fastify.prisma, fastify.redis).rechercherGouvernements(searchTerm);
  const tasks: Promise<void>[] = [
    searchParlementaires(fastify, searchTerm, 'assemblee', pg('deputes').skip, pg('deputes').take, inclureAnciens)
      .then(r => { searchResults.deputes = r; }),
    searchParlementaires(fastify, searchTerm, 'senat', pg('senateurs').skip, pg('senateurs').take, inclureAnciens)
      .then(r => { searchResults.senateurs = r; }),
    searchExact(
      asSearchDelegate(fastify.prisma.scrutin),
      { titre: { contains: searchTerm, mode: 'insensitive' as const } },
      {
        id: true, numero: true, chambre: true, session: true, date: true,
        titre: true, sort: true, typeVote: true, importance: true, tags: true,
        nombrePour: true, nombreContre: true,
      },
      [{ date: 'desc' }, { numero: 'desc' }],
      pg('scrutins').skip, pg('scrutins').take,
      (s: SearchRow) => ({ ...s, _type: 'scrutin' as const }),
    ).then(r => { searchResults.scrutins = r; }),
    searchExact(
      asSearchDelegate(fastify.prisma.lobbyiste),
      {
        OR: [
          { nom: { contains: searchTerm, mode: 'insensitive' as const } },
          { secteur: { contains: searchTerm, mode: 'insensitive' as const } },
        ],
      },
      { id: true, nom: true, type: true, secteur: true, budgetAnnuel: true, nbLobbyistes: true, ville: true },
      undefined,
      pg('lobbyistes').skip, pg('lobbyistes').take,
      (l: SearchRow) => ({ ...l, _type: 'lobbyiste' as const }),
    ).then(r => { searchResults.lobbyistes = r; }),
    searchExact(
      asSearchDelegate(fastify.prisma.dossierLegislatif),
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
      (d: SearchRow) => ({ ...d, _type: 'dossier' as const }),
    ).then(r => { searchResults.dossiers = r; }),
    searchGroupes(fastify, searchTerm, pg('groupes').take, pg('groupes').skip)
      .then(r => { searchResults.groupes = r; }),
    searchCommissions(fastify, searchTerm, pg('commissions').take, pg('commissions').skip)
      .then(r => { searchResults.commissions = r; }),
    searchSujets(fastify, searchTerm, pg('sujets').take, pg('sujets').skip)
      .then(r => { searchResults.sujets = r; }),
  ];

  // Compatibilité : ce que les sections deputes/senateurs ne montrent pas sans
  // `inclureAnciens` (les personnes et les commissions comprennent les anciens).
  const anciensDisponiblesTask: Promise<number> = inclureAnciens
    ? Promise.resolve(0)
    : fastify.prisma.parlementaire.count({
        where: { ...buildParlementaireSearchCondition(searchTerm), actif: false },
      });

  const [, anciensDisponibles, personnes, gouvernements] = await Promise.all([
    Promise.all(tasks), anciensDisponiblesTask, personnesTask, gouvernementsTask,
  ]);

  const personnesFiltrees = role ? personnes.personnes.filter((p) => p.roles.includes(role)) : personnes.personnes;
  const pp = pg('personnes');
  searchResults.personnes = {
    data: personnesFiltrees.slice(pp.skip, pp.skip + pp.take).map((p) => ({ ...p, _type: 'personne' as const })),
    total: personnesFiltrees.length,
    approximatif: personnes.approximatif,
  };
  const pgv = pg('gouvernements');
  searchResults.gouvernements = {
    data: gouvernements.slice(pgv.skip, pgv.skip + pgv.take).map((g) => ({ ...g, _type: 'gouvernement' as const })),
    total: gouvernements.length,
  };

  // Les noms approchants ne servent qu'en dernier recours : dès qu'une
  // catégorie a une correspondance exacte, ceux des autres n'apparaissent pas
  // (« lecornu » ne remonte plus Karine Lebon et Jean-Paul Lecoq à côté de
  // Sébastien Lecornu).
  const exact = CATEGORIES.some((c) => (searchResults[c]?.total ?? 0) > 0 && !searchResults[c]?.approximatif);
  for (const c of CATEGORIES) {
    if (exact && searchResults[c]?.approximatif) searchResults[c] = { data: [], total: 0 };
  }
  const approximatif = !exact && CATEGORIES.some((c) => (searchResults[c]?.total ?? 0) > 0);

  const total = (c: Categorie) => searchResults[c]?.total ?? 0;
  // Toutes les personnes, sous-filtre ou non : c'est ce que comptent la puce
  // « Personnes » et ses sous-filtres.
  const personnesVisibles = exact && personnes.approximatif ? [] : personnes.personnes;
  const counts = {
    personnes: personnesVisibles.length,
    // Les rôles d'une même personne se recoupent : ces comptes ne s'additionnent pas.
    personnesParRole: comptesParRole(personnesVisibles),
    gouvernements: total('gouvernements'),
    groupes: total('groupes'),
    commissions: total('commissions'),
    scrutins: total('scrutins'),
    sujets: total('sujets'),
    lobbyistes: total('lobbyistes'),
    dossiers: total('dossiers'),
    deputes: searchResults.deputes?.total ?? 0,
    senateurs: searchResults.senateurs?.total ?? 0,
    total: 0,
  };
  // Chaque personne une fois : les sections deputes/senateurs n'y entrent pas.
  counts.total = CATEGORIES.reduce((n, c) => n + (c === 'personnes' ? personnesVisibles.length : total(c)), 0);

  const meilleurResultat = meilleur(personnes, gouvernements, searchTerm, exact);
  const meta = { query: q, counts, approximatif, meilleurResultat, inclureAnciens, anciensDisponibles };

  if (isAll) {
    return {
      sections: {
        personnes: searchResults.personnes?.data ?? [],
        gouvernements: searchResults.gouvernements?.data ?? [],
        groupes: searchResults.groupes?.data ?? [],
        commissions: searchResults.commissions?.data ?? [],
        scrutins: searchResults.scrutins?.data ?? [],
        sujets: searchResults.sujets?.data ?? [],
        lobbyistes: searchResults.lobbyistes?.data ?? [],
        dossiers: searchResults.dossiers?.data ?? [],
        deputes: searchResults.deputes?.data ?? [],
        senateurs: searchResults.senateurs?.data ?? [],
      },
      meta,
    };
  }

  const result = searchResults[type];
  const typeTotal = result?.total ?? 0;
  return {
    data: result?.data ?? [],
    meta: {
      ...meta,
      type,
      role: role ?? null,
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
  model: PrismaSearchDelegate,
  where: Record<string, unknown>,
  select: Record<string, unknown>,
  orderBy: Record<string, unknown> | Record<string, unknown>[] | undefined,
  skip: number,
  take: number,
  transform: (row: SearchRow) => unknown,
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
  fastify: FastifyInstance,
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
  fastify: FastifyInstance,
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
  sortByIdOrder(rows, order);

  return { data: rows.map(transformParlementaire), total };
}

// =============================================================================
// Fuzzy fallback — generic (groupes, commissions, sujets)
// =============================================================================

async function fuzzyFallbackGeneric(
  fastify: FastifyInstance,
  model: string,
  searchTerm: string,
  candidateSelect: Record<string, unknown>,
  labelsExtractor: (row: SearchRow) => string[],
  dataSelect: Record<string, unknown>,
  take: number,
  skip: number,
): Promise<CategorySearchResult> {
  const allCandidates = await prismaDelegate(fastify, model).findMany({
    where: { actif: true },
    select: candidateSelect,
  });
  const candidates: GenericFuzzyCandidate[] = allCandidates.map((r) => ({
    id: r.id,
    labels: labelsExtractor(r),
  }));

  const allFuzzy = fuzzySearchGeneric(searchTerm, candidates, candidates.length);
  if (allFuzzy.length === 0) return { data: [], total: 0 };

  const pageSlice = allFuzzy.slice(skip, skip + take);
  if (pageSlice.length === 0) return { data: [], total: allFuzzy.length };

  const ids = pageSlice.map(r => r.id);
  const rows = await prismaDelegate(fastify, model).findMany({
    where: { id: { in: ids } },
    select: dataSelect,
  });

  const idOrder = new Map(ids.map((id, idx) => [id, idx]));
  sortByIdOrder(rows, idOrder);
  return { data: rows, total: allFuzzy.length };
}

// =============================================================================
// Recherche groupes politiques
// =============================================================================

async function searchGroupes(fastify: FastifyInstance, searchTerm: string, limit: number, skip: number): Promise<CategorySearchResult> {
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
    return { data: rows.map((g) => ({ ...g, _type: 'groupe' as const })), total: dbTotal };
  }

  const fuzzy = await fuzzyFallbackGeneric(
    fastify, 'groupePolitique', searchTerm,
    { id: true, nom: true, nomComplet: true },
    (g) => [g.nom, g.nomComplet].filter(Boolean) as string[],
    groupeSelect, limit, skip,
  );
  return { data: fuzzy.data.map((g) => ({ ...(g as SearchRow), _type: 'groupe' as const })), total: fuzzy.total, approximatif: fuzzy.total > 0 };
}

// =============================================================================
// Recherche commissions
// =============================================================================

/**
 * Les commissions qui répondent à la recherche, en cours puis dissoutes
 * (enquêtes, missions, CMP), chacune par ordre alphabétique. Les noms
 * approchants seulement si aucune ne correspond.
 */
async function searchCommissions(
  fastify: FastifyInstance,
  searchTerm: string,
  limit: number,
  skip: number,
): Promise<CategorySearchResult> {
  let approximatif = false;
  let trouvees: Array<{ id: string; nom: string; actif: boolean }> = await fastify.prisma.commission.findMany({
    where: {
      OR: [
        { nom: { contains: searchTerm, mode: 'insensitive' as const } },
        { nomCourt: { contains: searchTerm, mode: 'insensitive' as const } },
      ],
    },
    select: { id: true, nom: true, actif: true },
  });
  if (trouvees.length > 0) {
    trouvees.sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, 'fr'));
  } else {
    const toutes = await fastify.prisma.commission.findMany({ select: { id: true, nom: true, nomCourt: true, actif: true } });
    const parId = new Map(toutes.map((c) => [c.id, c]));
    const candidats: GenericFuzzyCandidate[] = toutes.map((c) => ({ id: c.id, labels: [c.nom, c.nomCourt].filter(Boolean) as string[] }));
    trouvees = fuzzySearchGeneric(searchTerm, candidats, candidats.length)
      .map((r) => parId.get(r.id))
      .filter((c): c is (typeof toutes)[number] => Boolean(c));
    approximatif = trouvees.length > 0;
  }
  const total = trouvees.length;
  const pageIds = trouvees.slice(skip, skip + limit).map((r) => r.id);
  if (pageIds.length === 0) return { data: [], total, approximatif };

  const rows = await fastify.prisma.commission.findMany({
    where: { id: { in: pageIds } },
    select: commissionSelect,
  });
  sortByIdOrder(rows, new Map(pageIds.map((id: string, idx: number) => [id, idx])));
  return { data: rows.map((c) => ({ ...c, _type: 'commission' as const })), total, approximatif };
}

// =============================================================================
// Recherche sujets
// =============================================================================

async function searchSujets(fastify: FastifyInstance, searchTerm: string, limit: number, skip: number): Promise<CategorySearchResult> {
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
    return { data: rows.map((s) => ({ ...s, _type: 'sujet' as const })), total: dbTotal };
  }

  const fuzzy = await fuzzyFallbackGeneric(
    fastify, 'sujet', searchTerm,
    { id: true, label: true, description: true },
    (s) => [s.label, s.description].filter(Boolean) as string[],
    sujetSelect, limit, skip,
  );
  return { data: fuzzy.data.map((s) => ({ ...(s as SearchRow), _type: 'sujet' as const })), total: fuzzy.total, approximatif: fuzzy.total > 0 };
}

// =============================================================================
// Suggestions
// =============================================================================

async function suggestFromDatabase(fastify: FastifyInstance, q: string, limit: number) {
  const searchTerm = q.toLowerCase().trim();
  const select = {
    // `id` est requis par le tri de pertinence du fallback fuzzy plus bas.
    id: true, slug: true, chambre: true, nom: true, prenom: true,
    groupe: { select: { nom: true } },
  };

  const [exactParlementaires, scrutins] = await Promise.all([
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

  let parlementaires = exactParlementaires;

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
      sortByIdOrder(parlementaires, idOrder);
    }
  }

  return {
    data: [
      ...parlementaires.map((d) => ({
        type: d.chambre === 'senat' ? 'senateur' : 'depute',
        value: `${d.prenom} ${d.nom}`,
        slug: d.slug,
        chambre: d.chambre,
        meta: d.groupe?.nom,
      })),
      ...scrutins.map((s) => ({
        type: 'scrutin',
        value: s.titre.length > 60 ? s.titre.substring(0, 60) + '...' : s.titre,
        numero: s.numero,
        chambre: s.chambre,
        session: s.session,
      })),
    ],
  };
}
