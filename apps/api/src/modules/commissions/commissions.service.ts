import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { CommissionQuery, CommissionReunionsQuery, CommissionDossiersQuery } from './commissions.schema';

export class CommissionsService {
  // Commissions data is very stable (synced daily, rarely changes)
  private readonly CACHE_TTL = 43200; // 12 hours
  private readonly CACHE_TTL_SHORT = 3600; // 1 hour (for reunion-dependent data)

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
  ) {}

  async getCommissions(query: CommissionQuery) {
    const cacheKey = `commissions:list:${JSON.stringify(query)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const where: Record<string, unknown> = {};
    if (query.chambre) where.chambre = query.chambre;
    if (query.type) where.type = query.type;
    if (query.actif) where.actif = query.actif === 'true';

    const [commissions, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          _count: {
            select: {
              reunions: true,
              mandats: { where: { dateFin: null } },
            },
          },
        },
      }),
      this.prisma.commission.count({ where }),
    ]);

    const result = {
      data: commissions.map((c) => ({
        id: c.id,
        uid: c.uid,
        slug: c.slug,
        chambre: c.chambre,
        type: c.type,
        nom: c.nom,
        nomCourt: c.nomCourt,
        dateDebut: c.dateDebut,
        dateFin: c.dateFin,
        actif: c.actif,
        nbMembres: c._count.mandats,
        nbReunions: c._count.reunions,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    return result;
  }

  async getCommissionBySlug(slug: string) {
    const cacheKey = `commissions:detail:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const commission = await this.prisma.commission.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            reunions: true,
            dossierCommissions: true,
          },
        },
      },
    });

    if (!commission) return null;

    // Membres actuels (mandats actifs uniquement)
    const mandats = await this.prisma.mandat.findMany({
      where: { commissionId: commission.id, dateFin: null },
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
      orderBy: [{ qualite: 'asc' }, { parlementaire: { nom: 'asc' } }],
    });

    // Prochaines reunions
    const prochainesReunions = await this.prisma.reunion.findMany({
      where: {
        commissionId: commission.id,
        dateDebut: { gte: new Date() },
        etat: { not: 'annule' },
      },
      orderBy: { dateDebut: 'asc' },
      take: 5,
      select: {
        id: true,
        uid: true,
        dateDebut: true,
        dateFin: true,
        lieu: true,
        odjResume: true,
        etat: true,
        captationVideo: true,
        urlVideo: true,
        compteRenduRef: true,
      },
    });

    const result = {
      id: commission.id,
      uid: commission.uid,
      slug: commission.slug,
      chambre: commission.chambre,
      type: commission.type,
      nom: commission.nom,
      nomCourt: commission.nomCourt,
      dateDebut: commission.dateDebut,
      dateFin: commission.dateFin,
      actif: commission.actif,
      nbMembres: mandats.length,
      nbReunions: commission._count.reunions,
      nbDossiers: commission._count.dossierCommissions,
      membres: mandats.map((m) => ({
        qualite: m.qualite,
        parlementaire: m.parlementaire,
      })),
      prochainesReunions,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL_SHORT, JSON.stringify(result));
    return result;
  }

  async getCommissionReunions(slug: string, query: CommissionReunionsQuery) {
    const commission = await this.prisma.commission.findUnique({
      where: { slug },
    });
    if (!commission) return null;

    const cacheKey = `commissions:reunions:${slug}:${JSON.stringify(query)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const where: Record<string, unknown> = { commissionId: commission.id };
    if (query.passees === 'true') {
      where.dateDebut = { lt: new Date() };
    } else if (query.passees === 'false') {
      where.dateDebut = { gte: new Date() };
      where.etat = { not: 'annule' };
    }

    const [reunions, total] = await Promise.all([
      this.prisma.reunion.findMany({
        where,
        orderBy: { dateDebut: query.passees === 'true' ? 'desc' : 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.reunion.count({ where }),
    ]);

    const result = {
      data: reunions.map((r) => ({
        ...r,
        nbParticipants: r._count.participants,
        _count: undefined,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL_SHORT, JSON.stringify(result));
    return result;
  }

  async getDossiersByCommission(slug: string, query: CommissionDossiersQuery) {
    const commission = await this.prisma.commission.findUnique({ where: { slug } });
    if (!commission) return null;

    const cacheKey = `commissions:dossiers:${slug}:${JSON.stringify(query)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const where: Record<string, unknown> = { commissionId: commission.id };
    if (query.role) where.role = query.role;
    if (query.etat) where.dossier = { etat: query.etat };

    const [items, total] = await Promise.all([
      this.prisma.dossierCommission.findMany({
        where,
        include: {
          dossier: {
            select: {
              uid: true,
              titre: true,
              titreCourt: true,
              etat: true,
              dateDepot: true,
              urlAN: true,
              urlSenat: true,
              procedureLibelle: true,
            },
          },
        },
        orderBy: { dossier: { dateDepot: 'desc' } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.dossierCommission.count({ where }),
    ]);

    const result = {
      data: items.map((dc) => ({
        uid: dc.dossier.uid,
        titre: dc.dossier.titre,
        titreCourt: dc.dossier.titreCourt,
        etat: dc.dossier.etat,
        dateDepot: dc.dossier.dateDepot,
        urlAN: dc.dossier.urlAN,
        urlSenat: dc.dossier.urlSenat,
        procedureLibelle: dc.dossier.procedureLibelle,
        role: dc.role,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    return result;
  }
}
