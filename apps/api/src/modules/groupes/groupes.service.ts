// =============================================================================
// Module Groupes - Service métier
// Gère les groupes politiques de l'Assemblée nationale et du Sénat
// =============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';

export type Chambre = 'assemblee' | 'senat';

export interface GroupeWithStats {
  id: string;
  slug: string;
  chambre: Chambre;
  /** Législature AN du groupe. Null au Sénat (pas de législature). */
  legislature: number | null;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  logoUrl: string | null;
  position: string | null;
  ordre: number;
  actif: boolean;
  membresCount: number;
  membresActifsCount: number;
  // Stats pré-calculées (depuis l'ingestion quotidienne)
  statsPresenceMoyenne: number | null;
  statsPresenceSolennelMoyenne: number | null;
  statsLoyauteMoyenne: number | null;
  statsCohesion: number | null;
}

export interface GroupeDetail extends GroupeWithStats {
  rang: number | null; // Rang par nombre de membres dans la chambre (hors NI)
  totalGroupes: number | null; // Nombre total de groupes dans la chambre (hors NI)
  totauxAmendements: number; // Total des amendements déposés par le groupe
  /** Sénat : session affichée (ex. "2020"). Null pour l'AN (période = législature). */
  session: string | null;
  /** Sénat : la session affichée est-elle la session courante ? (badge « à jour ») */
  sessionCourante: boolean;
  membres: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    circonscription: {
      departement: string;
      numero: number;
      nom: string;
    } | null;
    statsPresence: number | null;
    statsLoyaute: number | null;
  }[];
  stats: {
    presenceMoyenne: number;
    presenceSolennelMoyenne: number | null;
    loyauteMoyenne: number;
    participationMoyenne: number;
  };
}

/** Bornes d'une session sénatoriale « YYYY » → [1er oct. YYYY, 30 sept. YYYY+1]. */
function sessionBornes(session: string): { debut: Date; fin: Date } {
  const y = parseInt(session, 10);
  return {
    debut: new Date(Date.UTC(y, 9, 1)),
    fin: new Date(Date.UTC(y + 1, 8, 30, 23, 59, 59)),
  };
}

export class GroupesService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_TTL_LONG = 43200; // 12 hours

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  /**
   * Filtre Prisma sur les mandats d'un groupe pour la période AFFICHÉE.
   *
   * - AN : la ligne de groupe est déjà propre à sa législature (`RE 17e` ≠ `LAREM 15e`),
   *   donc `{ groupeId }` scope de lui-même — rien à ajouter.
   * - Sénat : une SEULE ligne par sigle, la périodisation vit dans les intervalles de
   *   mandat. On borne donc explicitement, sinon l'effectif/les membres mélangent les
   *   époques (`ump` = 210 mandats cumulés vs 128 en cours) :
   *     • `session` fournie → mandats chevauchant la session ;
   *     • sinon → mandats EN COURS (`dateFin` null) = composition courante.
   */
  private mandatsPeriodeWhere(
    groupe: { id: string; chambre: string },
    session?: string
  ): Prisma.MandatParlementaireWhereInput {
    if (groupe.chambre !== 'senat') return { groupeId: groupe.id };
    if (session) {
      const { debut, fin } = sessionBornes(session);
      return {
        groupeId: groupe.id,
        dateDebut: { lte: fin },
        OR: [{ dateFin: null }, { dateFin: { gte: debut } }],
      };
    }
    return { groupeId: groupe.id, dateFin: null };
  }

  /**
   * Session sénatoriale courante, dérivée des données (session du scrutin le plus
   * récent). Sert de défaut et d'étiquette « période courante » — jamais une constante.
   */
  private async getSessionCouranteSenat(): Promise<string | null> {
    const cacheKey = 'groupes:session-courante:senat';
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached === 'null' ? null : cached;

    const plusRecent = await this.prisma.scrutin.findFirst({
      where: { chambre: 'senat' },
      orderBy: { date: 'desc' },
      select: { session: true },
    });
    const session = plusRecent?.session ?? null;
    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, String(session));
    return session;
  }

  // ===========================================================================
  // LISTE DES GROUPES
  // ===========================================================================

  /**
   * Législature AN la plus récente présente en base. Dérivée des données (et non
   * figée dans une constante) : la liste des groupes suit automatiquement le
   * changement de législature.
   */
  private async getLegislatureCouranteAN(): Promise<number | null> {
    const cacheKey = 'groupes:legislature-courante:assemblee';
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached === 'null' ? null : Number(cached);

    const plusRecent = await this.prisma.groupePolitique.findFirst({
      where: { chambre: 'assemblee', legislature: { not: null } },
      orderBy: { legislature: 'desc' },
      select: { legislature: true },
    });

    const legislature = plusRecent?.legislature ?? null;
    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, String(legislature));
    return legislature;
  }

  /**
   * Liste des groupes d'une période.
   *
   * Un sigle de groupe n'existe qu'à un instant donné : `RE`, `LAREM` et
   * `GDR-NUPES` cohabitent en base sur trois législatures. Sans filtre, la liste
   * mélangeait 36 groupes AN, dont des groupes dissous présentés comme actuels.
   * Par défaut on renvoie donc la législature courante ; le Sénat, qui n'a pas de
   * législature, n'est pas concerné.
   */
  async getGroupes(chambre?: Chambre, legislature?: number, session?: string): Promise<GroupeWithStats[]> {
    const legislatureAN = legislature ?? (await this.getLegislatureCouranteAN());
    // Sénat : session demandée, ou courante par défaut (dérivée des données).
    const sessionCouranteSenat = chambre === 'assemblee' ? null : await this.getSessionCouranteSenat();
    const sessionSenat = chambre === 'assemblee' ? undefined : session ?? sessionCouranteSenat ?? undefined;
    // Effectif : session passée → chevauchement ; session courante → « siège
    // actuellement » (dateFin null). Cf. mandatsPeriodeWhere.
    const senatWhereSession =
      sessionSenat && sessionSenat !== (sessionCouranteSenat ?? undefined) ? sessionSenat : undefined;
    const cacheKey = `groupes:list:${chambre || 'all'}:${legislatureAN ?? 'na'}:${sessionSenat ?? 'na'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // L'AN est périodisée par législature, le Sénat non : quand aucune chambre
    // n'est demandée, on borne la seule Assemblée.
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

    // Récupérer les groupes avec leurs stats pré-calculées
    const groupes = await this.prisma.groupePolitique.findMany({
      where: {
        actif: true,
        ...periode,
      },
      include: {
        // Effectif compté sur les MANDATS du groupe : les parlementaires dont
        // c'est le groupe *courant* sont zéro pour un groupe dissous.
        _count: {
          select: {
            mandatsParlementaires: true,
          },
        },
      },
      orderBy: [{ chambre: 'asc' }, { ordre: 'asc' }],
    });

    // Effectif Sénat borné à la période (le `_count` global mélangerait les époques :
    // `ump` = 210 cumulés vs 128 en cours). L'AN reste sur son `_count` (ligne déjà
    // propre à sa législature).
    const senatIds = groupes.filter((g) => g.chambre === 'senat').map((g) => g.id);
    const senatCounts = new Map<string, number>();
    if (senatIds.length > 0) {
      const base: Prisma.MandatParlementaireWhereInput = { groupeId: { in: senatIds } };
      const where: Prisma.MandatParlementaireWhereInput = senatWhereSession
        ? (() => {
            const { debut, fin } = sessionBornes(senatWhereSession);
            return { ...base, dateDebut: { lte: fin }, OR: [{ dateFin: null }, { dateFin: { gte: debut } }] };
          })()
        : { ...base, dateFin: null };
      const counts = await this.prisma.mandatParlementaire.groupBy({
        by: ['groupeId'],
        where,
        _count: { _all: true },
      });
      for (const c of counts) if (c.groupeId) senatCounts.set(c.groupeId, c._count._all);
    }

    const result: GroupeWithStats[] = groupes.map((g) => ({
      id: g.id,
      slug: g.slug,
      chambre: g.chambre as Chambre,
      legislature: g.legislature,
      nom: g.nom,
      nomComplet: g.nomComplet,
      couleur: g.couleur,
      logoUrl: g.logoUrl,
      position: g.position,
      ordre: g.ordre,
      actif: g.actif,
      membresCount: g.chambre === 'senat' ? senatCounts.get(g.id) ?? 0 : g._count.mandatsParlementaires,
      // Sénat : effectif de la période ; AN : stats pré-calculées ou fallback au count.
      membresActifsCount:
        g.chambre === 'senat'
          ? senatCounts.get(g.id) ?? 0
          : g.statsMembresActifs ?? g._count.mandatsParlementaires,
      // Stats pré-calculées depuis l'ingestion
      statsPresenceMoyenne: g.statsPresenceMoyenne,
      statsPresenceSolennelMoyenne: g.statsPresenceSolennelMoyenne,
      statsLoyauteMoyenne: g.statsLoyauteMoyenne,
      statsCohesion: g.statsCohesion,
    }));

    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // DÉTAIL D'UN GROUPE
  // ===========================================================================

  async getGroupeBySlug(
    chambre: Chambre,
    slug: string,
    legislature?: number,
    session?: string
  ): Promise<GroupeDetail | null> {
    // Sénat : à défaut de session demandée, on affiche la session COURANTE (dérivée
    // des données). L'AN ignore ce paramètre (sa période est la législature).
    const sessionCourante = chambre === 'senat' ? await this.getSessionCouranteSenat() : null;
    const sessionAffichee = chambre === 'senat' ? session ?? sessionCourante ?? undefined : undefined;
    const estSessionCourante = chambre !== 'senat' || sessionAffichee === (sessionCourante ?? undefined);
    // Vue historique = Sénat sur une session passée. Le WHERE mandats vaut alors le
    // chevauchement de la session ; la vue courante retombe sur « siège actuellement »
    // (dateFin null, via mandatsPeriodeWhere(undefined)).
    const historique = chambre === 'senat' && !estSessionCourante && !!sessionAffichee;
    const whereSession = historique ? sessionAffichee : undefined;

    const cacheKey = `groupe:${chambre}:${slug}:${legislature ?? 'courante'}:${sessionAffichee ?? 'na'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findFirst({
      // Multi-législatures : un même slug peut exister sur plusieurs législatures (AN).
      // Sans `legislature`, on résout la plus récente. Sénat : legislature null.
      where: { slug, chambre, ...(legislature !== undefined && { legislature }) },
      orderBy: { legislature: 'desc' },
    });

    if (!groupe) return null;

    // Les membres sont les titulaires des MANDATS rattachés à ce groupe SUR LA PÉRIODE
    // affichée (cf. mandatsPeriodeWhere), et non les parlementaires dont c'est le groupe
    // *actuel* : sans quoi un groupe dissous (LAREM) afficherait zéro membre, et un
    // groupe Sénat mélangerait les époques. La circonscription affichée est celle du mandat.
    const mandats = await this.prisma.mandatParlementaire.findMany({
      where: this.mandatsPeriodeWhere(groupe, whereSession),
      select: {
        statsPresence: true,
        statsLoyaute: true,
        circonscription: { select: { departement: true, numero: true, nom: true } },
        personne: {
          select: {
            id: true,
            slug: true,
            nom: true,
            prenom: true,
            photoUrl: true,
            circonscription: { select: { departement: true, numero: true, nom: true } },
          },
        },
      },
      orderBy: { personne: { nom: 'asc' } },
    });

    const membres = mandats.map((m) => ({
      id: m.personne.id,
      slug: m.personne.slug,
      nom: m.personne.nom,
      prenom: m.personne.prenom,
      photoUrl: m.personne.photoUrl,
      circonscription: m.circonscription ?? m.personne.circonscription,
      // Stats DU MANDAT (période du groupe), pas la carrière entière de la personne.
      statsPresence: m.statsPresence,
      statsLoyaute: m.statsLoyaute,
    }));

    // Vue historique (Sénat, session passée) : les stats pré-calculées du groupe
    // portent sur la session COURANTE — on ne peut donc pas les afficher ici. On
    // recalcule à la volée sur la période demandée (moyennes = stats des mandats de
    // la période ; cohésion = requête bornée sur les scrutins de la session).
    const presenceMoyenne = historique
      ? this.calculateAverage(membres, 'statsPresence')
      : groupe.statsPresenceMoyenne ?? this.calculateAverage(membres, 'statsPresence');
    const loyauteMoyenne = historique
      ? this.calculateAverage(membres, 'statsLoyaute')
      : groupe.statsLoyauteMoyenne ?? this.calculateAverage(membres, 'statsLoyaute');
    const cohesion = historique
      ? await this.calculateSenatGroupeCohesionSession(groupe.id, sessionAffichee!)
      : groupe.statsCohesion;
    const presenceSolennelMoyenne = historique ? null : groupe.statsPresenceSolennelMoyenne;

    // Calculer le rang par nombre de membres (hors NI)
    let rang: number | null = null;
    let totalGroupes: number | null = null;
    if (slug !== 'ni') {
      // Le rang se compare aux groupes de LA MÊME législature : sans ce filtre,
      // un groupe de la 17e serait classé face aux groupes des 15e et 16e.
      const allGroupes = await this.prisma.groupePolitique.findMany({
        where: {
          chambre,
          actif: true,
          slug: { not: 'ni' },
          legislature: groupe.legislature,
        },
        select: {
          slug: true,
          statsMembresActifs: true,
        },
        orderBy: { statsMembresActifs: 'desc' },
      });
      const current = allGroupes.find((g) => g.slug === slug);
      if (current) {
        // Rang = nombre de groupes ayant strictement plus de membres + 1
        // Ex aequo: deux groupes à 17 membres partagent le même rang
        rang = allGroupes.filter((g) => (g.statsMembresActifs ?? 0) > (current.statsMembresActifs ?? 0)).length + 1;
      }
      totalGroupes = allGroupes.length;
    }

    // Total des amendements : agrégé sur les mandats du groupe de la PÉRIODE affichée.
    const amendementsSum = await this.prisma.mandatParlementaire.aggregate({
      where: this.mandatsPeriodeWhere(groupe, whereSession),
      _sum: {
        statsAmendements: true,
      },
    });
    const totauxAmendements = amendementsSum._sum.statsAmendements || 0;

    const result: GroupeDetail = {
      id: groupe.id,
      slug: groupe.slug,
      chambre: groupe.chambre as Chambre,
      legislature: groupe.legislature,
      nom: groupe.nom,
      nomComplet: groupe.nomComplet,
      couleur: groupe.couleur,
      logoUrl: groupe.logoUrl,
      position: groupe.position,
      ordre: groupe.ordre,
      actif: groupe.actif,
      membresCount: membres.length,
      membresActifsCount: historique ? membres.length : groupe.statsMembresActifs ?? membres.length,
      rang,
      totalGroupes,
      totauxAmendements,
      session: sessionAffichee ?? null,
      sessionCourante: estSessionCourante,
      // Stats de la période affichée (courante = pré-calculées ; historique = à la volée)
      statsPresenceMoyenne: historique ? presenceMoyenne : groupe.statsPresenceMoyenne,
      statsPresenceSolennelMoyenne: presenceSolennelMoyenne,
      statsLoyauteMoyenne: historique ? loyauteMoyenne : groupe.statsLoyauteMoyenne,
      statsCohesion: cohesion,
      membres: membres.map((m) => ({
        id: m.id,
        slug: m.slug,
        nom: m.nom,
        prenom: m.prenom,
        photoUrl: m.photoUrl,
        circonscription: m.circonscription,
        statsPresence: m.statsPresence,
        statsLoyaute: m.statsLoyaute,
      })),
      stats: {
        presenceMoyenne,
        presenceSolennelMoyenne: presenceSolennelMoyenne ?? null,
        loyauteMoyenne,
        participationMoyenne: presenceMoyenne,
      },
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    return result;
  }

  /**
   * Cohésion d'un groupe Sénat sur une session PASSÉE, calculée à la volée (la valeur
   * pré-calculée du batch porte sur la session courante). Requête bornée : un groupe ×
   * une session de scrutins. Cohésion = moyenne, par scrutin, de la part de la position
   * dominante parmi les membres du groupe d'époque (via l'intervalle de mandat).
   */
  private async calculateSenatGroupeCohesionSession(
    groupeId: string,
    session: string
  ): Promise<number | null> {
    const { debut, fin } = sessionBornes(session);
    const rows = await this.prisma.$queryRaw<{ cohesion: number | null }[]>`
      WITH gv AS (
        SELECT v.scrutin_id, v.position
        FROM votes v
        JOIN scrutins s ON s.id = v.scrutin_id AND s.chambre = 'senat'
          AND s.date >= ${debut} AND s.date <= ${fin}
        JOIN mandats_parlementaires m ON m.personne_id = v.parlementaire_id
          AND m.chambre = 'senat' AND m.groupe_id = ${groupeId}
          AND m.date_debut <= s.date AND (m.date_fin IS NULL OR m.date_fin >= s.date)
        WHERE v.position IN ('pour', 'contre', 'abstention')
      ),
      par_scrutin AS (
        SELECT scrutin_id, SUM(cnt) AS total, MAX(cnt) AS dominant
        FROM (SELECT scrutin_id, position, COUNT(*) AS cnt FROM gv GROUP BY scrutin_id, position) x
        GROUP BY scrutin_id
      )
      SELECT ROUND(AVG(100.0 * dominant / total))::int AS cohesion
      FROM par_scrutin WHERE total > 0
    `;
    return rows[0]?.cohesion ?? null;
  }

  /**
   * Calcule la moyenne d'une stat sur les membres (fallback si pas de stats pré-calculées)
   */
  private calculateAverage(membres: { statsPresence: number | null; statsLoyaute: number | null }[], field: 'statsPresence' | 'statsLoyaute'): number {
    const membresWithStats = membres.filter((m) => m[field] !== null);
    if (membresWithStats.length === 0) return 0;
    return Math.round(membresWithStats.reduce((acc, m) => acc + (m[field] || 0), 0) / membresWithStats.length);
  }

  // ===========================================================================
  // STATISTIQUES DES GROUPES
  // ===========================================================================

  async getGroupeStats(chambre: Chambre, slug: string, legislature?: number) {
    // Cache par législature : sans ça, la page 16e et la page 17e du même sigle
    // partageraient la même entrée et l'une écraserait l'autre.
    const cacheKey = `groupe:stats:${chambre}:${slug}:${legislature ?? 'courante'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findFirst({
      // Multi-législatures : un même slug peut exister sur plusieurs législatures (AN).
      // Sans `legislature`, on résout la plus récente. Sénat : legislature null.
      where: { slug, chambre, ...(legislature !== undefined && { legislature }) },
      orderBy: { legislature: 'desc' },
      select: { id: true },
    });

    if (!groupe) return null;

    // Récupérer les statistiques des membres
    const membresStats = await this.prisma.parlementaire.aggregate({
      where: {
        groupeId: groupe.id,
        actif: true,
        statsCalculatedAt: { not: null },
      },
      _avg: {
        statsPresence: true,
        statsLoyaute: true,
        statsParticipation: true,
        statsInterventions: true,
        statsAmendements: true,
      },
      _sum: {
        statsInterventions: true,
        statsAmendements: true,
        statsQuestions: true,
      },
      _count: true,
    });

    const stats = {
      membresActifs: membresStats._count,
      moyennes: {
        presence: Math.round(membresStats._avg.statsPresence || 0),
        loyaute: Math.round(membresStats._avg.statsLoyaute || 0),
        participation: Math.round(membresStats._avg.statsParticipation || 0),
        interventions: Math.round(membresStats._avg.statsInterventions || 0),
        amendements: Math.round(membresStats._avg.statsAmendements || 0),
      },
      totaux: {
        interventions: membresStats._sum.statsInterventions || 0,
        amendements: membresStats._sum.statsAmendements || 0,
        questions: membresStats._sum.statsQuestions || 0,
      },
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats));

    return stats;
  }

  // ===========================================================================
  // STATISTIQUES DE VOTES AGRÉGÉES PAR GROUPE
  // Optimisé avec une seule requête SQL pour éviter les O(n) queries
  // ===========================================================================

  async getGroupeVotingStats(
    chambre: Chambre,
    slug: string,
    options?: { groupeInitie?: boolean; legislature?: number; session?: string }
  ) {
    const groupeInitie = options?.groupeInitie ?? false;
    const legislature = options?.legislature;

    // Sénat uniquement : si une session PASSÉE est demandée (différente de la
    // courante, dérivée des données), on borne les requêtes de scrutins à
    // l'intervalle de cette session. Sinon (AN, ou session absente/courante),
    // comportement inchangé.
    const sessionCouranteSenat = chambre === 'senat' ? await this.getSessionCouranteSenat() : null;
    const sessionHistorique =
      chambre === 'senat' && options?.session && options.session !== (sessionCouranteSenat ?? undefined)
        ? options.session
        : undefined;

    // Cache par législature (AN) et par session historique (Sénat) : sans ça, la
    // vue courante et une vue d'époque du même sigle partageraient l'entrée.
    const cacheKey = `groupe:voting-stats:${chambre}:${slug}:${legislature ?? 'courante'}:${sessionHistorique ?? 'na'}${groupeInitie ? ':initie' : ''}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findFirst({
      // Multi-législatures : un même slug peut exister sur plusieurs législatures (AN).
      // Sans `legislature`, on résout la plus récente. Sénat : legislature null.
      where: { slug, chambre, ...(legislature !== undefined && { legislature }) },
      orderBy: { legislature: 'desc' },
      select: { id: true, nom: true, nomComplet: true, statsCohesion: true },
    });

    if (!groupe) return null;

    // Fragment de bornage temporel (Sénat, session passée uniquement) injecté dans
    // les requêtes SQL brutes ci-dessous. Vide sinon (AN, ou session courante/absente).
    const sessionSql = sessionHistorique
      ? (() => {
          const { debut, fin } = sessionBornes(sessionHistorique);
          return Prisma.sql`AND s.date >= ${debut} AND s.date <= ${fin}`;
        })()
      : Prisma.empty;

    // Requête SQL optimisée: agrège tous les votes du groupe en UNE seule requête
    // Si groupeInitie=true, on filtre sur les scrutins où demandeur_texte contient le nom du groupe
    const votesAggregation = groupeInitie
      ? await this.prisma.$queryRaw<{ position: string; count: bigint }[]>`
          SELECT v.position, COUNT(*) as count
          FROM votes v
          JOIN scrutins s ON v.scrutin_id = s.id
          JOIN mandats_parlementaires m
            ON m.personne_id = v.parlementaire_id
            AND m.chambre = s.chambre
            AND (
                  (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                   AND m.legislature = s.legislature)
               OR (s.chambre = 'senat' AND m.date_debut <= s.date
                   AND (m.date_fin IS NULL OR m.date_fin >= s.date))
                )
          WHERE m.groupe_id = ${groupe.id}
            AND s.demandeur_texte IS NOT NULL
            AND (
              s.demandeur_texte ILIKE ${'%' + groupe.nom + '%'}
              OR s.demandeur_texte ILIKE ${'%' + (groupe.nomComplet || groupe.nom) + '%'}
            )
            ${sessionSql}
          GROUP BY v.position
        `
      : await this.prisma.$queryRaw<{ position: string; count: bigint }[]>`
          SELECT v.position, COUNT(*) as count
          FROM votes v
          JOIN scrutins s ON v.scrutin_id = s.id
          JOIN mandats_parlementaires m
            ON m.personne_id = v.parlementaire_id
            AND m.chambre = s.chambre
            AND (
                  (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                   AND m.legislature = s.legislature)
               OR (s.chambre = 'senat' AND m.date_debut <= s.date
                   AND (m.date_fin IS NULL OR m.date_fin >= s.date))
                )
          WHERE m.groupe_id = ${groupe.id}
          ${sessionSql}
          GROUP BY v.position
        `;

    const positions: Record<string, number> = {
      pour: 0,
      contre: 0,
      abstention: 0,
      absent: 0,
    };

    let totalVotes = 0;
    votesAggregation.forEach((v) => {
      positions[v.position] = Number(v.count);
      totalVotes += Number(v.count);
    });

    const votesExprimes = totalVotes - (positions.absent || 0);
    const tauxParticipation = totalVotes > 0 ? Math.round((votesExprimes / totalVotes) * 100) : 0;

    // Requête SQL optimisée: récupère les 20 derniers scrutins avec les votes du groupe EN UNE SEULE REQUÊTE
    // Si groupeInitie=true, filtre sur les scrutins où demandeur_texte contient le nom du groupe
    const groupeNom = groupe.nom;
    const groupeNomComplet = groupe.nomComplet || groupe.nom;

    const scrutinsWithVotes = groupeInitie
      ? await this.prisma.$queryRaw<
          {
            id: string;
            numero: number;
            titre: string;
            date: Date;
            sort: string;
            type_vote: string;
            session: string | null;
            nombre_pour: number;
            nombre_contre: number;
            nombre_abstention: number;
            pour: bigint;
            contre: bigint;
            abstention: bigint;
            absent: bigint;
          }[]
        >`
          WITH recent_scrutins AS (
            -- chambre + legislature sont indispensables en aval : cette CTE sert
            -- de table de scrutins a la jointure du mandat d'epoque.
            SELECT DISTINCT s.id, s.numero, s.titre, s.date, s.sort, s.type_vote, s.session,
                   s.chambre, s.legislature,
                   s.nombre_pour, s.nombre_contre, s.nombre_abstention
            FROM scrutins s
            JOIN votes v ON v.scrutin_id = s.id
            JOIN mandats_parlementaires m
              ON m.personne_id = v.parlementaire_id
              AND m.chambre = s.chambre
              AND (
                    (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                     AND m.legislature = s.legislature)
                 OR (s.chambre = 'senat' AND m.date_debut <= s.date
                     AND (m.date_fin IS NULL OR m.date_fin >= s.date))
                  )
            WHERE m.groupe_id = ${groupe.id}
              AND s.chambre = ${chambre}
              AND s.demandeur_texte IS NOT NULL
              AND (
                s.demandeur_texte ILIKE ${'%' + groupeNom + '%'}
                OR s.demandeur_texte ILIKE ${'%' + groupeNomComplet + '%'}
              )
              ${sessionSql}
            ORDER BY s.date DESC
            LIMIT 20
          ),
          groupe_votes AS (
            SELECT
              s.id as scrutin_id,
              SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) as pour,
              SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) as contre,
              SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END) as abstention,
              SUM(CASE WHEN v.position = 'absent' THEN 1 ELSE 0 END) as absent
            FROM recent_scrutins s
            JOIN votes v ON v.scrutin_id = s.id
            JOIN mandats_parlementaires m
              ON m.personne_id = v.parlementaire_id
              AND m.chambre = s.chambre
              AND (
                    (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                     AND m.legislature = s.legislature)
                 OR (s.chambre = 'senat' AND m.date_debut <= s.date
                     AND (m.date_fin IS NULL OR m.date_fin >= s.date))
                  )
            WHERE m.groupe_id = ${groupe.id}
            GROUP BY s.id
          )
          SELECT
            rs.id, rs.numero, rs.titre, rs.date, rs.sort, rs.type_vote, rs.session,
            rs.nombre_pour, rs.nombre_contre, rs.nombre_abstention,
            COALESCE(gv.pour, 0) as pour,
            COALESCE(gv.contre, 0) as contre,
            COALESCE(gv.abstention, 0) as abstention,
            COALESCE(gv.absent, 0) as absent
          FROM recent_scrutins rs
          LEFT JOIN groupe_votes gv ON rs.id = gv.scrutin_id
          ORDER BY rs.date DESC
        `
      : await this.prisma.$queryRaw<
          {
            id: string;
            numero: number;
            titre: string;
            date: Date;
            sort: string;
            type_vote: string;
            session: string | null;
            nombre_pour: number;
            nombre_contre: number;
            nombre_abstention: number;
            pour: bigint;
            contre: bigint;
            abstention: bigint;
            absent: bigint;
          }[]
        >`
          WITH recent_scrutins AS (
            -- chambre + legislature sont indispensables en aval : cette CTE sert
            -- de table de scrutins a la jointure du mandat d'epoque.
            SELECT DISTINCT s.id, s.numero, s.titre, s.date, s.sort, s.type_vote, s.session,
                   s.chambre, s.legislature,
                   s.nombre_pour, s.nombre_contre, s.nombre_abstention
            FROM scrutins s
            JOIN votes v ON v.scrutin_id = s.id
            JOIN mandats_parlementaires m
              ON m.personne_id = v.parlementaire_id
              AND m.chambre = s.chambre
              AND (
                    (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                     AND m.legislature = s.legislature)
                 OR (s.chambre = 'senat' AND m.date_debut <= s.date
                     AND (m.date_fin IS NULL OR m.date_fin >= s.date))
                  )
            WHERE m.groupe_id = ${groupe.id}
              AND s.chambre = ${chambre}
              ${sessionSql}
            ORDER BY s.date DESC
            LIMIT 20
          ),
          groupe_votes AS (
            SELECT
              s.id as scrutin_id,
              SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) as pour,
              SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) as contre,
              SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END) as abstention,
              SUM(CASE WHEN v.position = 'absent' THEN 1 ELSE 0 END) as absent
            FROM recent_scrutins s
            JOIN votes v ON v.scrutin_id = s.id
            JOIN mandats_parlementaires m
              ON m.personne_id = v.parlementaire_id
              AND m.chambre = s.chambre
              AND (
                    (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                     AND m.legislature = s.legislature)
                 OR (s.chambre = 'senat' AND m.date_debut <= s.date
                     AND (m.date_fin IS NULL OR m.date_fin >= s.date))
                  )
            WHERE m.groupe_id = ${groupe.id}
            GROUP BY s.id
          )
          SELECT
            rs.id, rs.numero, rs.titre, rs.date, rs.sort, rs.type_vote, rs.session,
            rs.nombre_pour, rs.nombre_contre, rs.nombre_abstention,
            COALESCE(gv.pour, 0) as pour,
            COALESCE(gv.contre, 0) as contre,
            COALESCE(gv.abstention, 0) as abstention,
            COALESCE(gv.absent, 0) as absent
          FROM recent_scrutins rs
          LEFT JOIN groupe_votes gv ON rs.id = gv.scrutin_id
          ORDER BY rs.date DESC
        `;

    // Transformer les résultats SQL en format attendu
    const scrutinsRecents = scrutinsWithVotes.map((s) => {
      const groupePositions = {
        pour: Number(s.pour),
        contre: Number(s.contre),
        abstention: Number(s.abstention),
        absent: Number(s.absent),
      };

      const totalGroupeVotes = groupePositions.pour + groupePositions.contre + groupePositions.abstention + groupePositions.absent;
      const votesExprimesScrutin = totalGroupeVotes - groupePositions.absent;

      // Position majoritaire (hors absents)
      const positionsMajoritaires = Object.entries(groupePositions)
        .filter(([key]) => key !== 'absent')
        .sort((a, b) => b[1] - a[1]);

      const topPosition = positionsMajoritaires[0];
      const positionMajoritaire = topPosition && topPosition[1] > 0 ? topPosition[0] : null;
      const cohesion = votesExprimesScrutin > 0 && topPosition
        ? Math.round((topPosition[1] / votesExprimesScrutin) * 100)
        : 0;

      return {
        id: s.id,
        numero: s.numero,
        titre: s.titre,
        date: s.date,
        sort: s.sort,
        typeVote: s.type_vote,
        session: s.session,
        nombrePour: s.nombre_pour,
        nombreContre: s.nombre_contre,
        nombreAbstention: s.nombre_abstention,
        groupeVotes: groupePositions,
        totalGroupeVotes,
        positionMajoritaire,
        cohesion,
      };
    });

    // Utiliser la cohésion pré-calculée si disponible, sinon calculer la moyenne
    const cohesionMoyenne = groupe.statsCohesion ?? (
      scrutinsRecents.length > 0
        ? Math.round(scrutinsRecents.reduce((acc, s) => acc + s.cohesion, 0) / scrutinsRecents.length)
        : 0
    );

    const result = {
      totalVotes,
      positions,
      tauxParticipation,
      cohesionMoyenne,
      scrutinsRecents,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // ALLIANCES ENTRE GROUPES (pré-calculées)
  // ===========================================================================

  async getGroupeAlliances(chambre: Chambre, slug: string, legislature?: number) {
    // Cache par législature : les alliances AN sont pré-calculées PAR législature en
    // base, donc la 16e et la 17e doivent avoir des entrées distinctes. Sénat : pas
    // de recalcul par session (données pré-calculées sur la session courante
    // uniquement), le front masque ce bloc en vue historique.
    const cacheKey = `groupe:alliances:${chambre}:${slug}:${legislature ?? 'courante'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findFirst({
      // Multi-législatures : un même slug peut exister sur plusieurs législatures (AN).
      // Sans `legislature`, on résout la plus récente. Sénat : legislature null.
      where: { slug, chambre, ...(legislature !== undefined && { legislature }) },
      orderBy: { legislature: 'desc' },
      select: { id: true, nom: true, couleur: true },
    });

    if (!groupe) return null;

    // Récupérer les alliances pré-calculées (depuis groupes_alliances)
    const alliances = await this.prisma.groupeAlliance.findMany({
      where: { groupeFromId: groupe.id },
      include: {
        groupeTo: {
          select: {
            id: true,
            slug: true,
            nom: true,
            nomComplet: true,
            couleur: true,
            position: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { tauxAccord: 'desc' },
    });

    // Séparer en alliés (>60%), neutres (40-60%), opposés (<40%)
    const allies = alliances
      .filter((a) => a.tauxAccord >= 60)
      .map((a) => ({
        groupe: a.groupeTo,
        tauxAccord: a.tauxAccord,
        votesCommuns: a.votesCommuns,
        votesTotaux: a.votesTotaux,
      }));

    const neutres = alliances
      .filter((a) => a.tauxAccord >= 40 && a.tauxAccord < 60)
      .map((a) => ({
        groupe: a.groupeTo,
        tauxAccord: a.tauxAccord,
        votesCommuns: a.votesCommuns,
        votesTotaux: a.votesTotaux,
      }));

    const opposes = alliances
      .filter((a) => a.tauxAccord < 40)
      .map((a) => ({
        groupe: a.groupeTo,
        tauxAccord: a.tauxAccord,
        votesCommuns: a.votesCommuns,
        votesTotaux: a.votesTotaux,
      }))
      .sort((a, b) => a.tauxAccord - b.tauxAccord); // Du plus opposé au moins

    const result = {
      groupeId: groupe.id,
      groupeNom: groupe.nom,
      groupeCouleur: groupe.couleur,
      allies,
      neutres,
      opposes,
      calculatedAt: alliances[0]?.calculatedAt ?? null,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // STATS PAR THÉMATIQUE (pré-calculées pour radar chart)
  // ===========================================================================

  async getGroupeThematiques(
    chambre: Chambre,
    slug: string,
    options?: { groupeInitie?: boolean; legislature?: number }
  ) {
    const groupeInitie = options?.groupeInitie ?? false;
    const legislature = options?.legislature;
    // Cache par législature : les thématiques AN sont pré-calculées PAR ligne de
    // groupe (donc par législature). Sénat : pas de paramètre session ici, cf.
    // getGroupeAlliances — le front masque ce bloc en vue historique.
    const cacheKey = `groupe:thematiques:${chambre}:${slug}:${legislature ?? 'courante'}${groupeInitie ? ':initie' : ''}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findFirst({
      // Multi-législatures : un même slug peut exister sur plusieurs législatures (AN).
      // Sans `legislature`, on résout la plus récente. Sénat : legislature null.
      where: { slug, chambre, ...(legislature !== undefined && { legislature }) },
      orderBy: { legislature: 'desc' },
      select: { id: true, nom: true, nomComplet: true, couleur: true },
    });

    if (!groupe) return null;

    let radarData: {
      thematique: string;
      position: number;
      cohesion: number;
      votesTotaux: number;
      votesPour: number;
      votesContre: number;
      votesAbstention: number;
    }[];

    if (groupeInitie) {
      // Calcul à la volée pour les scrutins initiés par le groupe
      const groupeNom = groupe.nom;
      const groupeNomComplet = groupe.nomComplet || groupe.nom;

      // Requête SQL qui calcule les stats par thématique pour les scrutins initiés par le groupe
      // Limite à 500 scrutins max pour éviter les requêtes trop lourdes
      const thematiquesData = await this.prisma.$queryRaw<
        {
          tag: string;
          votes_totaux: bigint;
          votes_pour: bigint;
          votes_contre: bigint;
          votes_abstention: bigint;
        }[]
      >`
        WITH scrutins_groupe AS (
          SELECT DISTINCT s.id, s.tags
          FROM scrutins s
          WHERE s.chambre = ${chambre}
            AND s.demandeur_texte IS NOT NULL
            AND (
              s.demandeur_texte ILIKE ${'%' + groupeNom + '%'}
              OR s.demandeur_texte ILIKE ${'%' + groupeNomComplet + '%'}
            )
          ORDER BY s.date DESC
          LIMIT 500
        ),
        scrutin_tags AS (
          SELECT sg.id as scrutin_id, unnest(sg.tags) as tag
          FROM scrutins_groupe sg
        ),
        votes_par_tag AS (
          SELECT
            st.tag,
            v.scrutin_id,
            SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) as pour,
            SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) as contre,
            SUM(CASE WHEN v.position = 'abstention' THEN 1 ELSE 0 END) as abstention
          FROM scrutin_tags st
          JOIN votes v ON v.scrutin_id = st.scrutin_id
          JOIN mandats_parlementaires m
            ON m.personne_id = v.parlementaire_id
            AND m.chambre = s.chambre
            AND (
                  (s.chambre = 'assemblee' AND s.legislature IS NOT NULL
                   AND m.legislature = s.legislature)
               OR (s.chambre = 'senat' AND m.date_debut <= s.date
                   AND (m.date_fin IS NULL OR m.date_fin >= s.date))
                )
          WHERE m.groupe_id = ${groupe.id}
          GROUP BY st.tag, v.scrutin_id
        ),
        position_majoritaire AS (
          SELECT
            tag,
            scrutin_id,
            CASE
              WHEN pour >= contre AND pour >= abstention THEN 'pour'
              WHEN contre >= pour AND contre >= abstention THEN 'contre'
              ELSE 'abstention'
            END as position_maj
          FROM votes_par_tag
        )
        SELECT
          pm.tag,
          COUNT(DISTINCT pm.scrutin_id) as votes_totaux,
          SUM(CASE WHEN pm.position_maj = 'pour' THEN 1 ELSE 0 END) as votes_pour,
          SUM(CASE WHEN pm.position_maj = 'contre' THEN 1 ELSE 0 END) as votes_contre,
          SUM(CASE WHEN pm.position_maj = 'abstention' THEN 1 ELSE 0 END) as votes_abstention
        FROM position_majoritaire pm
        GROUP BY pm.tag
        HAVING COUNT(DISTINCT pm.scrutin_id) >= 2
        ORDER BY COUNT(DISTINCT pm.scrutin_id) DESC
      `;

      radarData = thematiquesData.map((t) => {
        const votesTotaux = Number(t.votes_totaux);
        const votesPour = Number(t.votes_pour);
        const votesContre = Number(t.votes_contre);
        const votesAbstention = Number(t.votes_abstention);
        // Position: de -100 (tout contre) à +100 (tout pour)
        const position = votesTotaux > 0
          ? Math.round(((votesPour - votesContre) / votesTotaux) * 100)
          : 0;
        // Cohésion: % de la position majoritaire
        const maxVotes = Math.max(votesPour, votesContre, votesAbstention);
        const cohesion = votesTotaux > 0 ? Math.round((maxVotes / votesTotaux) * 100) : 0;

        return {
          thematique: t.tag,
          position,
          cohesion,
          votesTotaux,
          votesPour,
          votesContre,
          votesAbstention,
        };
      });
    } else {
      // Utiliser les stats thématiques pré-calculées
      const thematiques = await this.prisma.groupeThematique.findMany({
        where: { groupeId: groupe.id },
        orderBy: { votesTotaux: 'desc' },
      });

      radarData = thematiques.map((t) => ({
        thematique: t.thematique,
        position: t.positionMoyenne,
        cohesion: t.cohesionMoyenne,
        votesTotaux: t.votesTotaux,
        votesPour: t.votesPour,
        votesContre: t.votesContre,
        votesAbstention: t.votesAbstention,
      }));
    }

    const result = {
      groupeId: groupe.id,
      groupeNom: groupe.nom,
      groupeCouleur: groupe.couleur,
      thematiques: radarData,
      calculatedAt: groupeInitie ? new Date().toISOString() : null,
    };

    // Cache plus court pour les calculs à la volée
    const ttl = groupeInitie ? this.CACHE_TTL : this.CACHE_TTL_LONG;
    await this.redis.setex(cacheKey, ttl, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // COMPARAISON ENTRE GROUPES (toutes les alliances d'une chambre)
  // ===========================================================================

  async getGroupesMatriceAlliances(chambre: Chambre) {
    const cacheKey = `groupes:matrice-alliances:${chambre}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Récupérer tous les groupes actifs de la chambre
    const groupes = await this.prisma.groupePolitique.findMany({
      where: {
        chambre,
        actif: true,
      },
      select: {
        id: true,
        slug: true,
        nom: true,
        couleur: true,
        position: true,
        logoUrl: true,
      },
      orderBy: { ordre: 'asc' },
    });

    // Récupérer toutes les alliances de la chambre
    const groupeIds = groupes.map((g) => g.id);
    const alliances = await this.prisma.groupeAlliance.findMany({
      where: {
        groupeFromId: { in: groupeIds },
        groupeToId: { in: groupeIds },
      },
    });

    // Créer une matrice d'alliances
    const matrice: Record<string, Record<string, number>> = {};
    for (const g of groupes) {
      const row: Record<string, number> = {};
      for (const g2 of groupes) {
        row[g2.id] = g.id === g2.id ? 100 : 0; // Accord parfait avec soi-même
      }
      matrice[g.id] = row;
    }

    // Remplir la matrice avec les données d'alliance
    for (const a of alliances) {
      const row = matrice[a.groupeFromId];
      if (row) {
        row[a.groupeToId] = a.tauxAccord;
      }
    }

    const result = {
      groupes,
      matrice,
      calculatedAt: alliances[0]?.calculatedAt ?? null,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, JSON.stringify(result));

    return result;
  }
}
