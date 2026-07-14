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

export class GroupesService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_TTL_LONG = 43200; // 12 hours

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

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
  async getGroupes(chambre?: Chambre, legislature?: number): Promise<GroupeWithStats[]> {
    const legislatureAN = legislature ?? (await this.getLegislatureCouranteAN());
    const cacheKey = `groupes:list:${chambre || 'all'}:${legislatureAN ?? 'na'}`;

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
      membresCount: g._count.mandatsParlementaires,
      // Utiliser les stats pré-calculées (statsMembresActifs) ou fallback au count
      membresActifsCount: g.statsMembresActifs ?? g._count.mandatsParlementaires,
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
    legislature?: number
  ): Promise<GroupeDetail | null> {
    const cacheKey = `groupe:${chambre}:${slug}:${legislature ?? 'courante'}`;

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

    // Les membres sont les titulaires des MANDATS rattachés à ce groupe, et non
    // les parlementaires dont c'est le groupe *actuel* : sans quoi un groupe
    // dissous (LAREM, GDR-NUPES) afficherait zéro membre, puisque plus personne
    // n'y siège aujourd'hui. La circonscription affichée est celle du mandat.
    const mandats = await this.prisma.mandatParlementaire.findMany({
      where: { groupeId: groupe.id },
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

    // Utiliser les stats pré-calculées du groupe (ou fallback sur le calcul à la volée)
    const presenceMoyenne = groupe.statsPresenceMoyenne ?? this.calculateAverage(membres, 'statsPresence');
    const loyauteMoyenne = groupe.statsLoyauteMoyenne ?? this.calculateAverage(membres, 'statsLoyaute');

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

    // Total des amendements : agrégé sur les mandats du groupe (même raison que
    // les membres — les membres actuels d'un groupe dissous n'existent pas).
    const amendementsSum = await this.prisma.mandatParlementaire.aggregate({
      where: { groupeId: groupe.id },
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
      membresActifsCount: groupe.statsMembresActifs ?? membres.length,
      rang,
      totalGroupes,
      totauxAmendements,
      // Stats pré-calculées
      statsPresenceMoyenne: groupe.statsPresenceMoyenne,
      statsPresenceSolennelMoyenne: groupe.statsPresenceSolennelMoyenne,
      statsLoyauteMoyenne: groupe.statsLoyauteMoyenne,
      statsCohesion: groupe.statsCohesion,
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
        presenceSolennelMoyenne: groupe.statsPresenceSolennelMoyenne ?? null,
        loyauteMoyenne,
        participationMoyenne: presenceMoyenne,
      },
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

    return result;
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

  async getGroupeStats(chambre: Chambre, slug: string) {
    const cacheKey = `groupe:stats:${chambre}:${slug}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findFirst({
      // Multi-législatures : un même slug peut exister sur plusieurs législatures (AN).
      // On résout la plus récente (= législature courante). Sénat : legislature null.
      where: { slug, chambre },
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

  async getGroupeVotingStats(chambre: Chambre, slug: string, options?: { groupeInitie?: boolean }) {
    const groupeInitie = options?.groupeInitie ?? false;
    const cacheKey = `groupe:voting-stats:${chambre}:${slug}${groupeInitie ? ':initie' : ''}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findFirst({
      // Multi-législatures : un même slug peut exister sur plusieurs législatures (AN).
      // On résout la plus récente (= législature courante). Sénat : legislature null.
      where: { slug, chambre },
      orderBy: { legislature: 'desc' },
      select: { id: true, nom: true, nomComplet: true, statsCohesion: true },
    });

    if (!groupe) return null;

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

  async getGroupeAlliances(chambre: Chambre, slug: string) {
    const cacheKey = `groupe:alliances:${chambre}:${slug}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findFirst({
      // Multi-législatures : un même slug peut exister sur plusieurs législatures (AN).
      // On résout la plus récente (= législature courante). Sénat : legislature null.
      where: { slug, chambre },
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

  async getGroupeThematiques(chambre: Chambre, slug: string, options?: { groupeInitie?: boolean }) {
    const groupeInitie = options?.groupeInitie ?? false;
    const cacheKey = `groupe:thematiques:${chambre}:${slug}${groupeInitie ? ':initie' : ''}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findFirst({
      // Multi-législatures : un même slug peut exister sur plusieurs législatures (AN).
      // On résout la plus récente (= législature courante). Sénat : legislature null.
      where: { slug, chambre },
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
