// =============================================================================
// Module Parlementaires - Service métier
// Supporte les députés (chambre='assemblee') et sénateurs (chambre='senat')
// =============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import {
  ParlementairesListQuery,
  ParlementaireVotesQuery,
  ParlementaireStats,
  PaginationMeta,
  Chambre,
} from './parlementaires.schema';
import { buildParlementaireSearchCondition } from '../../utils/search';
import { fuzzySearchCandidates, FuzzyCandidate } from '../../utils/fuzzy-search';

export class ParlementairesService {
  private readonly CACHE_TTL = 3600; // 1 hour (data synced daily)
  private readonly CACHE_TTL_LONG = 43200; // 12 hours

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  // ===========================================================================
  // LISTE DES PARLEMENTAIRES
  // ===========================================================================

  async getParlementaires(query: ParlementairesListQuery, forcedChambre?: Chambre) {
    const chambre = forcedChambre || query.chambre;
    const cacheKey = `parlementaires:list:${JSON.stringify({ ...query, chambre })}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const { page, limit, groupe, departement, search, actif, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ParlementaireWhereInput = {
      actif,
      ...(chambre && { chambre }),
      ...(groupe && { groupe: { slug: groupe } }),
      ...(departement && { circonscription: { departement } }),
      ...(search && buildParlementaireSearchCondition(search)),
    };

    const orderByMap: Record<string, Prisma.ParlementaireOrderByWithRelationInput> = {
      nom: { nom: order },
      prenom: { prenom: order },
      presence: { statsPresence: order },
      loyaute: { statsLoyaute: order },
      activite: { statsInterventions: order },
      amendements: { statsAmendements: order },
      interventions: { statsInterventions: order },
    };

    const orderBy = orderByMap[sort] || { nom: order };

    const parlementaireInclude = {
      groupe: {
        select: {
          id: true,
          slug: true,
          chambre: true,
          nom: true,
          nomComplet: true,
          couleur: true,
          position: true,
        },
      },
      circonscription: {
        select: {
          id: true,
          departement: true,
          numero: true,
          nom: true,
          type: true,
        },
      },
      _count: {
        select: {
          votes: true,
          interventions: true,
          amendements: true,
        },
      },
    };

    let [parlementaires, total] = await Promise.all([
      this.prisma.parlementaire.findMany({
        where,
        include: parlementaireInclude,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.parlementaire.count({ where }),
    ]);

    // Fuzzy search fallback: if exact search returned no results and there's a search term
    if (total === 0 && search) {
      const fuzzyResult = await this.fuzzySearchParlementaires(search, {
        chambre,
        groupe,
        departement,
        actif,
        limit,
        skip,
      }, parlementaireInclude, orderBy);
      parlementaires = fuzzyResult.parlementaires;
      total = fuzzyResult.total;
    }

    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    const result = {
      data: parlementaires.map((p) => ({
        ...p,
        _count: undefined,
        votesCount: p._count.votes,
        interventionsCount: p._count.interventions,
        amendementsCount: p._count.amendements,
        stats: p.statsCalculatedAt
          ? {
              presence: p.statsPresence ?? 0,
              loyaute: p.statsLoyaute ?? 0,
              participation: p.statsParticipation ?? 0,
              interventions: p.statsInterventions ?? 0,
              amendements: p.statsAmendements ?? 0,
            }
          : null,
        // Retirer les champs stats bruts
        statsPresence: undefined,
        statsPresenceSolennel: undefined,
        statsLoyaute: undefined,
        statsParticipation: undefined,
        statsInterventions: undefined,
        statsAmendements: undefined,
        statsAmendementsAdoptes: undefined,
        statsQuestions: undefined,
        statsCalculatedAt: undefined,
      })),
      meta,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // DÉTAIL D'UN PARLEMENTAIRE
  // ===========================================================================

  async getParlementaireBySlug(slug: string, include?: string[]) {
    const cacheKey = `parlementaire:${slug}:${include?.sort().join(',') || 'base'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const parlementaire = await this.prisma.parlementaire.findUnique({
      where: { slug },
      include: {
        groupe: true,
        circonscription: true,
        mandats: {
          where: {
            // Exclut les orphelins (actifs sans organe_ref = stale PM sans fermeture)
            OR: [{ dateFin: { not: null } }, { organeRef: { not: null } }],
          },
          orderBy: { dateDebut: 'desc' },
          take: 50,
          include: {
            commission: {
              select: { slug: true, nom: true, chambre: true },
            },
          },
        },
        declarations: {
          orderBy: { datePublication: 'desc' },
          take: 20,
        },
        ...(include?.includes('votes') && {
          votes: {
            include: {
              scrutin: {
                select: {
                  id: true,
                  numero: true,
                  chambre: true,
                  date: true,
                  titre: true,
                  sort: true,
                  typeVote: true,
                  tags: true,
                  importance: true,
                },
              },
            },
            orderBy: [{ scrutin: { date: 'desc' } }, { scrutin: { numero: 'desc' } }],
            take: 50,
          },
        }),
        ...(include?.includes('interventions') && {
          interventions: {
            orderBy: { date: 'desc' },
            take: 20,
          },
        }),
        ...(include?.includes('amendements') && {
          amendements: {
            orderBy: { dateDepot: 'desc' },
            take: 20,
          },
        }),
      },
    });

    if (!parlementaire) return null;

    let stats: ParlementaireStats | undefined;
    if (include?.includes('stats')) {
      stats = await this.getParlementaireStats(parlementaire.id, parlementaire.chambre as Chambre);
    }

    const result = { ...parlementaire, stats };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    return result;
  }

  async getParlementaireById(id: string) {
    return this.prisma.parlementaire.findUnique({
      where: { id },
      include: {
        groupe: true,
        circonscription: true,
      },
    });
  }

  // ===========================================================================
  // STATISTIQUES (utilise les stats pré-calculées lors de l'ingestion)
  // ===========================================================================

  async getParlementaireStats(parlementaireId: string, chambre: Chambre): Promise<ParlementaireStats> {
    const cacheKey = `parlementaire:stats:${parlementaireId}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Récupérer les stats pré-calculées depuis la table parlementaire
    const parlementaire = await this.prisma.parlementaire.findUnique({
      where: { id: parlementaireId },
      select: {
        statsPresence: true,
        statsPresenceSolennel: true,
        statsLoyaute: true,
        statsParticipation: true,
        statsInterventions: true,
        statsAmendements: true,
        statsAmendementsAdoptes: true,
        statsQuestions: true,
        statsCalculatedAt: true,
      },
    });

    // Si les stats sont pré-calculées, les utiliser directement
    if (parlementaire?.statsCalculatedAt) {
      const stats = {
        presence: parlementaire.statsPresence ?? 0,
        presenceSolennel: parlementaire.statsPresenceSolennel ?? null,
        loyaute: parlementaire.statsLoyaute ?? 0,
        participation: parlementaire.statsParticipation ?? 0,
        interventions: parlementaire.statsInterventions ?? 0,
        amendements: {
          proposes: parlementaire.statsAmendements ?? 0,
          adoptes: parlementaire.statsAmendementsAdoptes ?? 0,
        },
        questions: parlementaire.statsQuestions ?? 0,
      };

      // Cache court
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats));

      return stats;
    }

    // Fallback: calcul à la volée si les stats n'ont pas encore été calculées
    return this.calculateStatsOnTheFly(parlementaireId, chambre);
  }

  /**
   * Calcul à la volée des stats (fallback si pas de stats pré-calculées)
   */
  private async calculateStatsOnTheFly(parlementaireId: string, chambre: Chambre): Promise<ParlementaireStats> {
    const cacheKey = `parlementaire:stats:${parlementaireId}`;
    const since = await this.getOldestScrutinDate(chambre);

    const [presence, loyaute, votesCount, interventionsCount, amendementsStats, questionsCount] =
      await Promise.all([
        this.calculatePresence(parlementaireId, chambre, since),
        this.calculateLoyaute(parlementaireId, chambre, since),
        this.prisma.vote.count({
          where: {
            parlementaireId,
            position: { not: 'absent' },
          },
        }),
        this.prisma.intervention.count({
          where: {
            parlementaireId,
          },
        }),
        this.getAmendementsStats(parlementaireId),
        this.prisma.intervention.count({
          where: {
            parlementaireId,
            type: 'question',
          },
        }),
      ]);

    const stats = {
      presence,
      presenceSolennel: null, // Calculé lors du batch d'ingestion
      loyaute,
      participation: votesCount,
      interventions: interventionsCount,
      amendements: amendementsStats,
      questions: questionsCount,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, JSON.stringify(stats));

    return stats;
  }

  private async getOldestScrutinDate(chambre: Chambre): Promise<Date> {
    const cacheKey = `scrutin:oldest:date:${chambre}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return new Date(cached);
    }

    const oldestScrutin = await this.prisma.scrutin.findFirst({
      where: { chambre },
      orderBy: { date: 'asc' },
      select: { date: true },
    });

    const since = oldestScrutin?.date || new Date();

    // Cache pour 24h - cette date ne change quasi jamais
    await this.redis.setex(cacheKey, 86400, since.toISOString());

    return since;
  }

  private async calculatePresence(parlementaireId: string, chambre: Chambre, since: Date): Promise<number> {
    const [totalScrutins, participations] = await Promise.all([
      this.prisma.scrutin.count({
        where: { chambre, date: { gte: since } },
      }),
      this.prisma.vote.count({
        where: {
          parlementaireId,
          position: { not: 'absent' },
          scrutin: { chambre, date: { gte: since } },
        },
      }),
    ]);

    return totalScrutins > 0 ? Math.round((participations / totalScrutins) * 100) : 0;
  }

  private async calculateLoyaute(parlementaireId: string, chambre: Chambre, since: Date): Promise<number> {
    try {
      const parlementaire = await this.prisma.parlementaire.findUnique({
        where: { id: parlementaireId },
        select: { groupeId: true },
      });

      if (!parlementaire?.groupeId) return 0;

      // Optimized: Use raw SQL to calculate loyalty without loading all votes in memory
      // This prevents OOM kills on Railway when multiple users load detail pages
      // Note: Use actual PostgreSQL table/column names (snake_case) not Prisma model names
      const result = await this.prisma.$queryRaw<{ loyal_count: bigint; total_count: bigint }[]>`
        WITH parlementaire_votes AS (
          SELECT v.id, v.position, v.scrutin_id
          FROM votes v
          JOIN scrutins s ON v.scrutin_id = s.id
          WHERE v.parlementaire_id = ${parlementaireId}
            AND v.position != 'absent'
            AND s.chambre = ${chambre}
            AND s.date >= ${since}
        ),
        group_majority AS (
          SELECT
            v.scrutin_id,
            v.position,
            COUNT(*) as vote_count,
            ROW_NUMBER() OVER (PARTITION BY v.scrutin_id ORDER BY COUNT(*) DESC) as rn
          FROM votes v
          JOIN parlementaires p ON v.parlementaire_id = p.id
          WHERE p.groupe_id = ${parlementaire.groupeId}
            AND v.position != 'absent'
          GROUP BY v.scrutin_id, v.position
        )
        SELECT
          COUNT(CASE WHEN pv.position = gm.position THEN 1 END)::bigint as loyal_count,
          COUNT(*)::bigint as total_count
        FROM parlementaire_votes pv
        LEFT JOIN group_majority gm ON pv.scrutin_id = gm.scrutin_id AND gm.rn = 1
      `;

      const { loyal_count, total_count } = result[0] || { loyal_count: 0n, total_count: 0n };

      if (total_count === 0n) return 0;

      return Math.round((Number(loyal_count) / Number(total_count)) * 100);
    } catch (error) {
      console.error('Error calculating loyaute:', error);
      return 0; // Fallback to 0 instead of crashing
    }
  }

  private async getAmendementsStats(parlementaireId: string) {
    const [proposes, adoptes] = await Promise.all([
      this.prisma.amendement.count({
        where: { parlementaireId },
      }),
      // Match both 'Adopté' (AN format) and 'adopte' (Sénat format)
      this.prisma.amendement.count({
        where: {
          parlementaireId,
          OR: [
            { sort: 'Adopté' },
            { sort: 'adopte' },
            { sort: 'adopte_modifie' },
          ],
        },
      }),
    ]);

    return { proposes, adoptes };
  }

  // ===========================================================================
  // VOTES D'UN PARLEMENTAIRE
  // ===========================================================================

  async getParlementaireVotes(parlementaireId: string, groupeId: string | null, query: ParlementaireVotesQuery) {
    const { page, limit, position, tag, dateFrom, dateTo, dissidentOnly } = query;
    const offset = (page - 1) * limit;

    // Si dissidentOnly et pas de groupe, retourner vide
    if (dissidentOnly && !groupeId) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0, hasNext: false, hasPrev: false },
      };
    }

    // Build dynamic WHERE conditions
    const conditions: string[] = ['v.parlementaire_id = $1'];
    const countConditions: string[] = ['v.parlementaire_id = $1'];
    const params: (string | Date)[] = [parlementaireId];
    let paramIndex = 2;

    if (position) {
      conditions.push(`v.position = $${paramIndex}`);
      countConditions.push(`v.position = $${paramIndex}`);
      params.push(position);
      paramIndex++;
    }

    if (tag) {
      conditions.push(`$${paramIndex} = ANY(s.tags)`);
      countConditions.push(`$${paramIndex} = ANY(s.tags)`);
      params.push(tag);
      paramIndex++;
    }

    if (dateFrom) {
      conditions.push(`s.date >= $${paramIndex}`);
      countConditions.push(`s.date >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`s.date <= $${paramIndex}`);
      countConditions.push(`s.date <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    // Add dissident filter if needed
    if (dissidentOnly && groupeId) {
      conditions.push(`v.position != gm.majority_position`);
      conditions.push(`gm.majority_position IS NOT NULL`);
      countConditions.push(`v.position != gm.majority_position`);
      countConditions.push(`gm.majority_position IS NOT NULL`);
    }

    const whereClause = conditions.join(' AND ');
    const countWhereClause = countConditions.join(' AND ');

    // Use raw SQL with group_majority CTE for efficiency
    // This calculates the group's majority position for each scrutin
    const groupeIdParam = groupeId || '00000000-0000-0000-0000-000000000000';

    interface VoteRow {
      id: string;
      position: string;
      groupe_position: string | null;
      scrutin_id: string;
      scrutin_numero: number;
      scrutin_chambre: string;
      scrutin_session: string | null;
      scrutin_date: Date;
      scrutin_titre: string;
      scrutin_sort: string;
      scrutin_type_vote: string;
      scrutin_tags: string[];
      scrutin_importance: number;
      scrutin_nombre_pour: number;
      scrutin_nombre_contre: number;
      scrutin_nombre_abstention: number;
    }

    const votesQuery = `
      WITH group_majority AS (
        SELECT
          gv.scrutin_id,
          gv.position as majority_position,
          COUNT(*) as vote_count,
          ROW_NUMBER() OVER (PARTITION BY gv.scrutin_id ORDER BY COUNT(*) DESC) as rn
        FROM votes gv
        JOIN parlementaires p ON gv.parlementaire_id = p.id
        WHERE p.groupe_id = '${groupeIdParam}'
          AND gv.position != 'absent'
        GROUP BY gv.scrutin_id, gv.position
      )
      SELECT
        v.id,
        v.position,
        gm.majority_position as groupe_position,
        s.id as scrutin_id,
        s.numero as scrutin_numero,
        s.chambre as scrutin_chambre,
        s.session as scrutin_session,
        s.date as scrutin_date,
        s.titre as scrutin_titre,
        s.sort as scrutin_sort,
        s.type_vote as scrutin_type_vote,
        s.tags as scrutin_tags,
        s.importance as scrutin_importance,
        s.nombre_pour as scrutin_nombre_pour,
        s.nombre_contre as scrutin_nombre_contre,
        s.nombre_abstention as scrutin_nombre_abstention
      FROM votes v
      JOIN scrutins s ON v.scrutin_id = s.id
      LEFT JOIN group_majority gm ON v.scrutin_id = gm.scrutin_id AND gm.rn = 1
      WHERE ${whereClause}
      ORDER BY s.date DESC, s.numero DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = `
      WITH group_majority AS (
        SELECT
          gv.scrutin_id,
          gv.position as majority_position,
          COUNT(*) as vote_count,
          ROW_NUMBER() OVER (PARTITION BY gv.scrutin_id ORDER BY COUNT(*) DESC) as rn
        FROM votes gv
        JOIN parlementaires p ON gv.parlementaire_id = p.id
        WHERE p.groupe_id = '${groupeIdParam}'
          AND gv.position != 'absent'
        GROUP BY gv.scrutin_id, gv.position
      )
      SELECT COUNT(*)::int as total
      FROM votes v
      JOIN scrutins s ON v.scrutin_id = s.id
      LEFT JOIN group_majority gm ON v.scrutin_id = gm.scrutin_id AND gm.rn = 1
      WHERE ${countWhereClause}
    `;

    const [votesResult, countResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<VoteRow[]>(votesQuery, ...params),
      this.prisma.$queryRawUnsafe<{ total: number }[]>(countQuery, ...params),
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Transform results to match expected format
    const data = votesResult.map((row) => ({
      id: row.id,
      position: row.position,
      groupePosition: row.groupe_position,
      scrutin: {
        id: row.scrutin_id,
        numero: row.scrutin_numero,
        chambre: row.scrutin_chambre,
        session: row.scrutin_session,
        date: row.scrutin_date,
        titre: row.scrutin_titre,
        sort: row.scrutin_sort,
        typeVote: row.scrutin_type_vote,
        tags: row.scrutin_tags,
        importance: row.scrutin_importance,
        nombrePour: row.scrutin_nombre_pour,
        nombreContre: row.scrutin_nombre_contre,
        nombreAbstention: row.scrutin_nombre_abstention,
      },
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // ===========================================================================
  // COMPARAISON DE PARLEMENTAIRES (optimisé avec stats pré-calculées)
  // ===========================================================================

  async compareParlementaires(slugs: string[]) {
    // Cache par combinaison de slugs (triés pour cohérence)
    const sortedSlugs = [...slugs].sort();
    const cacheKey = `parlementaires:compare:${sortedSlugs.join(',')}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Charger tous les parlementaires en UNE SEULE requête avec leurs stats pré-calculées
    const parlementaires = await this.prisma.parlementaire.findMany({
      where: {
        slug: { in: slugs },
      },
      include: {
        groupe: true,
        circonscription: true,
      },
    });

    // Transformer les résultats avec les stats pré-calculées
    const result = parlementaires.map((p) => ({
      ...p,
      stats: p.statsCalculatedAt
        ? {
            presence: p.statsPresence ?? 0,
            presenceSolennel: p.statsPresenceSolennel ?? null,
            loyaute: p.statsLoyaute ?? 0,
            participation: p.statsParticipation ?? 0,
            interventions: p.statsInterventions ?? 0,
            amendements: {
              proposes: p.statsAmendements ?? 0,
              adoptes: p.statsAmendementsAdoptes ?? 0,
            },
            questions: p.statsQuestions ?? 0,
          }
        : null,
      // Retirer les champs stats bruts de la réponse
      statsPresence: undefined,
      statsPresenceSolennel: undefined,
      statsLoyaute: undefined,
      statsParticipation: undefined,
      statsInterventions: undefined,
      statsAmendements: undefined,
      statsAmendementsAdoptes: undefined,
      statsQuestions: undefined,
      statsCalculatedAt: undefined,
    }));

    // Cache pour 12h (données rafraîchies en daily)
    await this.redis.setex(cacheKey, 43200, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // GROUPES POLITIQUES
  // ===========================================================================

  async getGroupes(chambre?: Chambre) {
    const cacheKey = `groupes:${chambre || 'all'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupes = await this.prisma.groupePolitique.findMany({
      where: {
        actif: true,
        ...(chambre && { chambre }),
      },
      include: {
        _count: { select: { parlementaires: { where: { actif: true } } } },
      },
      orderBy: { ordre: 'asc' },
    });

    const result = groupes.map((g) => ({
      ...g,
      membresCount: g._count.parlementaires,
      _count: undefined,
    }));

    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // INVALIDATION DU CACHE
  // ===========================================================================

  // ===========================================================================
  // RECHERCHE FUZZY (fallback quand la recherche exacte ne donne rien)
  // ===========================================================================

  private async getFuzzyCandidates(filters: {
    chambre?: string;
    groupe?: string;
    departement?: string;
    actif?: boolean;
  }): Promise<FuzzyCandidate[]> {
    const cacheKey = `parlementaires:fuzzy-candidates:${JSON.stringify(filters)}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const where: Prisma.ParlementaireWhereInput = {
      ...(filters.actif !== undefined && { actif: filters.actif }),
      ...(filters.chambre && { chambre: filters.chambre }),
      ...(filters.groupe && { groupe: { slug: filters.groupe } }),
      ...(filters.departement && { circonscription: { departement: filters.departement } }),
    };

    const candidates = await this.prisma.parlementaire.findMany({
      where,
      select: { id: true, nom: true, prenom: true, slug: true },
    });

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(candidates));

    return candidates;
  }

  private async fuzzySearchParlementaires(
    search: string,
    filters: {
      chambre?: string;
      groupe?: string;
      departement?: string;
      actif?: boolean;
      limit: number;
      skip: number;
    },
    include: any,
    _orderBy: any
  ) {
    const candidates = await this.getFuzzyCandidates({
      chambre: filters.chambre,
      groupe: filters.groupe,
      departement: filters.departement,
      actif: filters.actif,
    });

    const fuzzyResults = fuzzySearchCandidates(search, candidates);

    if (fuzzyResults.length === 0) {
      return { parlementaires: [] as any[], total: 0 };
    }

    const matchingIds = fuzzyResults.map((r) => r.id);
    const total = matchingIds.length;

    // Apply pagination to the sorted fuzzy results
    const pageIds = matchingIds.slice(filters.skip, filters.skip + filters.limit);

    const parlementaires = await this.prisma.parlementaire.findMany({
      where: { id: { in: pageIds } },
      include,
    });

    // Preserve fuzzy score ordering
    const idOrder = new Map(pageIds.map((id, idx) => [id, idx]));
    parlementaires.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

    return { parlementaires, total };
  }

  // ===========================================================================
  // INVALIDATION DU CACHE
  // ===========================================================================

  async invalidateCache(parlementaireId?: string) {
    if (parlementaireId) {
      const parlementaire = await this.prisma.parlementaire.findUnique({
        where: { id: parlementaireId },
        select: { slug: true },
      });
      if (parlementaire) {
        await this.redis.del(`parlementaire:${parlementaire.slug}:*`);
        await this.redis.del(`parlementaire:stats:${parlementaireId}`);
      }
    }
    const keys = await this.redis.keys('parlementaires:list:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
