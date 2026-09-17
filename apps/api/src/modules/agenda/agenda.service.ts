import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { AgendaQuery, ProchainesEcheancesQuery, DebatDeReunionQuery } from './agenda.schema';


/**
 * Où sont rangées les prises de parole d'une réunion.
 *
 * DEUX RATTACHEMENTS, POUR UNE RAISON HISTORIQUE. Les prises de commission
 * portent une clé étrangère vers leur réunion (`reunionId`), posée par
 * l'ingestion des comptes rendus. Celles de séance publique, elles, ne portent
 * que le `seanceId` du compte rendu — le même texte que l'`uid` de la réunion,
 * mais sans contrainte, parce que les deux sources n'ont jamais été reliées.
 *
 * Conséquence visible avant ce correctif : la page d'une séance affichait zéro
 * prise de parole alors que la séance du 21 juillet en porte 414.
 */
function ouSontLesPrises(reunion: { id: string; uid: string; type: string }) {
  return reunion.type === 'seance'
    ? { seanceId: reunion.uid }
    : { reunionId: reunion.id };
}

/** Ce qu'il faut d'une prise de parole pour dérouler un débat. */
const PRISE_DE_PAROLE_SELECT = {
  id: true,
  type: true,
  contenu: true,
  date: true,
  ordre: true,
  sourceUrl: true,
  orateurNom: true,
  orateurPrenom: true,
  orateurQualite: true,
  // Le compte rendu de commission annonce souvent le groupe de l'orateur
  // (« M. Untel (LFI-NFP) ») là où celui de la séance ne le fait pas : c'est
  // parfois le seul moyen de situer une personne auditionnée.
  orateurGroupe: true,
  estPresidence: true,
  articleVise: true,
  amendementsVises: true,
  texteNumero: true,
  dossier: { select: { uid: true, titre: true } },
  parlementaire: {
    select: {
      id: true,
      slug: true,
      nom: true,
      prenom: true,
      photoUrl: true,
      chambre: true,
      groupe: { select: { nom: true, couleur: true } },
    },
  },
} as const;

/** Longueur d'aperçu d'une prise de parole, comme sur les scrutins et les fiches. */
const CONTENU_PREVIEW_LENGTH = 500;

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

  /**
   * Une séance que seules ses prises de parole attestent.
   *
   * POURQUOI ELLE EXISTE. L'agenda ne remonte qu'au 7 mai 2024 : les séances
   * des 15e et 16e législatures n'ont donc aucune réunion en base — 926
   * séances et 328 187 prises de parole. Et au Sénat, l'identifiant de séance
   * est un JOUR (`d20240116`) alors qu'un jour compte deux à cinq séances :
   * aucun rattachement un pour un n'est possible, ni maintenant ni plus tard.
   *
   * Exiger une réunion privait donc 1 203 séances et 419 204 prises de parole
   * de toute page. On sert ce que la séance atteste d'elle-même : sa date, sa
   * chambre, son débat et ses votes. Il lui manquera le lieu et l'ordre du
   * jour, qu'elle n'a de toute façon jamais eus.
   */
  private async getSeanceSansReunion(uid: string) {
    const [agregat, scrutins] = await Promise.all([
      this.prisma.intervention.aggregate({
        where: { seanceId: uid },
        _min: { date: true },
        _count: { _all: true },
      }),
      this.prisma.scrutin.findMany({
        where: { seanceRef: uid },
        select: {
          id: true, numero: true, titre: true, date: true, sort: true,
          chambre: true, session: true,
          nombrePour: true, nombreContre: true, nombreAbstention: true,
        },
        orderBy: { numero: 'asc' },
      }),
    ]);

    if (agregat._count._all === 0 || !agregat._min.date) return null;

    const premiere = await this.prisma.intervention.findFirst({
      where: { seanceId: uid },
      select: { chambre: true },
    });

    return {
      id: uid,
      uid,
      type: 'seance' as const,
      dateDebut: agregat._min.date,
      dateFin: null,
      lieu: null,
      etat: null,
      odjResume: null,
      odjComplet: null,
      captationVideo: false,
      urlVideo: null,
      compteRenduRef: null,
      // La chambre est tout ce qu'on sait de son rattachement : pas de
      // commission, donc pas de fil d'Ariane vers l'une d'elles.
      commission: premiere
        ? { id: '', slug: '', nom: '', nomCourt: null, chambre: premiere.chambre, type: 'hemicycle' }
        : null,
      participants: [],
      avisCommission: [],
      nbInterventions: agregat._count._all,
      scrutins,
    };
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
        // Le tableau des avis, quand la réunion en a rendu un.
        avisCommission: {
          select: {
            id: true,
            numero: true,
            position: true,
            sens: true,
            place: true,
            auteur: true,
            groupe: true,
            ordre: true,
            amendement: {
              select: { id: true, numero: true, sort: true, dossierId: true },
            },
          },
          orderBy: { ordre: 'asc' },
        },
      },
    });

    if (!reunion) {
      const seance = await this.getSeanceSansReunion(uid);
      if (seance) await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(seance));
      return seance;
    }

    const [nbInterventions, scrutins] = await Promise.all([
      this.prisma.intervention.count({ where: ouSontLesPrises(reunion) }),
      // Les votes de la séance, dans l'ordre où ils ont été appelés. Une séance
      // en compte huit en moyenne et jusqu'à 83 ; les commissions n'en ont pas.
      reunion.type === 'seance'
        ? this.prisma.scrutin.findMany({
            where: { seanceRef: reunion.uid },
            select: {
              id: true, numero: true, titre: true, date: true, sort: true,
              chambre: true, session: true,
              nombrePour: true, nombreContre: true, nombreAbstention: true,
            },
            orderBy: { numero: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    const detail = { ...reunion, nbInterventions, scrutins };
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(detail));
    return detail;
  }

  /**
   * Le débat d'une réunion, page par page, dans l'ordre où il s'est tenu.
   *
   * Chaque prise porte les votes qu'elle a précédés : c'est ce qui permet de
   * dérouler une séance en replaçant les scrutins à l'endroit où ils sont
   * tombés, plutôt que de les empiler en pied de page.
   */
  async getDebatDeReunion(uid: string, query: DebatDeReunionQuery) {
    const reunion = await this.prisma.reunion.findUnique({
      where: { uid },
      select: { id: true, uid: true, type: true },
    });

    // Sans réunion, l'uid demandé peut encore être celui d'une séance que ses
    // seules prises de parole attestent — voir `getSeanceSansReunion`.
    const where = reunion ? ouSontLesPrises(reunion) : { seanceId: uid };
    const [total, lignes] = await Promise.all([
      this.prisma.intervention.count({ where }),
      this.prisma.intervention.findMany({
        where,
        select: PRISE_DE_PAROLE_SELECT,
        orderBy: { ordre: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const liens = lignes.length
      ? await this.prisma.interventionScrutin.findMany({
          where: { interventionId: { in: lignes.map((l) => l.id) } },
          select: { interventionId: true, scrutinId: true },
        })
      : [];
    const scrutinsParPrise = new Map<string, string[]>();
    for (const l of liens) {
      scrutinsParPrise.set(l.interventionId, [
        ...(scrutinsParPrise.get(l.interventionId) ?? []),
        l.scrutinId,
      ]);
    }

    if (total === 0 && !reunion) return null;

    return {
      data: lignes.map(({ contenu, ...reste }) => ({
        ...reste,
        // Tronqué comme sur la page d'un scrutin et sur la fiche d'un député :
        // une séance pèse jusqu'à 1,1 Mo de texte. Le lecteur déplie ce qu'il
        // veut, `ExpandableText` va rechercher la suite.
        contenu:
          contenu.length > CONTENU_PREVIEW_LENGTH
            ? contenu.substring(0, CONTENU_PREVIEW_LENGTH)
            : contenu,
        hasMore: contenu.length > CONTENU_PREVIEW_LENGTH,
        scrutinIds: scrutinsParPrise.get(reste.id) ?? [],
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNext: query.page * query.limit < total,
      },
    };
  }
}
