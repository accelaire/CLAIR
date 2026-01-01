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

export class ParlementairesService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_TTL_LONG = 3600; // 1 heure

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
      ...(search && {
        OR: [
          { nom: { contains: search, mode: 'insensitive' } },
          { prenom: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderByMap: Record<string, Prisma.ParlementaireOrderByWithRelationInput> = {
      nom: { nom: order },
      prenom: { prenom: order },
    };

    const orderBy = orderByMap[sort] || { nom: order };

    const [parlementaires, total] = await Promise.all([
      this.prisma.parlementaire.findMany({
        where,
        include: {
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
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.parlementaire.count({ where }),
    ]);

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
            orderBy: { scrutin: { date: 'desc' } },
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
  // STATISTIQUES
  // ===========================================================================

  async getParlementaireStats(parlementaireId: string, chambre: Chambre): Promise<ParlementaireStats> {
    const cacheKey = `parlementaire:stats:${parlementaireId}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const oldestScrutin = await this.prisma.scrutin.findFirst({
      where: { chambre },
      orderBy: { date: 'asc' },
      select: { date: true },
    });
    const since = oldestScrutin?.date || new Date();

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

    const stats: ParlementaireStats = {
      presence,
      loyaute,
      participation: votesCount,
      interventions: interventionsCount,
      amendements: amendementsStats,
      questions: questionsCount,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, JSON.stringify(stats));

    return stats;
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
    const parlementaire = await this.prisma.parlementaire.findUnique({
      where: { id: parlementaireId },
      select: { groupeId: true },
    });

    if (!parlementaire?.groupeId) return 0;

    const votes = await this.prisma.vote.findMany({
      where: {
        parlementaireId,
        position: { not: 'absent' },
        scrutin: { chambre, date: { gte: since } },
      },
      include: {
        scrutin: {
          include: {
            votes: {
              where: {
                parlementaire: { groupeId: parlementaire.groupeId },
                position: { not: 'absent' },
              },
            },
          },
        },
      },
    });

    if (votes.length === 0) return 0;

    let loyalVotes = 0;

    for (const vote of votes) {
      const groupVotes = vote.scrutin.votes;
      const positions = { pour: 0, contre: 0, abstention: 0 };

      for (const gv of groupVotes) {
        if (gv.position in positions) {
          positions[gv.position as keyof typeof positions]++;
        }
      }

      const sortedPositions = Object.entries(positions).sort((a, b) => b[1] - a[1]);
      const majorityPosition = sortedPositions[0]?.[0];

      if (majorityPosition && vote.position === majorityPosition) {
        loyalVotes++;
      }
    }

    return Math.round((loyalVotes / votes.length) * 100);
  }

  private async getAmendementsStats(parlementaireId: string) {
    const [proposes, adoptes] = await Promise.all([
      this.prisma.amendement.count({
        where: { parlementaireId },
      }),
      this.prisma.amendement.count({
        where: {
          parlementaireId,
          sort: 'adopte',
        },
      }),
    ]);

    return { proposes, adoptes };
  }

  // ===========================================================================
  // VOTES D'UN PARLEMENTAIRE
  // ===========================================================================

  async getParlementaireVotes(parlementaireId: string, query: ParlementaireVotesQuery) {
    const { page, limit, position, tag, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.VoteWhereInput = {
      parlementaireId,
      ...(position && { position }),
      scrutin: {
        ...(tag && { tags: { has: tag } }),
        ...(dateFrom && { date: { gte: dateFrom } }),
        ...(dateTo && { date: { lte: dateTo } }),
      },
    };

    const [votes, total] = await Promise.all([
      this.prisma.vote.findMany({
        where,
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
              nombrePour: true,
              nombreContre: true,
              nombreAbstention: true,
            },
          },
        },
        orderBy: { scrutin: { date: 'desc' } },
        skip,
        take: limit,
      }),
      this.prisma.vote.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: votes,
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
  // COMPARAISON DE PARLEMENTAIRES
  // ===========================================================================

  async compareParlementaires(slugs: string[]) {
    const parlementaires = await Promise.all(
      slugs.map((slug) => this.getParlementaireBySlug(slug, ['stats']))
    );

    return parlementaires.filter(Boolean);
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
