// =============================================================================
// Module Scrutins - Controller (Routes)
// =============================================================================

import { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from '../../utils/errors';
import { buildTextSearchCondition } from '../../utils/search';
import {
  joinMandatEpoque,
  chargerGroupesEpoque,
  parlementaireDansGroupeAuScrutin,
} from '../../utils/groupe-epoque';

// Cache TTL
const CACHE_TTL_1H = 3600;

// Longueur max du preview d'intervention (le reste est chargé à la demande)
const CONTENU_PREVIEW_LENGTH = 500;

/** Tronque le contenu et ajoute hasMore si nécessaire */
function truncateContenu(intervention: { contenu: string; [key: string]: unknown }) {
  const { contenu, ...rest } = intervention;
  return {
    ...rest,
    contenu: contenu.length > CONTENU_PREVIEW_LENGTH
      ? contenu.substring(0, CONTENU_PREVIEW_LENGTH)
      : contenu,
    hasMore: contenu.length > CONTENU_PREVIEW_LENGTH,
  };
}

// Fix AN sourceUrl format: VTANR5L17V4946 -> 4946
/** Borne haute inclusive : `dateTo` désigne un jour entier, pas son instant zéro. */
const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

const fixSourceUrl = (sourceUrl: string | null, chambre: string, numero: number): string | null => {
  if (!sourceUrl) return null;
  // Fix AN URLs with wrong format (VTANR5L17Vxxxx instead of just xxxx)
  if (chambre === 'assemblee' && sourceUrl.includes('/VTANR')) {
    return `https://www.assemblee-nationale.fr/dyn/17/scrutins/${numero}`;
  }
  return sourceUrl;
};

// Schemas
const scrutinsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  chambre: z.enum(['assemblee', 'senat']).optional(),
  type: z.enum(['solennel', 'ordinaire', 'motion']).optional(),
  sort: z.enum(['adopte', 'rejete']).optional(),
  tag: z.string().optional(),
  importance: z.coerce.number().int().min(1).max(5).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
});

// Note: scrutinParamsSchema moved inline to handlers to avoid unused variable warning

export const scrutinsRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET /api/v1/scrutins - Liste des scrutins
  // ===========================================================================
  fastify.get('/', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Liste des scrutins',
      description: 'Retourne la liste paginée des scrutins (votes) à l\'Assemblée nationale et au Sénat',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          chambre: { type: 'string', enum: ['assemblee', 'senat'], description: 'Filtrer par chambre' },
          type: { type: 'string', enum: ['solennel', 'ordinaire', 'motion'] },
          sort: { type: 'string', enum: ['adopte', 'rejete'] },
          tag: { type: 'string', description: 'Filtrer par thématique' },
          importance: { type: 'integer', minimum: 1, maximum: 5 },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          search: { type: 'string', description: 'Recherche dans le titre' },
        },
      },
    },
    handler: async (request, _reply) => {
      const query = scrutinsListQuerySchema.parse(request.query);
      const { page, limit, chambre, type, sort, tag, importance, dateFrom, dateTo, search } = query;

      // Cache key based on query params
      const cacheKey = `scrutins:list:${JSON.stringify(query)}`;

      // Check cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const skip = (page - 1) * limit;

      // Build search condition: search in title OR by numero if numeric
      let searchCondition = {};
      if (search) {
        const searchTrimmed = search.trim();
        const searchAsNumber = parseInt(searchTrimmed, 10);

        if (!isNaN(searchAsNumber) && searchTrimmed === String(searchAsNumber)) {
          // If search is a valid number, search by numero "starts with" OR title contains
          // For "493", we want: 493, 4930-4939, 49300-49399, etc.
          // This is done by range queries: numero >= N*10^k AND numero < (N+1)*10^k
          const numericConditions = [];
          let multiplier = 1;

          // Generate range conditions for different digit lengths (up to 6 digits total)
          for (let i = 0; i < 4; i++) {
            const lower = searchAsNumber * multiplier;
            const upper = (searchAsNumber + 1) * multiplier;
            if (lower <= 999999) { // Max reasonable scrutin number
              numericConditions.push({
                AND: [
                  { numero: { gte: lower } },
                  { numero: { lt: upper } },
                ],
              });
            }
            multiplier *= 10;
          }

          searchCondition = {
            OR: [
              ...numericConditions,
              { titre: { contains: searchTrimmed, mode: 'insensitive' as const } },
            ],
          };
        } else {
          // Otherwise, search in title with multi-word support
          searchCondition = buildTextSearchCondition('titre', searchTrimmed);
        }
      }

      // Combine date conditions properly (don't overwrite gte with lte).
      // `dateTo` est une date (sans heure) : on borne à la fin de la journée,
      // sinon tout scrutin horodaté après minuit ce jour-là serait exclu — ce
      // qui coupait notamment le dernier jour des scrutins Sénat (stockés à
      // 22:00 UTC = minuit à Paris).
      const dateCondition = (dateFrom || dateTo) ? {
        date: {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: endOfDay(dateTo) }),
        },
      } : {};

      const where = {
        ...(chambre && { chambre }),
        ...(type && { typeVote: type }),
        ...(sort && { sort }),
        ...(tag && { tags: { has: tag } }),
        ...(importance && { importance }),
        ...dateCondition,
        ...searchCondition,
      };

      const [scrutins, total] = await Promise.all([
        fastify.prisma.scrutin.findMany({
          where,
          orderBy: [{ date: 'desc' }, { numero: 'desc' }],
          skip,
          take: limit,
          // `select` explicite plutôt qu'`include` : sourceData est le blob brut de
          // l'API source (~37 Ko/scrutin), inutile en liste. L'écarter du payload
          // en JS ne suffisait pas — Postgres lisait quand même la colonne sur
          // disque à chaque page. Elle reste disponible sur le détail.
          select: {
            id: true,
            numero: true,
            chambre: true,
            session: true,
            legislature: true,
            date: true,
            titre: true,
            typeVote: true,
            sort: true,
            nombreVotants: true,
            nombrePour: true,
            nombreContre: true,
            nombreAbstention: true,
            tags: true,
            importance: true,
            texteId: true,
            texteNumero: true,
            texteTitre: true,
            objetLibelle: true,
            demandeurTexte: true,
            seanceRef: true,
            dossierId: true,
            resumeIA: true,
            iaContentHash: true,
            iaGeneratedAt: true,
            sourceUrl: true,
            createdAt: true,
          },
        }),
        fastify.prisma.scrutin.count({ where }),
      ]);

      // Comptage des votes borné aux scrutins de la page.
      // `_count: { select: { votes: true } }` faisait générer à Prisma un LEFT JOIN
      // sur un GROUP BY de TOUTE la table votes (3,9 M lignes, sans filtre) à chaque
      // appel, pour n'en conserver que les lignes affichées : 94 % du spill temporaire
      // de la base venait de cette seule requête. Ici on borne aux ids de la page.
      const voteCounts = scrutins.length
        ? await fastify.prisma.vote.groupBy({
            by: ['scrutinId'],
            where: { scrutinId: { in: scrutins.map((s) => s.id) } },
            _count: { _all: true },
          })
        : [];
      const votesCountByScrutin = new Map(
        voteCounts.map((v) => [v.scrutinId, v._count._all]),
      );

      const totalPages = Math.ceil(total / limit);

      const result = {
        data: scrutins.map((s) => ({
          ...s,
          votesCount: votesCountByScrutin.get(s.id) ?? 0,
        })),
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      // Cache for 1 hour
      await fastify.redis.setex(cacheKey, CACHE_TTL_1H, JSON.stringify(result));

      return result;
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/tags - Tags disponibles
  // ===========================================================================
  fastify.get('/tags', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Liste des tags',
      description: 'Retourne tous les tags de scrutins avec leur count',
    },
    handler: async (_request, _reply) => {
      // Cache TTL: 12 hours
      const CACHE_TTL_12H = 43200;
      const cacheKey = 'scrutins:tags:all';

      // Check Redis cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Optimized: Use SQL UNNEST to count tags directly in database
      // This prevents loading all scrutins into memory
      // Note: Use actual PostgreSQL table names (snake_case) not Prisma model names
      const tagCounts = await fastify.prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT tag as name, COUNT(*) as count
        FROM scrutins, LATERAL unnest(tags) AS tag
        GROUP BY tag
        ORDER BY count DESC
      `;

      const tags = tagCounts.map((t) => ({
        name: t.name,
        count: Number(t.count),
      }));

      const response = { data: tags };

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, CACHE_TTL_12H, JSON.stringify(response));

      return response;
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/annees - Années disponibles avec comptage
  // ===========================================================================
  fastify.get('/annees', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Années disponibles',
      description: 'Retourne les années pour lesquelles des scrutins existent, avec leur nombre, triées décroissantes.',
    },
    handler: async (_request, _reply) => {
      const cacheKey = 'scrutins:annees';
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const rows = await fastify.prisma.$queryRaw<{ year: number; count: bigint }[]>`
        SELECT EXTRACT(YEAR FROM date)::int AS year, COUNT(*) AS count
        FROM scrutins
        GROUP BY year
        ORDER BY year DESC
      `;

      const data = rows.map((r) => ({ year: r.year, count: Number(r.count) }));
      const response = { data };

      await fastify.redis.setex(cacheKey, 86400, JSON.stringify(response));
      return response;
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/periodes - Périodes institutionnelles disponibles
  // ===========================================================================
  fastify.get('/periodes', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Périodes institutionnelles disponibles',
      description:
        "Retourne les périodes pour lesquelles des scrutins existent : législature à l'AN, session ordinaire au Sénat. " +
        'Les bornes de dates sont calculées sur les scrutins réellement en base : filtrer sur [dateDebut, dateFin] ' +
        'renvoie donc exactement les scrutins de la période. Une période absente de la base n\'est pas exposée.',
    },
    handler: async (request, _reply) => {
      const { chambre } = z
        .object({ chambre: z.enum(['assemblee', 'senat']).optional() })
        .parse(request.query);

      const cacheKey = `scrutins:periodes:v2:${chambre ?? 'all'}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      // Bornes renvoyées en jours ('YYYY-MM-DD') et non en instants : un instant
      // ISO serait réinterprété dans le fuseau du navigateur et décalerait la
      // borne d'un jour (les scrutins Sénat sont horodatés à 22:00 UTC).
      const rows = await fastify.prisma.$queryRaw<
        {
          chambre: string;
          legislature: number | null;
          session: string;
          date_debut: string;
          date_fin: string;
          count: bigint;
        }[]
      >`
        SELECT chambre, legislature, session,
               MIN(date)::date::text AS date_debut,
               MAX(date)::date::text AS date_fin,
               COUNT(*) AS count
        FROM scrutins
        WHERE (${chambre ?? null}::text IS NULL OR chambre = ${chambre ?? null}::text)
        GROUP BY chambre, legislature, session
        ORDER BY MAX(date) DESC
      `;

      const data = rows.map((r) => ({
        chambre: r.chambre,
        legislature: r.legislature,
        session: r.session,
        dateDebut: r.date_debut,
        dateFin: r.date_fin,
        count: Number(r.count),
      }));
      const response = { data };

      await fastify.redis.setex(cacheKey, 86400, JSON.stringify(response));
      return response;
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/importants - Scrutins importants récents
  // ===========================================================================
  fastify.get('/importants', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Scrutins importants',
      description: 'Retourne les scrutins les plus importants récents',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
    handler: async (request, _reply) => {
      const { limit = 10 } = request.query as { limit?: number };
      const cacheKey = `scrutins:importants:${limit}`;

      // Check cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Only show scrutins from the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const scrutins = await fastify.prisma.scrutin.findMany({
        where: {
          importance: { gte: 3 },
          date: { gte: sixMonthsAgo },
        },
        orderBy: [{ date: 'desc' }, { importance: 'desc' }],
        take: limit,
      });

      // sourceData retiré : voir la liste principale des scrutins.
      const response = { data: scrutins.map((s) => ({ ...s, sourceData: undefined })) };

      // Cache for 12 hours
      await fastify.redis.setex(cacheKey, 43200, JSON.stringify(response));

      return response;
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/:numero - Détail d'un scrutin
  // ===========================================================================
  fastify.get('/:numero', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Détail d\'un scrutin',
      description: 'Retourne les informations détaillées d\'un scrutin avec tous les votes',
      params: {
        type: 'object',
        required: ['numero'],
        properties: {
          numero: { type: 'integer', description: 'Numéro du scrutin' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          chambre: { type: 'string', enum: ['assemblee', 'senat'], default: 'assemblee' },
          session: { type: 'string', description: 'Session parlementaire (ex: 2024 pour Sénat, 17 pour AN)' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { numero } = z.object({ numero: z.coerce.number().int().positive() }).parse(request.params);
      const { chambre = 'assemblee', session } = request.query as { chambre?: string; session?: string };

      // Build where clause - session is required for unique lookup in multi-session scenario
      const whereClause: { numero: number; chambre: string; session?: string } = { numero, chambre };
      if (session) {
        whereClause.session = session;
      }

      // Requête scrutin SANS les votes (optimisation mémoire)
      // orderBy déterministe : au Sénat le numéro se répète chaque session ; sans
      // session fournie (lien legacy/externe), on résout vers la plus récente plutôt
      // qu'un résultat arbitraire.
      const scrutin = await fastify.prisma.scrutin.findFirst({
        where: whereClause,
        orderBy: { date: 'desc' },
        include: {
          dossier: {
            select: {
              id: true,
              uid: true,
              titre: true,
              titreCourt: true,
              procedureLibelle: true,
              urlAN: true,
              urlSenat: true,
              etat: true,
              dateDepot: true,
              loiNumero: true,
              loiTitre: true,
              urlLegifrance: true,
              _count: {
                select: { scrutins: true, amendements: true },
              },
            },
          },
          amendements: {
            select: {
              id: true,
              uid: true,
              numero: true,
              articleVise: true,
              dispositif: true,
              exposeSommaire: true,
              auteurLibelle: true,
              sort: true,
              dateDepot: true,
            },
          },
        },
      });

      if (!scrutin) {
        throw new ApiError(404, 'Scrutin non trouvé');
      }

      // Interventions de la séance (même date + chambre) — pas juste celles liées au scrutin
      const seanceInterventionSelect = {
        id: true,
        type: true,
        contenu: true,
        date: true,
        ordre: true,
        sourceUrl: true,
        orateurNom: true,
        orateurPrenom: true,
        orateurQualite: true,
        parlementaire: {
          select: {
            id: true,
            slug: true,
            nom: true,
            prenom: true,
            photoUrl: true,
            groupe: {
              select: {
                nom: true,
                couleur: true,
              },
            },
          },
        },
      };

      const seanceWhere = { date: scrutin.date, chambre: scrutin.chambre };

      const [seanceInterventions, totalSeanceInterventions] = await Promise.all([
        fastify.prisma.intervention.findMany({
          where: seanceWhere,
          take: 5,
          orderBy: [{ date: 'asc' }, { ordre: 'asc' }],
          select: seanceInterventionSelect,
        }),
        fastify.prisma.intervention.count({ where: seanceWhere }),
      ]);

      // Sélection des champs votes communs
      const voteSelect = {
        id: true,
        position: true,
        parlementaire: {
          select: {
            id: true,
            slug: true,
            chambre: true,
            nom: true,
            prenom: true,
            photoUrl: true,
            groupe: {
              select: {
                id: true,
                slug: true,
                nom: true,
                couleur: true,
              },
            },
          },
        },
      };

      // Charger les votes par position + agrégation par groupe EN PARALLÈLE
      // ~600 votes max par scrutin (577 AN / 348 Sénat) — pas de cap nécessaire
      const [votesPour, votesContre, votesAbstention, votesAbsent, votesByGroupeRaw] = await Promise.all([
        fastify.prisma.vote.findMany({
          where: { scrutinId: scrutin.id, position: 'pour' },
          select: voteSelect,
        }),
        fastify.prisma.vote.findMany({
          where: { scrutinId: scrutin.id, position: 'contre' },
          select: voteSelect,
        }),
        fastify.prisma.vote.findMany({
          where: { scrutinId: scrutin.id, position: 'abstention' },
          select: voteSelect,
        }),
        fastify.prisma.vote.findMany({
          where: { scrutinId: scrutin.id, position: 'absent' },
          select: voteSelect,
        }),
        // Requête SQL groupée pour votesByGroupe (évite de charger tous les votes
        // en mémoire). Le groupe retenu est celui du MANDAT couvrant le scrutin
        // (cf. groupe-epoque.ts) : joindre `p.groupe_id` renverrait le groupe
        // actuel du parlementaire, faux dès qu'on remonte d'une législature.
        fastify.prisma.$queryRawUnsafe<{ groupe_nom: string | null; position: string; count: bigint }[]>(
          `
          SELECT COALESCE(gm.nom, gp.nom) as groupe_nom, v.position, COUNT(*) as count
          FROM "votes" v
          JOIN "scrutins" s ON s.id = v.scrutin_id
          JOIN "parlementaires" p ON v.parlementaire_id = p.id
          ${joinMandatEpoque('v', 's', 'm')}
          LEFT JOIN "groupes_politiques" gm ON m.groupe_id = gm.id
          LEFT JOIN "groupes_politiques" gp ON p.groupe_id = gp.id
          WHERE v.scrutin_id = $1
          GROUP BY COALESCE(gm.nom, gp.nom), v.position
          `,
          scrutin.id,
        ),
      ]);

      // Construire votesByGroupe à partir de la requête agrégée
      const votesByGroupe: Record<string, { pour: number; contre: number; abstention: number; absent: number }> = {};
      for (const row of votesByGroupeRaw) {
        const groupeNom = row.groupe_nom || 'Non inscrit';
        if (!votesByGroupe[groupeNom]) {
          votesByGroupe[groupeNom] = { pour: 0, contre: 0, abstention: 0, absent: 0 };
        }
        votesByGroupe[groupeNom][row.position as keyof typeof votesByGroupe[string]] = Number(row.count);
      }

      // Chaque votant est présenté avec le groupe où il siégeait AU MOMENT du
      // scrutin, pas celui où il siège aujourd'hui (une seule requête pour les
      // quatre listes). Sans mandat sur la période, on garde le groupe courant.
      const tousLesVotes = [...votesPour, ...votesContre, ...votesAbstention, ...votesAbsent];
      const groupesEpoque = await chargerGroupesEpoque(
        fastify.prisma,
        scrutin,
        tousLesVotes.map((v) => v.parlementaire.id),
      );
      const avecGroupeEpoque = <T extends { parlementaire: { id: string; groupe: unknown } }>(votes: T[]): T[] =>
        votes.map((v) => {
          const groupe = groupesEpoque.get(v.parlementaire.id);
          return groupe ? { ...v, parlementaire: { ...v.parlementaire, groupe } } : v;
        });

      const votesByPosition = {
        pour: avecGroupeEpoque(votesPour),
        contre: avecGroupeEpoque(votesContre),
        abstention: avecGroupeEpoque(votesAbstention),
        absent: avecGroupeEpoque(votesAbsent),
      };

      return {
        data: {
          ...scrutin,
          interventions: seanceInterventions.map(truncateContenu),
          sourceUrl: fixSourceUrl(scrutin.sourceUrl, scrutin.chambre, scrutin.numero),
          votesByPosition,
          votesByGroupe,
          totalVotes: scrutin.nombrePour + scrutin.nombreContre + scrutin.nombreAbstention,
          totalInterventions: totalSeanceInterventions,
        },
      };
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/:numero/interventions - Interventions d'un scrutin
  // ===========================================================================
  fastify.get('/:numero/interventions', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Interventions d\'un scrutin',
      description: 'Retourne la liste paginée des interventions (débats, explications de vote) pour un scrutin',
      params: {
        type: 'object',
        required: ['numero'],
        properties: {
          numero: { type: 'integer' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          chambre: { type: 'string', enum: ['assemblee', 'senat'], default: 'assemblee' },
          session: { type: 'string', description: 'Session parlementaire (ex: 2024 pour Sénat)' },
          sort: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          search: { type: 'string', description: 'Recherche dans le contenu ou le nom du parlementaire', maxLength: 200 },
        },
      },
    },
    handler: async (request, _reply) => {
      const { numero } = z.object({ numero: z.coerce.number().int().positive() }).parse(request.params);
      const { page = 1, limit = 10, chambre = 'assemblee', session, sort = 'asc', search } =
        request.query as {
          page?: number; limit?: number; chambre?: string;
          session?: string; sort?: 'asc' | 'desc'; search?: string;
        };
      const skip = (page - 1) * limit;

      // Build where clause with optional session
      const whereClause: { numero: number; chambre: string; session?: string } = { numero, chambre };
      if (session) {
        whereClause.session = session;
      }

      const scrutin = await fastify.prisma.scrutin.findFirst({
        where: whereClause,
        orderBy: { date: 'desc' },
        select: { id: true, date: true, chambre: true },
      });

      if (!scrutin) {
        throw new ApiError(404, 'Scrutin non trouvé');
      }

      // Interventions de la séance (même date + chambre)
      const searchTerm = search?.trim();
      const interventionWhere: Prisma.InterventionWhereInput = { date: scrutin.date, chambre: scrutin.chambre };
      if (searchTerm) {
        interventionWhere.OR = [
          { contenu: { contains: searchTerm, mode: 'insensitive' } },
          { parlementaire: { nom: { contains: searchTerm, mode: 'insensitive' } } },
          { parlementaire: { prenom: { contains: searchTerm, mode: 'insensitive' } } },
          { orateurNom: { contains: searchTerm, mode: 'insensitive' } },
          { orateurPrenom: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      const [interventions, total] = await Promise.all([
        fastify.prisma.intervention.findMany({
          where: interventionWhere,
          orderBy: [{ date: sort }, { ordre: sort }],
          skip,
          take: limit,
          select: {
            id: true,
            type: true,
            contenu: true,
            date: true,
            ordre: true,
            sourceUrl: true,
            orateurNom: true,
            orateurPrenom: true,
            orateurQualite: true,
            parlementaire: {
              select: {
                id: true,
                slug: true,
                nom: true,
                prenom: true,
                photoUrl: true,
                groupe: {
                  select: {
                    nom: true,
                    couleur: true,
                  },
                },
              },
            },
          },
        }),
        fastify.prisma.intervention.count({ where: interventionWhere }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: interventions.map(truncateContenu),
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/interventions/:id - Contenu complet d'une intervention
  // ===========================================================================
  fastify.get('/interventions/:id', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Contenu complet d\'une intervention',
      description: 'Retourne le texte intégral d\'une intervention par son ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

      const intervention = await fastify.prisma.intervention.findUnique({
        where: { id },
        select: { id: true, contenu: true, sourceUrl: true },
      });

      if (!intervention) {
        throw new ApiError(404, 'Intervention non trouvée');
      }

      return { data: intervention };
    },
  });

  // ===========================================================================
  // GET /api/v1/scrutins/:numero/votes - Votes d'un scrutin
  // ===========================================================================
  fastify.get('/:numero/votes', {
    schema: {
      tags: ['Scrutins'],
      summary: 'Votes d\'un scrutin',
      description: 'Retourne la liste paginée des votes pour un scrutin',
      params: {
        type: 'object',
        required: ['numero'],
        properties: {
          numero: { type: 'integer' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          chambre: { type: 'string', enum: ['assemblee', 'senat'], default: 'assemblee' },
          session: { type: 'string', description: 'Session parlementaire (ex: 2024 pour Sénat)' },
          position: { type: 'string', enum: ['pour', 'contre', 'abstention', 'absent'] },
          groupe: { type: 'string', description: 'Slug du groupe politique' },
        },
      },
    },
    handler: async (request, _reply) => {
      const { numero } = z.object({ numero: z.coerce.number().int().positive() }).parse(request.params);
      const { page = 1, limit = 50, chambre = 'assemblee', session, position, groupe } =
        request.query as {
          page?: number; limit?: number; chambre?: string;
          session?: string; position?: string; groupe?: string;
        };
      const skip = (page - 1) * limit;

      // Build where clause with optional session
      const whereClause: { numero: number; chambre: string; session?: string } = { numero, chambre };
      if (session) {
        whereClause.session = session;
      }

      // Use findFirst instead of findUnique to avoid composite key issues.
      // chambre/legislature/date situent le scrutin dans le temps : sans elles,
      // impossible de résoudre le groupe d'époque des votants.
      const scrutin = await fastify.prisma.scrutin.findFirst({
        where: whereClause,
        orderBy: { date: 'desc' },
        select: { id: true, chambre: true, legislature: true, date: true },
      });

      if (!scrutin) {
        throw new ApiError(404, 'Scrutin non trouvé');
      }

      const where = {
        scrutinId: scrutin.id,
        ...(position && { position }),
        // Filtrer sur le groupe d'époque : `parlementaire.groupe` désignerait le
        // groupe actuel, ce qui ferait disparaître d'un groupe les députés qui
        // l'ont quitté depuis — et y ferait apparaître ceux qui l'ont rejoint.
        ...(groupe && { parlementaire: parlementaireDansGroupeAuScrutin(scrutin, groupe) }),
      };

      const [votes, total] = await Promise.all([
        fastify.prisma.vote.findMany({
          where,
          include: {
            parlementaire: {
              select: {
                id: true,
                slug: true,
                chambre: true,
                nom: true,
                prenom: true,
                photoUrl: true,
                groupe: {
                  select: { slug: true, nom: true, couleur: true },
                },
              },
            },
          },
          orderBy: { parlementaire: { nom: 'asc' } },
          skip,
          take: limit,
        }),
        fastify.prisma.vote.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Groupe d'époque : le groupe stocké sur le parlementaire est le groupe
      // courant, faux pour tout scrutin antérieur à un changement de groupe.
      const groupesEpoque = await chargerGroupesEpoque(
        fastify.prisma,
        scrutin,
        votes.map((v) => v.parlementaire.id),
      );

      return {
        data: votes.map((v) => {
          const groupe = groupesEpoque.get(v.parlementaire.id);
          return groupe ? { ...v, parlementaire: { ...v.parlementaire, groupe } } : v;
        }),
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    },
  });
};
