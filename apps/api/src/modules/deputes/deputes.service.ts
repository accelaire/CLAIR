// =============================================================================
// Module Députés - Service métier
// =============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import {
  DeputesListQuery,
  DeputeVotesQuery,
  DeputeStats,
  PaginationMeta,
} from './deputes.schema';

export class DeputesService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_TTL_LONG = 3600; // 1 heure

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  // ===========================================================================
  // LISTE DES DÉPUTÉS
  // ===========================================================================

  async getDeputes(query: DeputesListQuery) {
    const cacheKey = `deputes:list:${JSON.stringify(query)}`;

    // Vérifier le cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const { page, limit, groupe, departement, search, actif, sort, order } = query;
    const skip = (page - 1) * limit;

    // Construction du where clause - Filter for deputies only (chambre: 'AN')
    const where: Prisma.ParlementaireWhereInput = {
      chambre: 'AN', // Only deputies (Assemblée Nationale)
      actif,
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

    // Mapping des champs de tri
    const orderByMap: Record<string, Prisma.ParlementaireOrderByWithRelationInput> = {
      nom: { nom: order },
      prenom: { prenom: order },
      // Pour presence et loyaute, on trie côté application après récupération
    };

    const orderBy = orderByMap[sort] || { nom: order };

    const [deputes, total] = await Promise.all([
      this.prisma.parlementaire.findMany({
        where,
        include: {
          groupe: {
            select: {
              id: true,
              slug: true,
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
      data: deputes.map((d) => ({
        ...d,
        _count: undefined,
        votesCount: d._count.votes,
        interventionsCount: d._count.interventions,
        amendementsCount: d._count.amendements,
      })),
      meta,
    };

    // Mettre en cache
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // DÉTAIL D'UN DÉPUTÉ
  // ===========================================================================

  async getDeputeBySlug(slug: string, include?: string[]) {
    const cacheKey = `depute:${slug}:${include?.sort().join(',') || 'base'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const depute = await this.prisma.parlementaire.findUnique({
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

    if (!depute) return null;

    // Ajouter les stats si demandées
    let stats: DeputeStats | undefined;
    if (include?.includes('stats')) {
      stats = await this.getDeputeStats(depute.id);
    }

    const result = { ...depute, stats };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    return result;
  }

  async getDeputeById(id: string) {
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

  async getDeputeStats(deputeId: string): Promise<DeputeStats> {
    const cacheKey = `depute:stats:${deputeId}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Utiliser la date du premier scrutin comme limite (pour les données historiques)
    const oldestScrutin = await this.prisma.scrutin.findFirst({
      orderBy: { date: 'asc' },
      select: { date: true },
    });
    const since = oldestScrutin?.date || new Date();

    const [presence, loyaute, votesCount, interventionsCount, amendementsStats, questionsCount] =
      await Promise.all([
        this.calculatePresence(deputeId, since),
        this.calculateLoyaute(deputeId, since),
        this.prisma.vote.count({
          where: {
            parlementaireId: deputeId,
            position: { not: 'absent' },
          },
        }),
        this.prisma.intervention.count({
          where: {
            parlementaireId: deputeId,
          },
        }),
        this.getAmendementsStats(deputeId),
        this.prisma.intervention.count({
          where: {
            parlementaireId: deputeId,
            type: 'question',
          },
        }),
      ]);

    const stats: DeputeStats = {
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

  private async calculatePresence(parlementaireId: string, since: Date): Promise<number> {
    const [totalScrutins, participations] = await Promise.all([
      this.prisma.scrutin.count({
        where: { date: { gte: since } },
      }),
      this.prisma.vote.count({
        where: {
          parlementaireId,
          position: { not: 'absent' },
          scrutin: { date: { gte: since } },
        },
      }),
    ]);

    return totalScrutins > 0 ? Math.round((participations / totalScrutins) * 100) : 0;
  }

  private async calculateLoyaute(parlementaireId: string, since: Date): Promise<number> {
    // Récupérer le groupe du parlementaire
    const parlementaire = await this.prisma.parlementaire.findUnique({
      where: { id: parlementaireId },
      select: { groupeId: true },
    });

    if (!parlementaire?.groupeId) return 0;

    // Récupérer tous les votes du parlementaire et de son groupe
    const votes = await this.prisma.vote.findMany({
      where: {
        parlementaireId,
        position: { not: 'absent' },
        scrutin: { date: { gte: since } },
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
      // Calculer la position majoritaire du groupe
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
  // VOTES D'UN DÉPUTÉ
  // ===========================================================================

  async getDeputeVotes(parlementaireId: string, query: DeputeVotesQuery) {
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
  // COMPARAISON DE DÉPUTÉS
  // ===========================================================================

  async compareDeputes(slugs: string[]) {
    const deputes = await Promise.all(
      slugs.map((slug) => this.getDeputeBySlug(slug, ['stats']))
    );

    return deputes.filter(Boolean);
  }

  // ===========================================================================
  // GROUPES POLITIQUES
  // ===========================================================================

  async getGroupes() {
    const cacheKey = 'groupes:all';

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupes = await this.prisma.groupePolitique.findMany({
      where: { actif: true },
      include: {
        _count: { select: { parlementaires: { where: { actif: true, chambre: 'AN' } } } },
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
        await this.redis.del(`depute:${parlementaire.slug}:*`);
        await this.redis.del(`depute:stats:${parlementaireId}`);
      }
    }
    // Invalider les listes
    const keys = await this.redis.keys('deputes:list:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
