import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { AgendaQuery } from './agenda.schema';

export class AgendaService {
  // Agenda data changes daily (reunions added/modified)
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
  ) {}

  async getAgenda(query: AgendaQuery) {
    const dateTo = query.dateTo || new Date(
      query.dateFrom.getFullYear(),
      query.dateFrom.getMonth() + 1,
      0, 23, 59, 59,
    );

    const cacheKey = `agenda:${query.dateFrom.toISOString()}:${dateTo.toISOString()}:${query.type}:${query.chambre || ''}:${query.commissionId || ''}:${query.page}:${query.limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const where: Record<string, unknown> = {
      dateDebut: { gte: query.dateFrom, lte: dateTo },
      etat: { not: 'supprime' },
    };

    if (query.type !== 'tous') where.type = query.type;
    if (query.commissionId) where.commissionId = query.commissionId;
    if (query.chambre) {
      const existingConditions = { ...where };
      Object.keys(where).forEach((k) => delete where[k]);

      const chambreOr: unknown[] = [
        { commission: { chambre: query.chambre } },
      ];
      if (query.chambre === 'assemblee') {
        chambreOr.push({ commissionId: null, compteRenduRef: { startsWith: 'CRSA' } });
      } else {
        chambreOr.push({ commissionId: null, compteRenduRef: { startsWith: 'CRSS' } });
      }

      where.AND = [existingConditions, { OR: chambreOr }];
    }

    const [reunions, total] = await Promise.all([
      this.prisma.reunion.findMany({
        where,
        orderBy: { dateDebut: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          commission: {
            select: {
              id: true,
              slug: true,
              nom: true,
              nomCourt: true,
              chambre: true,
              type: true,
              organeRef: true,
            },
          },
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.reunion.count({ where }),
    ]);

    const reunionUids = reunions.map((r) => r.uid).filter(Boolean) as string[];
    const scrutins = reunionUids.length > 0
      ? await this.prisma.scrutin.findMany({
          where: { seanceRef: { in: reunionUids } },
          select: {
            id: true,
            numero: true,
            titre: true,
            sort: true,
            chambre: true,
            nombrePour: true,
            nombreContre: true,
            nombreAbstention: true,
            seanceRef: true,
            dossier: {
              select: { id: true, uid: true, titre: true, titreCourt: true },
            },
          },
          orderBy: { numero: 'asc' },
        })
      : [];

    const scrutinsBySeanceRef: Record<string, typeof scrutins> = {};
    for (const s of scrutins) {
      if (!s.seanceRef) continue;
      if (!scrutinsBySeanceRef[s.seanceRef]) scrutinsBySeanceRef[s.seanceRef] = [];
      scrutinsBySeanceRef[s.seanceRef]!.push(s);
    }

    // Group by day
    const byDay: Record<string, unknown[]> = {};
    for (const r of reunions) {
      const dayKey = r.dateDebut.toISOString().split('T')[0]!;
      if (!byDay[dayKey]) byDay[dayKey] = [];
      byDay[dayKey].push({
        id: r.id,
        uid: r.uid,
        type: r.type,
        dateDebut: r.dateDebut,
        dateFin: r.dateFin,
        lieu: r.lieu,
        etat: r.etat,
        odjResume: r.odjResume,
        captationVideo: r.captationVideo,
        compteRenduRef: r.compteRenduRef,
        urlVideo: r.urlVideo,
        commission: r.commission,
        nbParticipants: r._count.participants,
        scrutins: scrutinsBySeanceRef[r.uid] || [],
      });
    }

    const result = {
      dateFrom: query.dateFrom,
      dateTo,
      total,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
      byDay,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async getReunionByUid(uid: string) {
    const cacheKey = `agenda:reunion:${uid}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const reunion = await this.prisma.reunion.findUnique({
      where: { uid },
      include: {
        commission: {
          select: {
            id: true,
            slug: true,
            nom: true,
            nomCourt: true,
            chambre: true,
            type: true,
          },
        },
        participants: {
          include: {
            parlementaire: {
              select: {
                id: true,
                slug: true,
                nom: true,
                prenom: true,
                photoUrl: true,
                chambre: true,
                groupe: {
                  select: { nom: true, couleur: true, slug: true },
                },
              },
            },
          },
          orderBy: { parlementaire: { nom: 'asc' } },
        },
      },
    });

    if (reunion) {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(reunion));
    }

    return reunion;
  }
}
