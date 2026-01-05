// =============================================================================
// Module Groupes - Service métier
// Gère les groupes politiques de l'Assemblée nationale et du Sénat
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

export type Chambre = 'assemblee' | 'senat';

export interface GroupeWithStats {
  id: string;
  slug: string;
  chambre: Chambre;
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
  statsLoyauteMoyenne: number | null;
  statsCohesion: number | null;
}

export interface GroupeDetail extends GroupeWithStats {
  rang: number | null; // Rang par nombre de membres dans la chambre (hors NI)
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

  async getGroupes(chambre?: Chambre): Promise<GroupeWithStats[]> {
    const cacheKey = `groupes:list:${chambre || 'all'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Récupérer les groupes avec leurs stats pré-calculées
    const groupes = await this.prisma.groupePolitique.findMany({
      where: {
        actif: true,
        ...(chambre && { chambre }),
      },
      include: {
        _count: {
          select: {
            parlementaires: true,
          },
        },
      },
      orderBy: [{ chambre: 'asc' }, { ordre: 'asc' }],
    });

    const result: GroupeWithStats[] = groupes.map((g) => ({
      id: g.id,
      slug: g.slug,
      chambre: g.chambre as Chambre,
      nom: g.nom,
      nomComplet: g.nomComplet,
      couleur: g.couleur,
      logoUrl: g.logoUrl,
      position: g.position,
      ordre: g.ordre,
      actif: g.actif,
      membresCount: g._count.parlementaires,
      // Utiliser les stats pré-calculées (statsMembresActifs) ou fallback au count
      membresActifsCount: g.statsMembresActifs ?? g._count.parlementaires,
      // Stats pré-calculées depuis l'ingestion
      statsPresenceMoyenne: g.statsPresenceMoyenne,
      statsLoyauteMoyenne: g.statsLoyauteMoyenne,
      statsCohesion: g.statsCohesion,
    }));

    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // DÉTAIL D'UN GROUPE
  // ===========================================================================

  async getGroupeBySlug(chambre: Chambre, slug: string): Promise<GroupeDetail | null> {
    const cacheKey = `groupe:${chambre}:${slug}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findUnique({
      where: {
        slug_chambre: { slug, chambre },
      },
      include: {
        parlementaires: {
          where: { actif: true },
          select: {
            id: true,
            slug: true,
            nom: true,
            prenom: true,
            photoUrl: true,
            statsPresence: true,
            statsLoyaute: true,
            circonscription: {
              select: {
                departement: true,
                numero: true,
                nom: true,
              },
            },
          },
          orderBy: { nom: 'asc' },
        },
        _count: {
          select: {
            parlementaires: true,
          },
        },
      },
    });

    if (!groupe) return null;

    const membres = groupe.parlementaires;

    // Utiliser les stats pré-calculées du groupe (ou fallback sur le calcul à la volée)
    const presenceMoyenne = groupe.statsPresenceMoyenne ?? this.calculateAverage(membres, 'statsPresence');
    const loyauteMoyenne = groupe.statsLoyauteMoyenne ?? this.calculateAverage(membres, 'statsLoyaute');

    // Calculer le rang par nombre de membres (hors NI)
    let rang: number | null = null;
    if (slug !== 'ni') {
      const allGroupes = await this.prisma.groupePolitique.findMany({
        where: {
          chambre,
          actif: true,
          slug: { not: 'ni' },
        },
        select: {
          slug: true,
          statsMembresActifs: true,
        },
        orderBy: { statsMembresActifs: 'desc' },
      });
      rang = allGroupes.findIndex((g) => g.slug === slug) + 1;
      if (rang === 0) rang = null;
    }

    // Calculer le total des amendements
    const amendementsSum = await this.prisma.parlementaire.aggregate({
      where: {
        groupeId: groupe.id,
        actif: true,
      },
      _sum: {
        statsAmendements: true,
      },
    });
    const totauxAmendements = amendementsSum._sum.statsAmendements || 0;

    const result: GroupeDetail = {
      id: groupe.id,
      slug: groupe.slug,
      chambre: groupe.chambre as Chambre,
      nom: groupe.nom,
      nomComplet: groupe.nomComplet,
      couleur: groupe.couleur,
      logoUrl: groupe.logoUrl,
      position: groupe.position,
      ordre: groupe.ordre,
      actif: groupe.actif,
      membresCount: groupe._count.parlementaires,
      membresActifsCount: groupe.statsMembresActifs ?? membres.length,
      rang,
      totauxAmendements,
      // Stats pré-calculées
      statsPresenceMoyenne: groupe.statsPresenceMoyenne,
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

    const groupe = await this.prisma.groupePolitique.findUnique({
      where: {
        slug_chambre: { slug, chambre },
      },
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

  async getGroupeVotingStats(chambre: Chambre, slug: string) {
    const cacheKey = `groupe:voting-stats:${chambre}:${slug}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findUnique({
      where: {
        slug_chambre: { slug, chambre },
      },
      select: { id: true, statsCohesion: true },
    });

    if (!groupe) return null;

    // Requête SQL optimisée: agrège tous les votes du groupe en UNE seule requête
    const votesAggregation = await this.prisma.$queryRaw<
      { position: string; count: bigint }[]
    >`
      SELECT v.position, COUNT(*) as count
      FROM votes v
      JOIN parlementaires p ON v.parlementaire_id = p.id
      WHERE p.groupe_id = ${groupe.id}
        AND p.actif = true
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

    // Requête SQL optimisée: récupère les 10 derniers scrutins avec les votes du groupe EN UNE SEULE REQUÊTE
    const scrutinsWithVotes = await this.prisma.$queryRaw<
      {
        id: string;
        numero: number;
        titre: string;
        date: Date;
        sort: string;
        type_vote: string;
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
        SELECT DISTINCT s.id, s.numero, s.titre, s.date, s.sort, s.type_vote,
               s.nombre_pour, s.nombre_contre, s.nombre_abstention
        FROM scrutins s
        JOIN votes v ON v.scrutin_id = s.id
        JOIN parlementaires p ON v.parlementaire_id = p.id
        WHERE p.groupe_id = ${groupe.id}
          AND p.actif = true
          AND s.chambre = ${chambre}
        ORDER BY s.date DESC
        LIMIT 10
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
        JOIN parlementaires p ON v.parlementaire_id = p.id
        WHERE p.groupe_id = ${groupe.id}
          AND p.actif = true
        GROUP BY s.id
      )
      SELECT
        rs.id, rs.numero, rs.titre, rs.date, rs.sort, rs.type_vote,
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

    const groupe = await this.prisma.groupePolitique.findUnique({
      where: {
        slug_chambre: { slug, chambre },
      },
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

  async getGroupeThematiques(chambre: Chambre, slug: string) {
    const cacheKey = `groupe:thematiques:${chambre}:${slug}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const groupe = await this.prisma.groupePolitique.findUnique({
      where: {
        slug_chambre: { slug, chambre },
      },
      select: { id: true, nom: true, couleur: true },
    });

    if (!groupe) return null;

    // Récupérer les stats thématiques pré-calculées
    const thematiques = await this.prisma.groupeThematique.findMany({
      where: { groupeId: groupe.id },
      orderBy: { votesTotaux: 'desc' },
    });

    // Transformer pour le frontend (radar chart)
    const radarData = thematiques.map((t) => ({
      thematique: t.thematique,
      // Position de -100 (contre) à +100 (pour)
      position: t.positionMoyenne,
      // Cohésion interne du groupe sur ce thème (0-100)
      cohesion: t.cohesionMoyenne,
      // Stats brutes
      votesTotaux: t.votesTotaux,
      votesPour: t.votesPour,
      votesContre: t.votesContre,
      votesAbstention: t.votesAbstention,
    }));

    const result = {
      groupeId: groupe.id,
      groupeNom: groupe.nom,
      groupeCouleur: groupe.couleur,
      thematiques: radarData,
      calculatedAt: thematiques[0]?.calculatedAt ?? null,
    };

    await this.redis.setex(cacheKey, this.CACHE_TTL_LONG, JSON.stringify(result));

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
