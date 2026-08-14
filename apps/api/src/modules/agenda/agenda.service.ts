import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { AgendaQuery, ProchainesEcheancesQuery } from './agenda.schema';

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

    // `type` arbitre les deux collections : 'evenement' ne renvoie QUE les repères
    // institutionnels (on évite alors la requête réunions), 'commission'/'seance'
    // ne renvoient que des réunions, 'tous' les deux.
    const wantsReunions = query.type !== 'evenement';
    const wantsEvenements = query.type === 'tous' || query.type === 'evenement';

    const where: Record<string, unknown> = {
      dateDebut: { gte: query.dateFrom, lte: dateTo },
      etat: { not: 'supprime' },
    };

    if (query.type !== 'tous' && query.type !== 'evenement') where.type = query.type;
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

    const reunionInclude = {
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
    } as const;

    const [reunions, total, evenements] = await Promise.all([
      wantsReunions
        ? this.prisma.reunion.findMany({
          where,
          orderBy: { dateDebut: 'asc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: reunionInclude,
        })
        : Promise.resolve([]),
      wantsReunions ? this.prisma.reunion.count({ where }) : Promise.resolve(0),
      wantsEvenements
        ? this.getEvenementsSurPeriode(query.dateFrom, dateTo, query.chambre)
        : Promise.resolve([]),
    ]);

    const scrutinSelect = {
      id: true,
      numero: true,
      titre: true,
      sort: true,
      chambre: true,
      nombrePour: true,
      nombreContre: true,
      nombreAbstention: true,
      seanceRef: true,
      date: true,
      session: true,
      dossier: {
        select: { id: true, uid: true, titre: true, titreCourt: true, procedureLibelle: true },
      },
    } as const;

    const reunionUids = reunions.map((r) => r.uid).filter(Boolean) as string[];
    const scrutins = reunionUids.length > 0
      ? await this.prisma.scrutin.findMany({
          where: { seanceRef: { in: reunionUids } },
          select: scrutinSelect,
          orderBy: { numero: 'asc' },
        })
      : [];

    const scrutinsByReunionUid: Record<string, typeof scrutins> = {};
    for (const s of scrutins) {
      if (!s.seanceRef) continue;
      if (!scrutinsByReunionUid[s.seanceRef]) scrutinsByReunionUid[s.seanceRef] = [];
      scrutinsByReunionUid[s.seanceRef]!.push(s);
    }

    // Sénat scrutins have no seanceRef — match by date for séance reunions
    const senatSeances = reunions.filter(
      (r) => r.type === 'seance' && r.commission?.chambre === 'senat' && !scrutinsByReunionUid[r.uid],
    );
    if (senatSeances.length > 0) {
      const dateRanges = senatSeances.map((r) => {
        const d = new Date(r.dateDebut);
        const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const end = new Date(start.getTime() + 86_400_000);
        return { date: { gte: start, lt: end } };
      });

      const senatScrutins = await this.prisma.scrutin.findMany({
        where: {
          chambre: 'senat',
          OR: dateRanges,
        },
        select: scrutinSelect,
        orderBy: { numero: 'asc' },
      });

      const dateToReunionUid = new Map<string, string>();
      for (const r of senatSeances) {
        const dayKey = r.dateDebut.toISOString().split('T')[0]!;
        dateToReunionUid.set(dayKey, r.uid);
      }

      for (const s of senatScrutins) {
        const dayKey = s.date.toISOString().split('T')[0]!;
        const reunionUid = dateToReunionUid.get(dayKey);
        if (!reunionUid) continue;
        if (!scrutinsByReunionUid[reunionUid]) scrutinsByReunionUid[reunionUid] = [];
        scrutinsByReunionUid[reunionUid]!.push(s);
      }
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
        scrutins: scrutinsByReunionUid[r.uid] || [],
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
      // Hors `byDay` volontairement : un événement peut couvrir une PÉRIODE
      // (suspension de travaux) et n'appartient donc pas à un jour unique.
      // Le client décide de le rendre en pastille ou en bandeau.
      evenements,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
    return result;
  }

  /**
   * Événements institutionnels chevauchant la fenêtre.
   *
   * Deux cas distincts, d'où le OR : un événement ponctuel (`dateFin` null) doit
   * simplement tomber dans la fenêtre ; un événement de période la chevauche dès
   * lors qu'il commence avant la fin et finit après le début. Un filtre naïf sur
   * `dateDebut` seul ferait disparaître une suspension estivale quand on consulte
   * le mois de septembre, alors qu'elle le couvre entièrement.
   *
   * `chambre` null = concerne les deux, donc toujours retenu.
   */
  private async getEvenementsSurPeriode(
    dateFrom: Date,
    dateTo: Date,
    chambre?: 'assemblee' | 'senat',
  ) {
    const chevauchement: Prisma.EvenementInstitutionnelWhereInput = {
      OR: [
        { dateFin: null, dateDebut: { gte: dateFrom, lte: dateTo } },
        { dateFin: { not: null, gte: dateFrom }, dateDebut: { lte: dateTo } },
      ],
    };

    // Une chambre demandée conserve aussi les événements transverses (chambre
    // null) : une élection présidentielle ou une suspension concerne tout le monde.
    const where: Prisma.EvenementInstitutionnelWhereInput = chambre
      ? { AND: [chevauchement, { OR: [{ chambre }, { chambre: null }] }] }
      : chevauchement;

    return this.prisma.evenementInstitutionnel.findMany({
      where,
      orderBy: [{ dateDebut: 'asc' }, { titre: 'asc' }],
      select: {
        id: true,
        slug: true,
        type: true,
        titre: true,
        description: true,
        dateDebut: true,
        dateFin: true,
        datePrecise: true,
        chambre: true,
        sources: true,
        important: true,
      },
    });
  }

  /**
   * Prochaines échéances à partir d'aujourd'hui (bloc d'accueil, page dédiée).
   * Une période en cours reste « à venir » tant qu'elle n'est pas terminée.
   */
  async getProchainesEcheances(query: ProchainesEcheancesQuery) {
    const now = new Date();
    const aujourdhui = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ));

    // Le jour fait partie de la clé : sans lui, l'entrée écrite la veille
    // continuerait de servir une échéance déjà passée jusqu'à expiration du TTL.
    const jour = aujourdhui.toISOString().split('T')[0];
    const cacheKey = `agenda:echeances:${jour}:${query.limit}:${query.importantOnly}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const evenements = await this.prisma.evenementInstitutionnel.findMany({
      where: {
        OR: [
          { dateFin: null, dateDebut: { gte: aujourdhui } },
          { dateFin: { gte: aujourdhui } },
        ],
        ...(query.importantOnly ? { important: true } : {}),
      },
      orderBy: [{ dateDebut: 'asc' }, { titre: 'asc' }],
      take: query.limit,
      select: {
        id: true,
        slug: true,
        type: true,
        titre: true,
        description: true,
        dateDebut: true,
        dateFin: true,
        datePrecise: true,
        chambre: true,
        sources: true,
        important: true,
      },
    });

    const result = { data: evenements };
    // TTL court : la liste bascule d'un jour à l'autre quand une échéance passe.
    await this.redis.setex(cacheKey, 3600, JSON.stringify(result));
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
