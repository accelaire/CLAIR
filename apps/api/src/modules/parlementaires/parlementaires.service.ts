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
import {
  CTE_GROUP_MAJORITY_EPOQUE,
  joinMandatEpoque,
  scrutinsDesMandats,
} from '../../utils/groupe-epoque';
import { fuzzySearchCandidates, FuzzyCandidate } from '../../utils/fuzzy-search';

// =============================================================================
// SESSIONS SÉNAT — l'axe temporel de la chambre haute
//
// Le Sénat n'a pas de législature : il ne se renouvelle jamais entièrement (deux
// cohortes de mandature y coexistent en permanence). Une « mandature » est une
// étiquette de cohorte — elle ne décrira jamais la chambre à un instant donné.
// Seule la SESSION ordinaire (1er oct. → 30 sept.) est une fenêtre de temps, donc
// le seul axe capable de répondre à « qui siégeait alors ? ».
//
// L'appartenance d'un sénateur à une session se DÉRIVE du chevauchement entre son
// mandat et la fenêtre : rien n'est stocké sur la personne.
// =============================================================================

/** En deçà de cette couverture, on refuse d'exposer la session : la servir
 *  reviendrait à présenter une demi-chambre comme si c'était le Sénat de l'époque. */
const SENAT_COUVERTURE_MIN = 330;

interface SessionWindow {
  label: string;
  debut: Date;
  fin: Date;
}

/** Fenêtre d'une session ordinaire ouverte en octobre `anneeDebut`. */
function sessionWindow(anneeDebut: number): SessionWindow {
  return {
    label: `${anneeDebut}-${anneeDebut + 1}`,
    debut: new Date(Date.UTC(anneeDebut, 9, 1)), // 1er octobre
    fin: new Date(Date.UTC(anneeDebut + 1, 8, 30)), // 30 septembre
  };
}

function parseSessionWindow(session: string): SessionWindow | null {
  const anneeDebut = Number(session.split('-')[0]);
  return Number.isFinite(anneeDebut) ? sessionWindow(anneeDebut) : null;
}

/**
 * Filtre `MandatParlementaire` correspondant à la période demandée, quel que soit
 * l'axe : `legislature` (AN) ou `session` (Sénat, par chevauchement d'intervalle).
 * Renvoie `null` si aucune période n'est demandée.
 */
function buildPeriodMandatWhere(
  legislature?: number,
  session?: string,
): Prisma.MandatParlementaireWhereInput | null {
  if (legislature !== undefined) return { legislature };

  if (session) {
    const w = parseSessionWindow(session);
    if (!w) return null;
    // Le mandat chevauche la session : il a commencé avant sa fin, et n'était pas
    // déjà clos à son début.
    return {
      chambre: 'senat',
      dateDebut: { lte: w.fin },
      OR: [{ dateFin: null }, { dateFin: { gte: w.debut } }],
    };
  }

  return null;
}

/** Champs d'un amendement renvoyés par la liste d'un parlementaire. */
const AMENDEMENT_SELECT = {
  id: true,
  uid: true,
  numero: true,
  legislature: true,
  chambre: true,
  texteRef: true,
  articleVise: true,
  dispositif: true,
  exposeSommaire: true,
  auteurLibelle: true,
  sort: true,
  dateDepot: true,
  dateSort: true,
  scrutins: {
    select: {
      id: true,
      numero: true,
      chambre: true,
      session: true,
      titre: true,
      date: true,
      sort: true,
    },
    take: 1,
  },
  dossier: {
    select: {
      uid: true,
      titre: true,
      titreCourt: true,
    },
  },
} satisfies Prisma.AmendementSelect;

export class ParlementairesService {
  private readonly CACHE_TTL = 3600; // 1 hour (data synced daily)
  private readonly CACHE_TTL_LONG = 43200; // 12 hours

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  // ===========================================================================
  // TRI PARTAGÉ (liste + rang) — garantit un ordre identique entre les deux
  // ===========================================================================

  /**
   * Tri des listes et classements.
   *
   * `periode` choisit le jeu de colonnes de stats :
   *  - `mandat` (défaut) : le mandat EN COURS. C'est le seul tri qui compare des
   *    élus entre eux à dénominateur égal.
   *  - `carriere` : tous les mandats cumulés. Répond à une autre question — « qui
   *    a le plus siégé, tout compris » — et avantage mécaniquement les réélus.
   *
   * Les compteurs bruts (interventions, amendements) sont des totaux de carrière
   * dans les deux cas : ils ne dépendent d'aucun dénominateur de scrutins.
   */
  private buildParlementaireOrderBy(
    sort: string,
    order: 'asc' | 'desc',
    periode: 'mandat' | 'carriere' = 'mandat'
  ): Prisma.ParlementaireOrderByWithRelationInput[] {
    const carriere = periode === 'carriere';
    const primaryMap: Record<string, Prisma.ParlementaireOrderByWithRelationInput> = {
      nom: { nom: order },
      prenom: { prenom: order },
      presence: carriere ? { statsCarrierePresence: order } : { statsPresence: order },
      loyaute: carriere ? { statsCarriereLoyaute: order } : { statsLoyaute: order },
      activite: { statsInterventions: order },
      amendements: { statsAmendements: order },
      interventions: { statsInterventions: order },
    };
    const primary = primaryMap[sort] || { nom: order };
    // Tiebreakers déterministes : indispensables pour que la liste paginée et le
    // calcul du rang ordonnent les ex æquo (ex. 0 amendement / 0 intervention,
    // ou stats null) de façon strictement identique. Sans cela, page =
    // ceil(rank / size) peut tomber sur la mauvaise page dans les gros paquets
    // d'égalités. `id` (unique) garantit un ordre total stable.
    return [primary, { nom: 'asc' }, { id: 'asc' }];
  }

  // ===========================================================================
  // RANG D'UN PARLEMENTAIRE DANS LE CLASSEMENT
  // ===========================================================================

  /**
   * Position 1-based d'un parlementaire dans le classement trié, avec le total.
   * Réutilise EXACTEMENT le where + orderBy de getParlementaires pour que
   * page = ceil(rank / pageSize) tombe sur la bonne page de la liste paginée.
   * Renvoie rank=null si le slug n'appartient pas à l'ensemble filtré.
   */
  async getParlementaireRank(
    slug: string,
    opts: {
      sort: string;
      order: 'asc' | 'desc';
      chambre?: Chambre;
      groupe?: string;
      periode?: 'mandat' | 'carriere';
    }
  ): Promise<{ rank: number | null; total: number }> {
    const { sort, order, chambre, groupe, periode } = opts;
    const cacheKey = `parlementaires:rank:${JSON.stringify({ slug, sort, order, chambre, groupe, periode })}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const where: Prisma.ParlementaireWhereInput = {
      actif: true,
      ...(chambre && { chambre }),
      ...(groupe && { groupe: { slug: groupe } }),
    };

    const rows = await this.prisma.parlementaire.findMany({
      where,
      orderBy: this.buildParlementaireOrderBy(sort, order, periode),
      select: { slug: true },
    });

    const index = rows.findIndex((r) => r.slug === slug);
    const result = { rank: index >= 0 ? index + 1 : null, total: rows.length };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    return result;
  }

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

    const { page, limit, groupe, departement, search, actif, sort, order, legislature, session, periode } = query;
    const skip = (page - 1) * limit;

    // Filtre de PÉRIODE, deux axes selon la chambre :
    //  - AN    : `legislature` (15/16/17) — la cohorte EST la période.
    //  - Sénat : `session` (1er oct. → 30 sept.) — le Sénat ne se renouvelant jamais
    //            entièrement, seule une fenêtre de temps décrit la chambre à un
    //            instant donné. L'appartenance se dérive du CHEVAUCHEMENT avec
    //            l'intervalle du mandat : aucune session n'est stockée sur la personne.
    // Dans les deux cas, le groupe/circonscription de la période sont réinjectés au
    // shaping. Sans filtre de période : comportement courant (parlementaires actifs).
    const periodMandatWhere = buildPeriodMandatWhere(legislature, session);

    const where: Prisma.ParlementaireWhereInput = {
      ...(periodMandatWhere
        ? {
            mandatsParlementaires: {
              some: {
                ...periodMandatWhere,
                ...(groupe && { groupe: { slug: groupe } }),
                ...(departement && { circonscription: { departement } }),
              },
            },
          }
        : {
            actif,
            ...(groupe && { groupe: { slug: groupe } }),
            ...(departement && { circonscription: { departement } }),
          }),
      ...(chambre && { chambre }),
      ...(search && buildParlementaireSearchCondition(search)),
    };

    const orderBy = this.buildParlementaireOrderBy(sort, order, periode);

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
      }, parlementaireInclude);
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

    // Groupe/circonscription de la période filtrée, réinjectés au shaping (sinon la
    // liste afficherait le groupe COURANT pour une période passée). Une seule requête
    // pour toute la page : pas de N+1.
    const periodByPerson = new Map<string, { groupe: unknown; circonscription: unknown }>();
    if (periodMandatWhere && parlementaires.length > 0) {
      const periodMandats = await this.prisma.mandatParlementaire.findMany({
        where: { personneId: { in: parlementaires.map((p) => p.id) }, ...periodMandatWhere },
        select: {
          personneId: true,
          groupe: { select: { id: true, slug: true, chambre: true, nom: true, nomComplet: true, couleur: true, position: true } },
          circonscription: { select: { id: true, departement: true, numero: true, nom: true, type: true } },
        },
      });
      for (const m of periodMandats) {
        periodByPerson.set(m.personneId, { groupe: m.groupe, circonscription: m.circonscription });
      }
    }

    const result = {
      data: parlementaires.map((p) => {
        const period = periodByPerson.get(p.id);
        return {
        ...p,
        ...(period && { groupe: period.groupe, circonscription: period.circonscription }),
        legislature,
        session,
        _count: undefined,
        // sourceData est le blob brut de l'API source : 65 % du poids d'une
        // fiche de député, pour une donnée inutilisée en liste. Elle reste
        // disponible sur le détail.
        sourceData: undefined,
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
        };
      }),
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
        // Timeline multi-législatures : un mandat par période (AN: législature,
        // Sénat: mandature), avec le groupe/circonscription de CETTE période.
        mandatsParlementaires: {
          orderBy: [{ legislature: 'desc' }, { mandature: 'desc' }, { dateDebut: 'desc' }],
          include: {
            groupe: { select: { slug: true, nom: true, couleur: true, legislature: true } },
            circonscription: { select: { nom: true, departement: true, numero: true } },
          },
        },
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
                  // Le numéro ne suffit pas à identifier un scrutin (réinitialisé
                  // à chaque session au Sénat, à chaque législature à l'AN) : sans
                  // la période, les liens résolvent vers un homonyme.
                  session: true,
                  legislature: true,
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
        statsCarrierePresence: true,
        statsCarriereLoyaute: true,
        statsCarriereParticipation: true,
        statsInterventions: true,
        statsAmendements: true,
        statsAmendementsAdoptes: true,
        statsQuestions: true,
        statsCalculatedAt: true,
      },
    });

    // La FICHE présente la CARRIÈRE : tous les mandats de la personne, cumulés.
    // C'est le portrait d'un élu, pas une comparaison — contrairement aux listes
    // et classements, qui trient sur le mandat en cours pour que tous les élus
    // partagent le même dénominateur de scrutins (cf. buildParlementaireOrderBy).
    // Repli sur les colonnes du mandat courant tant que le batch de stats n'a pas
    // encore rempli les colonnes de carrière (déploiement, base fraîche).
    if (parlementaire?.statsCalculatedAt) {
      const stats = {
        presence: parlementaire.statsCarrierePresence ?? parlementaire.statsPresence ?? 0,
        presenceSolennel: parlementaire.statsPresenceSolennel ?? null,
        loyaute: parlementaire.statsCarriereLoyaute ?? parlementaire.statsLoyaute ?? 0,
        participation:
          parlementaire.statsCarriereParticipation ?? parlementaire.statsParticipation ?? 0,
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

  /**
   * Scrutins sur lesquels le parlementaire pouvait voter : ceux des périodes de
   * ses mandats. Repli sur `date >= since` (toute la chambre) s'il n'a aucun
   * mandat connu.
   */
  private async getScrutinsPerimetre(
    parlementaireId: string,
    chambre: Chambre,
    since: Date
  ): Promise<Prisma.ScrutinWhereInput> {
    const mandats = await this.prisma.mandatParlementaire.findMany({
      where: { personneId: parlementaireId, chambre },
      select: { legislature: true, dateDebut: true, dateFin: true },
    });

    return scrutinsDesMandats(chambre, mandats) ?? { chambre, date: { gte: since } };
  }

  private async calculatePresence(parlementaireId: string, chambre: Chambre, since: Date): Promise<number> {
    const perimetre = await this.getScrutinsPerimetre(parlementaireId, chambre, since);

    const [totalScrutins, participations] = await Promise.all([
      this.prisma.scrutin.count({ where: perimetre }),
      this.prisma.vote.count({
        where: {
          parlementaireId,
          position: { not: 'absent' },
          scrutin: perimetre,
        },
      }),
    ]);

    return totalScrutins > 0 ? Math.round((participations / totalScrutins) * 100) : 0;
  }

  private async calculateLoyaute(parlementaireId: string, chambre: Chambre, since: Date): Promise<number> {
    try {
      // La loyauté se mesure contre le groupe où le parlementaire siégeait AU
      // MOMENT de chaque scrutin, et contre la majorité de CE groupe à ce
      // moment-là. Prendre son groupe actuel comme référence unique comparait
      // ses votes de la 16e à la position d'un groupe de la 17e.
      //
      // Raw SQL (et non un chargement en mémoire) : évite les OOM sur Railway
      // quand plusieurs fiches sont ouvertes en même temps.
      const result = await this.prisma.$queryRawUnsafe<{ loyal_count: bigint; total_count: bigint }[]>(
        `
        WITH parlementaire_votes AS (
          SELECT v.scrutin_id, v.position,
                 COALESCE(m.groupe_id, p.groupe_id) AS groupe_id
          FROM votes v
          JOIN scrutins s ON s.id = v.scrutin_id
          JOIN parlementaires p ON p.id = v.parlementaire_id
          ${joinMandatEpoque('v', 's', 'm')}
          WHERE v.parlementaire_id = $1
            AND v.position != 'absent'
            AND s.chambre = $2
            AND s.date >= $3
        ),
        group_majority AS (
          SELECT
            gv.scrutin_id,
            gv.position,
            ROW_NUMBER() OVER (PARTITION BY gv.scrutin_id ORDER BY COUNT(*) DESC) as rn
          FROM votes gv
          JOIN scrutins gs ON gs.id = gv.scrutin_id
          JOIN parlementaires gp ON gp.id = gv.parlementaire_id
          ${joinMandatEpoque('gv', 'gs', 'gm')}
          JOIN parlementaire_votes pv
            ON pv.scrutin_id = gv.scrutin_id
           AND pv.groupe_id = COALESCE(gm.groupe_id, gp.groupe_id)
          WHERE gv.position != 'absent'
          GROUP BY gv.scrutin_id, gv.position
        )
        SELECT
          COUNT(CASE WHEN pv.position = gm2.position THEN 1 END)::bigint as loyal_count,
          COUNT(*)::bigint as total_count
        FROM parlementaire_votes pv
        LEFT JOIN group_majority gm2 ON pv.scrutin_id = gm2.scrutin_id AND gm2.rn = 1
        `,
        parlementaireId,
        chambre,
        since,
      );

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

    // Le groupe courant entre dans la clé : il sert de repli quand le mandat
    // d'époque est introuvable, deux valeurs donnent donc deux résultats.
    const cacheKey = `parlementaire:votes:${parlementaireId}:${JSON.stringify({
      groupeId,
      page,
      limit,
      position,
      tag,
      dateFrom,
      dateTo,
      dissidentOnly,
    })}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
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

    // Colonnes du vote et de son scrutin, communes aux deux formes de requête.
    const COLONNES_VOTE = `
        v.id,
        v.position,
        v.scrutin_id,
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
        s.nombre_abstention as scrutin_nombre_abstention`;

    // Deux régimes, selon que la majorité de groupe FILTRE ou seulement DÉCORE.
    //
    // `dissidentOnly` la met dans le WHERE : elle doit alors être connue pour
    // tous les votes candidats, avant pagination. La CTE reste donc complète et
    // la requête de comptage la porte aussi — c'est le prix du filtre, et la
    // raison pour laquelle on ne peut pas simplement borner la CTE partout.
    //
    // Sinon la majorité n'est qu'une colonne affichée : on sélectionne d'abord
    // la page (20 lignes), puis on ne calcule la majorité que pour ces
    // scrutins-là. Le comptage, lui, n'a plus aucune raison de porter la CTE :
    // aucune de ses conditions n'y fait référence.
    const votesQuery = dissidentOnly
      ? `
      WITH ${CTE_GROUP_MAJORITY_EPOQUE(parlementaireId, groupeIdParam)}
      SELECT
        ${COLONNES_VOTE},
        gm.majority_position as groupe_position
      FROM votes v
      JOIN scrutins s ON v.scrutin_id = s.id
      LEFT JOIN group_majority gm ON v.scrutin_id = gm.scrutin_id AND gm.rn = 1
      WHERE ${whereClause}
      ORDER BY s.date DESC, s.numero DESC
      LIMIT ${limit} OFFSET ${offset}
    `
      : `
      WITH page AS (
        SELECT ${COLONNES_VOTE}
        FROM votes v
        JOIN scrutins s ON v.scrutin_id = s.id
        WHERE ${whereClause}
        ORDER BY s.date DESC, s.numero DESC
        LIMIT ${limit} OFFSET ${offset}
      ),
      ${CTE_GROUP_MAJORITY_EPOQUE(parlementaireId, groupeIdParam, {
        scrutinIdsSubquery: 'SELECT scrutin_id FROM page',
      })}
      SELECT
        page.*,
        gm.majority_position as groupe_position
      FROM page
      LEFT JOIN group_majority gm ON gm.scrutin_id = page.scrutin_id AND gm.rn = 1
      ORDER BY page.scrutin_date DESC, page.scrutin_numero DESC
    `;

    const countQuery = dissidentOnly
      ? `
      WITH ${CTE_GROUP_MAJORITY_EPOQUE(parlementaireId, groupeIdParam)}
      SELECT COUNT(*)::int as total
      FROM votes v
      JOIN scrutins s ON v.scrutin_id = s.id
      LEFT JOIN group_majority gm ON v.scrutin_id = gm.scrutin_id AND gm.rn = 1
      WHERE ${countWhereClause}
    `
      : `
      SELECT COUNT(*)::int as total
      FROM votes v
      JOIN scrutins s ON v.scrutin_id = s.id
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

    const result = {
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

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // AMENDEMENTS D'UN PARLEMENTAIRE
  // ===========================================================================

  /**
   * Amendements déposés OU cosignés par un parlementaire.
   *
   * Le périmètre est une union de deux ensembles : `amendements.parlementaire_id`
   * (l'auteur) et la table de cosignatures. Exprimé en `OR` dans un seul WHERE —
   * ce que produit naturellement Prisma —, Postgres ne peut se servir d'aucun des
   * deux index et parcourt les 197 000 amendements en séquentiel ; le coût estimé
   * déclenchait même la compilation JIT, 250 ms perdus avant la première ligne.
   *
   * En UNION, chaque branche redevient une simple recherche indexée. On ne
   * ramène ainsi que les identifiants de la page, dont Prisma charge ensuite le
   * détail avec ses relations — deux allers-retours courts plutôt qu'un long.
   */
  async getParlementaireAmendements(
    parlementaireId: string,
    query: {
      page: number;
      limit: number;
      sort?: string;
      dateFrom?: string;
      dateTo?: string;
      votedOnly?: boolean;
    }
  ) {
    const { page, limit, sort, dateFrom, dateTo, votedOnly } = query;
    const offset = (page - 1) * limit;

    const cacheKey = `parlementaire:amendements:${parlementaireId}:${JSON.stringify({
      page,
      limit,
      sort,
      dateFrom,
      dateTo,
      votedOnly,
    })}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const conditions: string[] = [];
    const params: (string | Date)[] = [parlementaireId];
    let paramIndex = 2;

    if (sort) {
      conditions.push(`a.sort = $${paramIndex}`);
      params.push(sort);
      paramIndex++;
    }
    if (dateFrom) {
      conditions.push(`a.date_depot >= $${paramIndex}`);
      params.push(new Date(dateFrom));
      paramIndex++;
    }
    if (dateTo) {
      conditions.push(`a.date_depot <= $${paramIndex}`);
      params.push(new Date(dateTo));
      paramIndex++;
    }
    if (votedOnly) {
      conditions.push(`EXISTS (SELECT 1 FROM "_AmendementToScrutin" ats WHERE ats."A" = a.id)`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const CANDIDATS = `
      WITH candidats AS (
        SELECT id FROM amendements WHERE parlementaire_id = $1
        UNION
        SELECT "A" AS id FROM "_AmendementCosignataires" WHERE "B" = $1
      )`;

    // Le tri porte sur trois colonnes dont deux acceptent NULL : des ex æquo
    // parfaits existent (même dépôt, même dossier, même rang). Sans départage,
    // deux exécutions les ordonnent différemment et la pagination peut répéter
    // ou sauter une ligne d'une page à l'autre. `id` rend l'ordre total.
    const ORDRE = `ORDER BY a.date_depot DESC NULLS LAST, a.dossier_id ASC,
                            a.numero_ordre DESC NULLS LAST, a.id ASC`;

    // Comptage séparé plutôt qu'un `COUNT(*) OVER ()` : la fenêtre ne renvoie
    // aucune ligne — donc aucun total — dès que la page demandée est au-delà de
    // la fin, et l'interface afficherait « 0 résultat » sur un jeu non vide.
    const pageQuery = `
      ${CANDIDATS}
      SELECT a.id
      FROM amendements a
      JOIN candidats c ON c.id = a.id
      ${whereClause}
      ${ORDRE}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = `
      ${CANDIDATS}
      SELECT COUNT(*)::int as total
      FROM amendements a
      JOIN candidats c ON c.id = a.id
      ${whereClause}
    `;

    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ id: string }[]>(pageQuery, ...params),
      this.prisma.$queryRawUnsafe<{ total: number }[]>(countQuery, ...params),
    ]);

    const total = countResult[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    let amendements: unknown[] = [];
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const charges = await this.prisma.amendement.findMany({
        where: { id: { in: ids } },
        select: AMENDEMENT_SELECT,
      });
      // `IN` ne garantit aucun ordre : on rétablit celui décidé par le tri SQL.
      const parId = new Map(charges.map((a) => [a.id, a]));
      amendements = ids.map((id) => parId.get(id)).filter(Boolean);
    }

    const result = {
      data: amendements,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    return result;
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
      // sourceData retiré : voir getParlementaires. Reste sur le détail.
      sourceData: undefined,
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

  /**
   * Groupes politiques d'une période.
   *
   * Un sigle de groupe n'a de sens qu'à un instant donné : RE, LAREM et GDR-NUPES
   * coexistent en base sur trois législatures. Sans borne, la liste en mélangeait
   * 36 à l'Assemblée, dont des groupes dissous présentés comme actuels.
   *
   * Les effectifs viennent des MANDATS du groupe (et non des parlementaires dont
   * c'est le groupe courant), sans quoi tout groupe dissous afficherait 0 membre.
   *
   * Défaut : la législature la plus récente en base — dérivée des données, donc
   * sans constante à maintenir au changement de législature.
   */
  async getGroupes(chambre?: Chambre, legislature?: number, session?: string) {
    const legislatureAN =
      legislature ??
      (
        await this.prisma.groupePolitique.findFirst({
          where: { chambre: 'assemblee', legislature: { not: null } },
          orderBy: { legislature: 'desc' },
          select: { legislature: true },
        })
      )?.legislature ??
      null;

    // Sénat : session demandée, ou courante par défaut (dérivée du scrutin le plus récent).
    const sessionCouranteSenat =
      chambre === 'assemblee'
        ? null
        : (
            await this.prisma.scrutin.findFirst({
              where: { chambre: 'senat' },
              orderBy: { date: 'desc' },
              select: { session: true },
            })
          )?.session ?? null;
    const sessionSenat = chambre === 'assemblee' ? undefined : session ?? sessionCouranteSenat ?? undefined;
    // Effectif Sénat : session passée → chevauchement d'intervalle ; session courante
    // → « siège actuellement » (dateFin null). Sinon `_count` mélangerait les époques.
    const senatWhereSession =
      sessionSenat && sessionSenat !== (sessionCouranteSenat ?? undefined) ? sessionSenat : undefined;

    const cacheKey = `groupes:${chambre || 'all'}:${legislatureAN ?? 'na'}:${sessionSenat ?? 'na'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Le Sénat n'a pas de législature : seule l'Assemblée est bornée.
    const periode: Prisma.GroupePolitiqueWhereInput =
      chambre === 'senat'
        ? { chambre: 'senat' }
        : chambre === 'assemblee'
          ? { chambre: 'assemblee', legislature: legislatureAN }
          : {
              OR: [
                { chambre: 'senat' },
                { chambre: 'assemblee', legislature: legislatureAN },
              ],
            };

    const groupes = await this.prisma.groupePolitique.findMany({
      where: { actif: true, ...periode },
      include: {
        _count: { select: { mandatsParlementaires: true } },
      },
      orderBy: { ordre: 'asc' },
    });

    // Effectif Sénat borné à la période (le `_count` global cumulerait toutes les
    // époques). L'AN reste sur son `_count` (ligne déjà propre à sa législature).
    const senatIds = groupes.filter((g) => g.chambre === 'senat').map((g) => g.id);
    const senatCounts = new Map<string, number>();
    if (senatIds.length > 0) {
      const base: Prisma.MandatParlementaireWhereInput = { groupeId: { in: senatIds } };
      let where: Prisma.MandatParlementaireWhereInput;
      if (senatWhereSession) {
        const y = parseInt(senatWhereSession, 10);
        const debut = new Date(Date.UTC(y, 9, 1));
        const fin = new Date(Date.UTC(y + 1, 8, 30, 23, 59, 59));
        where = { ...base, dateDebut: { lte: fin }, OR: [{ dateFin: null }, { dateFin: { gte: debut } }] };
      } else {
        where = { ...base, dateFin: null };
      }
      const counts = await this.prisma.mandatParlementaire.groupBy({
        by: ['groupeId'],
        where,
        _count: { _all: true },
      });
      for (const c of counts) if (c.groupeId) senatCounts.set(c.groupeId, c._count._all);
    }

    const result = groupes.map((g) => ({
      ...g,
      membresCount:
        g.chambre === 'senat' ? senatCounts.get(g.id) ?? 0 : g._count.mandatsParlementaires,
      _count: undefined,
    }));

    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // LÉGISLATURES DISPONIBLES (pour le sélecteur de période côté front)
  // Data-driven : ne renvoie que les législatures effectivement présentes en
  // base (mandats_parlementaires). En prod, seule la courante existe tant que
  // l'historique 15e/16e n'a pas été ingéré → le front masque le sélecteur.
  // ===========================================================================
  async getLegislatures(chambre?: Chambre) {
    const cacheKey = `legislatures:${chambre || 'all'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const grouped = await this.prisma.mandatParlementaire.groupBy({
      by: ['legislature'],
      where: {
        legislature: { not: null },
        ...(chambre && { chambre }),
      },
      _count: { _all: true },
      orderBy: { legislature: 'desc' },
    });

    const result = grouped.map((g) => ({
      legislature: g.legislature as number,
      count: g._count._all,
    }));

    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, JSON.stringify(result));

    return result;
  }

  /**
   * Le tri « carrière » a-t-il un sens dans cette chambre ? Il ne diffère du tri
   * « mandat en cours » que s'il existe un élu EN FONCTION dont la carrière dépasse
   * le mandat courant, c.-à-d. réélu (≥ 2 mandats dans SA chambre — la carrière est
   * agrégée par chambre, cf. stats-calculator). Sans réélu, les colonnes
   * `stats_carriere_*` et `stats_*` sont identiques et le sélecteur ne départagerait
   * rien : on le masque, exactement comme le sélecteur de législature côté AN.
   *
   * Data-driven : dès que l'historique (anciens mandats) est ingéré, le sélecteur
   * apparaît de lui-même. `m.chambre = p.chambre` gère aussi le cas « toutes chambres »
   * (chambre indéfinie) sans compter un mandat d'AN comme un réélu du Sénat.
   */
  async hasCarriereHistorique(chambre?: Chambre): Promise<boolean> {
    const cacheKey = `carriere-historique:${chambre ?? 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return cached === '1';

    const rows = await this.prisma.$queryRaw<{ present: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM parlementaires p
        WHERE p.actif = true
          ${chambre ? Prisma.sql`AND p.chambre = ${chambre}` : Prisma.empty}
          AND (
            SELECT COUNT(*) FROM mandats_parlementaires m
            WHERE m.personne_id = p.id AND m.chambre = p.chambre
          ) > 1
      ) AS present
    `;
    const present = rows[0]?.present ?? false;
    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, present ? '1' : '0');
    return present;
  }

  // ===========================================================================
  // SESSIONS SÉNAT DISPONIBLES (pour le sélecteur de période côté front)
  //
  // Data-driven, et volontairement CONSERVATEUR : on n'expose qu'une session dont
  // la couverture en mandats est plausible (≥ SENAT_COUVERTURE_MIN). Aujourd'hui,
  // les mandats de la série 1 démarrent au 01/10/2023 (leur mandat 2017-2023 n'est
  // pas en base) : toute session antérieure ne contiendrait que la série 2, soit
  // ~179/348 sénateurs. Mieux vaut ne pas offrir la session que mentir sur la
  // composition de la chambre.
  //
  // Le jour où l'historique sénatorial est ingéré, les sessions correspondantes
  // apparaissent d'elles-mêmes — aucun code à changer.
  //
  // Perf : la table des mandats Sénat fait quelques centaines de lignes → on charge
  // les intervalles une fois et on compte en mémoire, puis on cache (une session ne
  // change qu'une fois par an).
  // ===========================================================================
  async getSessionsSenat() {
    const cacheKey = 'sessions:senat';

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const mandats = await this.prisma.mandatParlementaire.findMany({
      where: { chambre: 'senat' },
      select: { dateDebut: true, dateFin: true },
    });

    const result: Array<{ session: string; count: number }> = [];

    if (mandats.length > 0) {
      const now = new Date();
      const premiereAnnee = Math.min(...mandats.map((m) => m.dateDebut.getUTCFullYear()));

      for (let annee = premiereAnnee; annee <= now.getUTCFullYear(); annee++) {
        const w = sessionWindow(annee);
        if (w.debut > now) continue; // session pas encore ouverte

        const count = mandats.filter(
          (m) => m.dateDebut <= w.fin && (m.dateFin === null || m.dateFin >= w.debut),
        ).length;

        if (count >= SENAT_COUVERTURE_MIN) {
          // Non cappé : `count` est le nombre de mandats chevauchant la session,
          // qui dépasse légitimement 348 dès qu'il y a eu démission + remplacement.
          result.push({ session: w.label, count });
        }
      }
      result.reverse(); // la plus récente d'abord
    }

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
    include: Prisma.ParlementaireInclude,
  ) {
    const candidates = await this.getFuzzyCandidates({
      chambre: filters.chambre,
      groupe: filters.groupe,
      departement: filters.departement,
      actif: filters.actif,
    });

    const fuzzyResults = fuzzySearchCandidates(search, candidates);

    if (fuzzyResults.length === 0) {
      return { parlementaires: [], total: 0 };
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
      // Les votes sont cachés par combinaison de filtres : il faut balayer, un
      // `del` sur un motif ne supprimerait rien (Redis ne développe pas le `*`).
      await this.deleteByPattern(`parlementaire:votes:${parlementaireId}:*`);
    }
    const keys = await this.redis.keys('parlementaires:list:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Supprime toutes les clés d'un motif. `scan` plutôt que `keys` : le cache des
   * votes compte une entrée par (parlementaire × filtres × page), et `keys`
   * bloque Redis le temps du parcours complet de l'espace de clés.
   */
  private async deleteByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}
