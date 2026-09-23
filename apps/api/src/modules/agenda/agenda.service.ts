import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { AgendaQuery, ProchainesEcheancesQuery, DebatDeReunionQuery } from './agenda.schema';
import {
  ANNONCE_ORDRE_DU_JOUR,
  jourDeSeanceSenat,
  journeeDeSeance,
  titreDOrdreDuJour,
} from '../../utils/interventions';
import { sommaireDeSeance, type DossierBref } from './sommaire-de-seance';


/**
 * Ce qu'il faut d'une réunion pour aller chercher ce qui s'y est dit et voté.
 *
 * La chambre est indispensable : l'Assemblée et le Sénat ne rangent ni leurs
 * comptes rendus ni leurs scrutins de la même façon.
 */
interface CadreDeSeance {
  id: string;
  uid: string;
  type: string;
  dateDebut: Date;
  chambre: string | null;
  /**
   * Vrai quand la séance n'a d'autre nom que son compte rendu.
   *
   * 1 233 comptes rendus de la 15e législature ne déclarent aucune référence de
   * séance — l'élément n'existe pas dans leur schéma — et portent donc leur
   * propre identifiant. Les scrutins, eux, nomment bien leur séance : aucun ne
   * référencera jamais cet identifiant-là, et la journée est le seul
   * rapprochement possible. La page le dit, comme elle le dit pour le Sénat.
   */
  nommeeParSonCompteRendu?: boolean;
}

/**
 * Le compte rendu dont relèvent les prises de parole d'une séance.
 *
 * TROIS RATTACHEMENTS, POUR TROIS SOURCES. Les prises de commission portent une
 * clé étrangère vers leur réunion (`reunionId`), posée par l'ingestion des
 * comptes rendus. Les séances de l'Assemblée ne portent que le `seanceId` du
 * compte rendu — le même texte que l'`uid` de la réunion, mais sans contrainte,
 * parce que les deux sources n'ont jamais été reliées.
 *
 * LE SÉNAT PUBLIE PAR JOUR. Son compte rendu est un document quotidien
 * (`d20260721`) quand son agenda déclare deux à cinq séances dans la journée —
 * 70 jours sur 174. Aucun rattachement séance par séance n'est possible : la
 * source ne le dit nulle part. On sert donc la journée, et la page le dit.
 */
function ouSontLesPrises(reunion: CadreDeSeance) {
  if (reunion.type !== 'seance') return { reunionId: reunion.id };
  return { seanceId: compteRenduDeLaSeance(reunion) };
}

function compteRenduDeLaSeance(reunion: CadreDeSeance): string {
  return reunion.chambre === 'senat' ? jourDeSeanceSenat(reunion.dateDebut) : reunion.uid;
}

/**
 * Où sont les votes d'une séance.
 *
 * L'Assemblée nomme la séance sur chaque scrutin (`seanceRef`) ; le Sénat ne le
 * fait sur aucun de ses 4 775 scrutins, qui sont de surcroît datés à minuit.
 * La journée est donc le seul rattachement disponible — c'est déjà celui que
 * l'agenda utilise pour poser les votes sur la carte d'une séance.
 *
 * Une réunion de commission ne vote pas de scrutin public : elle rend des avis,
 * qui ont leur propre table.
 */
function ouSontLesVotes(reunion: CadreDeSeance): Prisma.ScrutinWhereInput | null {
  if (reunion.type !== 'seance') return null;
  if (reunion.chambre === 'senat' || reunion.nommeeParSonCompteRendu) {
    return {
      chambre: reunion.chambre === 'senat' ? 'senat' : 'assemblee',
      date: journeeDeSeance(reunion.dateDebut),
    };
  }
  return { seanceRef: reunion.uid };
}

/** Ce qu'il faut d'un vote pour l'afficher dans le fil d'une séance. */
const VOTE_DE_SEANCE_SELECT = {
  id: true,
  numero: true,
  titre: true,
  date: true,
  sort: true,
  chambre: true,
  session: true,
  nombrePour: true,
  nombreContre: true,
  nombreAbstention: true,
  dossierId: true,
} as const;

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
  /**
   * Les votes d'une séance, dans l'ordre où ils ont été appelés.
   *
   * Vide pour une commission, qui rend des avis et ne vote pas de scrutin
   * public.
   */
  private async votesDeLaSeance(cadre: CadreDeSeance) {
    const where = ouSontLesVotes(cadre);
    if (!where) return [];
    return this.prisma.scrutin.findMany({
      where,
      select: VOTE_DE_SEANCE_SELECT,
      orderBy: { numero: 'asc' },
    });
  }

  /**
   * Le sommaire d'une séance : ses points, leurs textes, leurs votes.
   *
   * Voir `sommaire-de-seance.ts` pour ce qui est reconstitué et ce qui est
   * attesté. Ici, on ne fait que rassembler la matière : les annonces de la
   * présidence, les prises de parole réduites à leur rang et à leur texte, et
   * le rang auquel chaque vote est tombé.
   */
  private async getSommaire(
    cadre: CadreDeSeance,
    scrutins: Array<{ id: string; dossierId: string | null }>,
  ) {
    if (cadre.type !== 'seance') return [];

    const portee = ouSontLesPrises(cadre);
    const [annonces, prises, liens] = await Promise.all([
      this.prisma.intervention.findMany({
        where: { ...portee, estPresidence: true, contenu: { startsWith: ANNONCE_ORDRE_DU_JOUR } },
        select: { ordre: true, contenu: true },
        orderBy: { ordre: 'asc' },
      }),
      // Deux colonnes seulement : une séance porte jusqu'à 1 614 prises de
      // parole, dont on n'a besoin ici que du rang et du texte visé.
      this.prisma.intervention.findMany({
        where: portee,
        select: { ordre: true, dossierId: true },
        orderBy: { ordre: 'asc' },
      }),
      scrutins.length > 0
        ? this.prisma.interventionScrutin.findMany({
            where: { scrutinId: { in: scrutins.map((s) => s.id) } },
            select: { scrutinId: true, intervention: { select: { ordre: true } } },
          })
        : Promise.resolve([]),
    ]);

    // Le rang de la DERNIÈRE prise qui précède le vote : c'est là qu'il est
    // tombé, et c'est donc lui qui décide du point dont il relève.
    const ordreDesVotes = new Map<string, number>();
    for (const lien of liens) {
      const rang = lien.intervention?.ordre;
      if (rang === null || rang === undefined) continue;
      const vu = ordreDesVotes.get(lien.scrutinId);
      if (vu === undefined || rang > vu) ordreDesVotes.set(lien.scrutinId, rang);
    }

    const dossierIds = [
      ...new Set(
        [...prises.map((p) => p.dossierId), ...scrutins.map((s) => s.dossierId)].filter(
          (id): id is string => id !== null,
        ),
      ),
    ];
    const dossiers = dossierIds.length > 0
      ? await this.prisma.dossierLegislatif.findMany({
          where: { id: { in: dossierIds } },
          select: {
            id: true,
            uid: true,
            titre: true,
            procedureLibelle: true,
          },
        })
      : [];

    return sommaireDeSeance({
      annonces: annonces
        .map((a) => ({ ordre: a.ordre, titre: titreDOrdreDuJour(a.contenu) }))
        .filter((a): a is { ordre: number; titre: string } =>
          a.ordre !== null && a.titre.length > 0),
      prises,
      scrutins,
      ordreDesVotes,
      dossiers: new Map<string, DossierBref>(dossiers.map((d) => [d.id, d])),
    });
  }

  private async getSeanceSansReunion(uid: string) {
    const [agregat, premiere] = await Promise.all([
      this.prisma.intervention.aggregate({
        where: { seanceId: uid },
        _min: { date: true },
        _count: { _all: true },
      }),
      this.prisma.intervention.findFirst({
        where: { seanceId: uid },
        select: { chambre: true, seanceUid: true },
      }),
    ]);

    if (agregat._count._all === 0 || !agregat._min.date) return null;

    // L'uid demandé EST déjà celui du compte rendu : `ouSontLesPrises` le
    // retrouve tel quel, à l'Assemblée comme au Sénat où il vaut la journée.
    const cadre: CadreDeSeance = {
      id: uid,
      uid,
      type: 'seance',
      dateDebut: agregat._min.date,
      chambre: premiere?.chambre ?? null,
      nommeeParSonCompteRendu: premiere?.seanceUid === uid,
    };

    const scrutins = await this.votesDeLaSeance(cadre);
    const sommaire = await this.getSommaire(cadre, scrutins);

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
      sommaire,
      // C'est déjà la page de la journée : elle est sa propre canonique.
      seanceCanonique: null,
      votesDuJour: cadre.chambre === 'senat' || (cadre.nommeeParSonCompteRendu ?? false),
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

    const cadre: CadreDeSeance = {
      id: reunion.id,
      uid: reunion.uid,
      type: reunion.type,
      dateDebut: reunion.dateDebut,
      chambre: reunion.commission?.chambre ?? null,
    };

    // Les votes de la séance, dans l'ordre où ils ont été appelés. Une séance
    // en compte huit en moyenne et jusqu'à 83 ; les commissions n'en ont pas.
    const [nbInterventions, scrutins] = await Promise.all([
      this.prisma.intervention.count({ where: ouSontLesPrises(cadre) }),
      this.votesDeLaSeance(cadre),
    ]);

    const sommaire = await this.getSommaire(cadre, scrutins);

    // Le compte rendu du Sénat est quotidien : les deux à cinq séances d'une
    // même journée servent donc le même débat et les mêmes votes. Elles gardent
    // chacune leur page — leur ordre du jour les distingue — mais déclarent
    // toutes comme canonique la page de la journée, qui est ce que la source
    // publie réellement. Sans elle, cinq URL indexées pour un seul compte rendu.
    const journee = compteRenduDeLaSeance(cadre);
    const seanceCanonique =
      cadre.type === 'seance'
      && cadre.chambre === 'senat'
      && nbInterventions > 0
      && journee !== reunion.uid
        ? journee
        : null;

    const detail = {
      ...reunion,
      nbInterventions,
      scrutins,
      sommaire,
      seanceCanonique,
      // Le Sénat ne rattache ses scrutins qu'à une journée : quand la journée
      // compte plusieurs séances, la page le dit plutôt que de laisser croire
      // à un rattachement séance par séance.
      votesDuJour: cadre.type === 'seance' && cadre.chambre === 'senat',
    };
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
      select: {
        id: true,
        uid: true,
        type: true,
        dateDebut: true,
        commission: { select: { chambre: true } },
      },
    });

    // Sans réunion, l'uid demandé peut encore être celui d'une séance que ses
    // seules prises de parole attestent — voir `getSeanceSansReunion`.
    const where = reunion
      ? ouSontLesPrises({ ...reunion, chambre: reunion.commission?.chambre ?? null })
      : { seanceId: uid };
    const [total, lignes] = await Promise.all([
      this.prisma.intervention.count({ where }),
      this.prisma.intervention.findMany({
        where,
        select: PRISE_DE_PAROLE_SELECT,
        // Départage obligatoire. Le rang seul ne suffit pas à ordonner : il a
        // longtemps été partagé par plusieurs prises d'une même journée du
        // Sénat — 9 338 collisions, depuis résorbées par l'identité stable des
        // interventions — et rien ne garantit que la base rende deux fois le
        // même ordre à rang égal. Un tri non total fait sauter des lignes d'une
        // page à l'autre et en répète d'autres.
        orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
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
