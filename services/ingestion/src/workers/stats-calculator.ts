// =============================================================================
// Stats Calculator - Calcul batch des statistiques parlementaires
// Exécuté après chaque ingestion pour pré-calculer les stats
// =============================================================================

import { PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Limiter les requêtes parallèles pour éviter la saturation du pool
const limit = pLimit(3);

export interface StatsCalculationResult {
  total: number;
  updated: number;
  errors: number;
  duration: string;
}

/**
 * Calcule et stocke les stats pour tous les parlementaires d'une chambre
 */
export async function calculateAllStats(
  chambre?: 'assemblee' | 'senat'
): Promise<StatsCalculationResult> {
  const startTime = Date.now();

  logger.info({ chambre: chambre || 'all' }, 'Starting stats calculation...');

  // Récupérer tous les parlementaires actifs
  const parlementaires = await prisma.parlementaire.findMany({
    where: {
      actif: true,
      ...(chambre && { chambre }),
    },
    select: { id: true, slug: true, chambre: true, groupeId: true },
  });

  let updated = 0;
  let errors = 0;

  // Pré-calculer les données globales pour éviter les requêtes répétées
  const globalData = await getGlobalData(chambre);

  // Traiter par batches avec concurrence limitée
  const results = await Promise.all(
    parlementaires.map((p) =>
      limit(async () => {
        try {
          await calculateAndStoreStats(p, globalData);
          return true;
        } catch (error: any) {
          logger.error({ parlementaire: p.slug, error: error.message }, 'Error calculating stats');
          return false;
        }
      })
    )
  );

  for (const success of results) {
    if (success) updated++;
    else errors++;
  }

  const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

  logger.info({
    total: parlementaires.length,
    updated,
    errors,
    duration,
  }, 'Stats calculation completed');

  return {
    total: parlementaires.length,
    updated,
    errors,
    duration,
  };
}

/**
 * Récupère les données globales nécessaires au calcul des stats
 * (évite de faire ces requêtes pour chaque parlementaire)
 */
async function getGlobalData(chambre?: 'assemblee' | 'senat') {
  // Nombre total de scrutins par chambre (pour calculer la présence)
  const scrutinCounts = await prisma.scrutin.groupBy({
    by: ['chambre'],
    _count: { id: true },
    where: chambre ? { chambre } : undefined,
  });

  const scrutinCountMap = new Map<string, number>();
  for (const sc of scrutinCounts) {
    scrutinCountMap.set(sc.chambre, sc._count.id);
  }

  // Nombre de scrutins solennels par chambre (pour calculer la présence solennelle)
  const scrutinSolennelCounts = await prisma.scrutin.groupBy({
    by: ['chambre'],
    _count: { id: true },
    where: {
      ...(chambre && { chambre }),
      typeVote: 'solennel',
    },
  });

  const scrutinSolennelCountMap = new Map<string, number>();
  for (const sc of scrutinSolennelCounts) {
    scrutinSolennelCountMap.set(sc.chambre, sc._count.id);
  }

  // Date du premier scrutin par chambre
  const oldestScrutins = await prisma.scrutin.groupBy({
    by: ['chambre'],
    _min: { date: true },
    where: chambre ? { chambre } : undefined,
  });

  const oldestScrutinDateMap = new Map<string, Date>();
  for (const os of oldestScrutins) {
    if (os._min.date) {
      oldestScrutinDateMap.set(os.chambre, os._min.date);
    }
  }

  return {
    scrutinCountMap,
    scrutinSolennelCountMap,
    oldestScrutinDateMap,
  };
}

/**
 * Calcule et stocke les stats pour un parlementaire
 */
async function calculateAndStoreStats(
  parlementaire: { id: string; slug: string; chambre: string; groupeId: string | null },
  globalData: Awaited<ReturnType<typeof getGlobalData>>
) {
  const { id, chambre, groupeId } = parlementaire;

  // Utiliser une seule requête SQL optimisée pour récupérer les counts
  const [voteCounts, voteSolennelCounts, interventionCounts, amendementCounts] = await Promise.all([
    // Votes: présence et participation (tous scrutins)
    prisma.vote.groupBy({
      by: ['position'],
      where: { parlementaireId: id },
      _count: { id: true },
    }),

    // Votes sur scrutins solennels uniquement (pour présence solennelle)
    prisma.vote.groupBy({
      by: ['position'],
      where: {
        parlementaireId: id,
        scrutin: { typeVote: 'solennel' },
      },
      _count: { id: true },
    }),

    // Interventions par type
    prisma.intervention.groupBy({
      by: ['type'],
      where: { parlementaireId: id },
      _count: { id: true },
    }),

    // Amendements par statut
    prisma.amendement.groupBy({
      by: ['sort'],
      where: { parlementaireId: id },
      _count: { id: true },
    }),
  ]);

  // Calculer présence (tous scrutins)
  const totalScrutins = globalData.scrutinCountMap.get(chambre) || 1;
  const votesNonAbsent = voteCounts
    .filter((v) => v.position !== 'absent')
    .reduce((sum, v) => sum + v._count.id, 0);
  const statsPresence = Math.round((votesNonAbsent / totalScrutins) * 100);

  // Calculer présence sur scrutins solennels uniquement
  const totalScrutinsSolennels = globalData.scrutinSolennelCountMap.get(chambre) || 0;
  const votesSolennelsNonAbsent = voteSolennelCounts
    .filter((v) => v.position !== 'absent')
    .reduce((sum, v) => sum + v._count.id, 0);
  const statsPresenceSolennel = totalScrutinsSolennels > 0
    ? Math.round((votesSolennelsNonAbsent / totalScrutinsSolennels) * 100)
    : null;

  // Participation (nombre de votes effectifs)
  const statsParticipation = votesNonAbsent;

  // Interventions et questions
  const statsInterventions = interventionCounts.reduce((sum, i) => sum + i._count.id, 0);
  const statsQuestions = interventionCounts
    .filter((i) => i.type === 'question')
    .reduce((sum, i) => sum + i._count.id, 0);

  // Amendements
  const statsAmendements = amendementCounts.reduce((sum, a) => sum + a._count.id, 0);
  const statsAmendementsAdoptes = amendementCounts
    .filter((a) => a.sort === 'Adopté' || a.sort === 'adopte' || a.sort === 'adopte_modifie')
    .reduce((sum, a) => sum + a._count.id, 0);

  // Loyauté (requête plus complexe - seulement si le parlementaire a un groupe)
  let statsLoyaute = 0;
  if (groupeId && votesNonAbsent > 0) {
    statsLoyaute = await calculateLoyaute(id, groupeId, chambre, globalData.oldestScrutinDateMap.get(chambre));
  }

  // Mettre à jour le parlementaire avec les stats pré-calculées
  await prisma.parlementaire.update({
    where: { id },
    data: {
      statsPresence,
      statsPresenceSolennel,
      statsLoyaute,
      statsParticipation,
      statsInterventions,
      statsAmendements,
      statsAmendementsAdoptes,
      statsQuestions,
      statsCalculatedAt: new Date(),
    },
  });
}

/**
 * Calcule le taux de loyauté d'un parlementaire envers son groupe
 * Utilise une requête SQL optimisée pour éviter de charger tous les votes en mémoire
 * Calculé sur TOUS les scrutins disponibles en base
 */
async function calculateLoyaute(
  parlementaireId: string,
  groupeId: string,
  chambre: string,
  since?: Date
): Promise<number> {
  // Utiliser la date du premier scrutin, ou une date très ancienne pour tout inclure
  const sinceDate = since || new Date('2000-01-01');

  // Requête SQL optimisée avec CTEs
  const result = await prisma.$queryRaw<{ loyal_count: bigint; total_count: bigint }[]>`
    WITH parlementaire_votes AS (
      SELECT v.id, v.position, v.scrutin_id
      FROM votes v
      JOIN scrutins s ON v.scrutin_id = s.id
      WHERE v.parlementaire_id = ${parlementaireId}
        AND v.position != 'absent'
        AND s.chambre = ${chambre}
        AND s.date >= ${sinceDate}
    ),
    group_majority AS (
      SELECT
        v.scrutin_id,
        v.position,
        COUNT(*) as vote_count,
        ROW_NUMBER() OVER (PARTITION BY v.scrutin_id ORDER BY COUNT(*) DESC) as rn
      FROM votes v
      JOIN parlementaires p ON v.parlementaire_id = p.id
      WHERE p.groupe_id = ${groupeId}
        AND v.position != 'absent'
      GROUP BY v.scrutin_id, v.position
    )
    SELECT
      COUNT(CASE WHEN pv.position = gm.position THEN 1 END)::bigint as loyal_count,
      COUNT(*)::bigint as total_count
    FROM parlementaire_votes pv
    LEFT JOIN group_majority gm ON pv.scrutin_id = gm.scrutin_id AND gm.rn = 1
  `;

  const { loyal_count, total_count } = result[0] || { loyal_count: 0n, total_count: 0n };

  if (total_count === 0n) return 0;

  return Math.round((Number(loyal_count) / Number(total_count)) * 100);
}

/**
 * Recalcule les stats pour un parlementaire spécifique
 * (utilisé pour invalidation ciblée)
 */
export async function recalculateStatsForParlementaire(parlementaireId: string): Promise<void> {
  const parlementaire = await prisma.parlementaire.findUnique({
    where: { id: parlementaireId },
    select: { id: true, slug: true, chambre: true, groupeId: true },
  });

  if (!parlementaire) {
    throw new Error(`Parlementaire not found: ${parlementaireId}`);
  }

  const globalData = await getGlobalData(parlementaire.chambre as 'assemblee' | 'senat');
  await calculateAndStoreStats(parlementaire, globalData);

  logger.info({ parlementaire: parlementaire.slug }, 'Stats recalculated for parlementaire');
}

/**
 * Invalide le cache des stats (force le recalcul au prochain appel)
 */
export async function invalidateStatsCache(chambre?: 'assemblee' | 'senat'): Promise<number> {
  const result = await prisma.parlementaire.updateMany({
    where: {
      actif: true,
      ...(chambre && { chambre }),
    },
    data: {
      statsCalculatedAt: null,
    },
  });

  logger.info({ count: result.count, chambre: chambre || 'all' }, 'Stats cache invalidated');
  return result.count;
}

// =============================================================================
// GROUPE STATS CALCULATION
// =============================================================================

export interface GroupeStatsResult {
  total: number;
  updated: number;
  errors: number;
  duration: string;
}

/**
 * Calcule et stocke les stats agrégées pour tous les groupes politiques
 * À appeler APRÈS calculateAllStats() pour bénéficier des stats individuelles
 */
export async function calculateAllGroupeStats(
  chambre?: 'assemblee' | 'senat'
): Promise<GroupeStatsResult> {
  const startTime = Date.now();

  logger.info({ chambre: chambre || 'all' }, 'Starting groupe stats calculation...');

  // Récupérer tous les groupes actifs
  const groupes = await prisma.groupePolitique.findMany({
    where: {
      actif: true,
      ...(chambre && { chambre }),
    },
    select: { id: true, slug: true, chambre: true },
  });

  let updated = 0;
  let errors = 0;

  // Traiter par batches avec concurrence limitée
  const results = await Promise.all(
    groupes.map((g) =>
      limit(async () => {
        try {
          await calculateAndStoreGroupeStats(g);
          return true;
        } catch (error: any) {
          logger.error({ groupe: g.slug, error: error.message }, 'Error calculating groupe stats');
          return false;
        }
      })
    )
  );

  for (const success of results) {
    if (success) updated++;
    else errors++;
  }

  const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

  logger.info({
    total: groupes.length,
    updated,
    errors,
    duration,
  }, 'Groupe stats calculation completed');

  return {
    total: groupes.length,
    updated,
    errors,
    duration,
  };
}

/**
 * Calcule et stocke les stats pour un groupe politique
 * Utilise les stats pré-calculées des parlementaires pour éviter les requêtes lourdes
 */
async function calculateAndStoreGroupeStats(
  groupe: { id: string; slug: string; chambre: string }
) {
  const { id, chambre } = groupe;

  // Agrégation des stats des membres actifs (utilise les stats déjà calculées)
  const memberStats = await prisma.parlementaire.aggregate({
    where: {
      groupeId: id,
      actif: true,
      statsCalculatedAt: { not: null },
    },
    _count: { id: true },
    _avg: {
      statsPresence: true,
      statsPresenceSolennel: true,
      statsLoyaute: true,
    },
    _sum: {
      statsParticipation: true,
    },
  });

  const statsMembresActifs = memberStats._count.id;
  const statsPresenceMoyenne = Math.round(memberStats._avg.statsPresence || 0);
  const statsPresenceSolennelMoyenne = memberStats._avg.statsPresenceSolennel != null
    ? Math.round(memberStats._avg.statsPresenceSolennel)
    : null;
  const statsLoyauteMoyenne = Math.round(memberStats._avg.statsLoyaute || 0);
  const statsParticipation = memberStats._sum.statsParticipation || 0;

  // Calculer la cohésion du groupe sur TOUS les scrutins
  const statsCohesion = await calculateGroupeCohesion(id, chambre);

  // Calculer l'agrégation des votes (pour le camembert)
  const votesAggregation = await calculateGroupeVotesAggregation(id);

  // Mettre à jour le groupe avec les stats pré-calculées
  await prisma.groupePolitique.update({
    where: { id },
    data: {
      statsMembresActifs,
      statsPresenceMoyenne,
      statsPresenceSolennelMoyenne,
      statsLoyauteMoyenne,
      statsCohesion,
      statsParticipation,
      statsVotesPour: votesAggregation.pour,
      statsVotesContre: votesAggregation.contre,
      statsVotesAbstention: votesAggregation.abstention,
      statsVotesAbsent: votesAggregation.absent,
      statsCalculatedAt: new Date(),
    },
  });
}

/**
 * Calcule la cohésion moyenne d'un groupe sur TOUS les scrutins
 * Cohésion = % du groupe votant avec la position majoritaire
 */
async function calculateGroupeCohesion(groupeId: string, chambre: string): Promise<number> {
  // Requête SQL optimisée pour calculer la cohésion sur TOUS les scrutins
  const result = await prisma.$queryRaw<{ avg_cohesion: number | null }[]>`
    WITH groupe_votes AS (
      SELECT
        v.scrutin_id,
        v.position,
        COUNT(*) as vote_count
      FROM votes v
      JOIN parlementaires p ON v.parlementaire_id = p.id
      JOIN scrutins s ON v.scrutin_id = s.id
      WHERE p.groupe_id = ${groupeId}
        AND s.chambre = ${chambre}
        AND v.position != 'absent'
      GROUP BY v.scrutin_id, v.position
    ),
    scrutin_cohesion AS (
      SELECT
        scrutin_id,
        MAX(vote_count) as majority_votes,
        SUM(vote_count) as total_votes
      FROM groupe_votes
      GROUP BY scrutin_id
    )
    SELECT
      COALESCE(AVG(CAST(majority_votes AS FLOAT) / NULLIF(total_votes, 0) * 100), 0) as avg_cohesion
    FROM scrutin_cohesion
  `;

  return Math.round(result[0]?.avg_cohesion || 0);
}

/**
 * Calcule l'agrégation des votes pour un groupe (pour le camembert)
 */
async function calculateGroupeVotesAggregation(groupeId: string): Promise<{
  pour: number;
  contre: number;
  abstention: number;
  absent: number;
}> {
  const result = await prisma.$queryRaw<{ position: string; count: bigint }[]>`
    SELECT v.position, COUNT(*) as count
    FROM votes v
    JOIN parlementaires p ON v.parlementaire_id = p.id
    WHERE p.groupe_id = ${groupeId}
    GROUP BY v.position
  `;

  const aggregation = { pour: 0, contre: 0, abstention: 0, absent: 0 };
  for (const r of result) {
    if (r.position in aggregation) {
      aggregation[r.position as keyof typeof aggregation] = Number(r.count);
    }
  }
  return aggregation;
}

// =============================================================================
// ALLIANCES CALCULATION
// =============================================================================

/**
 * Calcule et stocke les alliances entre TOUS les groupes d'une chambre
 * Exécuté après calculateAllGroupeStats()
 */
export async function calculateAllGroupeAlliances(
  chambre?: 'assemblee' | 'senat'
): Promise<{ total: number; duration: string }> {
  const startTime = Date.now();

  logger.info({ chambre: chambre || 'all' }, 'Starting groupe alliances calculation...');

  // Récupérer tous les groupes actifs
  const groupes = await prisma.groupePolitique.findMany({
    where: {
      actif: true,
      ...(chambre && { chambre }),
    },
    select: { id: true, slug: true, chambre: true },
  });

  // Pour chaque chambre, calculer les alliances entre groupes
  const chambreGroups = new Map<string, typeof groupes>();
  for (const g of groupes) {
    if (!chambreGroups.has(g.chambre)) {
      chambreGroups.set(g.chambre, []);
    }
    chambreGroups.get(g.chambre)!.push(g);
  }

  let totalPairs = 0;

  for (const [chambreKey, groupesInChambre] of chambreGroups) {
    // Calculer toutes les paires possibles
    for (let i = 0; i < groupesInChambre.length; i++) {
      for (let j = i + 1; j < groupesInChambre.length; j++) {
        const g1 = groupesInChambre[i];
        const g2 = groupesInChambre[j];

        try {
          await calculateAndStoreAlliance(g1.id, g2.id, chambreKey);
          totalPairs++;
        } catch (error: any) {
          logger.error({ g1: g1.slug, g2: g2.slug, error: error.message }, 'Error calculating alliance');
        }
      }
    }
  }

  const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
  logger.info({ totalPairs, duration }, 'Groupe alliances calculation completed');

  return { total: totalPairs, duration };
}

/**
 * Calcule l'alliance entre deux groupes
 */
async function calculateAndStoreAlliance(groupeId1: string, groupeId2: string, chambre: string): Promise<void> {
  // Requête SQL optimisée pour calculer le taux d'accord entre deux groupes
  // Compare la position majoritaire de chaque groupe sur chaque scrutin
  const result = await prisma.$queryRaw<{ votes_communs: bigint; votes_totaux: bigint }[]>`
    WITH groupe1_positions AS (
      SELECT
        v.scrutin_id,
        v.position,
        COUNT(*) as vote_count,
        ROW_NUMBER() OVER (PARTITION BY v.scrutin_id ORDER BY COUNT(*) DESC) as rn
      FROM votes v
      JOIN parlementaires p ON v.parlementaire_id = p.id
      JOIN scrutins s ON v.scrutin_id = s.id
      WHERE p.groupe_id = ${groupeId1}
        AND s.chambre = ${chambre}
        AND v.position != 'absent'
      GROUP BY v.scrutin_id, v.position
    ),
    groupe2_positions AS (
      SELECT
        v.scrutin_id,
        v.position,
        COUNT(*) as vote_count,
        ROW_NUMBER() OVER (PARTITION BY v.scrutin_id ORDER BY COUNT(*) DESC) as rn
      FROM votes v
      JOIN parlementaires p ON v.parlementaire_id = p.id
      JOIN scrutins s ON v.scrutin_id = s.id
      WHERE p.groupe_id = ${groupeId2}
        AND s.chambre = ${chambre}
        AND v.position != 'absent'
      GROUP BY v.scrutin_id, v.position
    ),
    comparaison AS (
      SELECT
        g1.scrutin_id,
        CASE WHEN g1.position = g2.position THEN 1 ELSE 0 END as accord
      FROM groupe1_positions g1
      JOIN groupe2_positions g2 ON g1.scrutin_id = g2.scrutin_id
      WHERE g1.rn = 1 AND g2.rn = 1
    )
    SELECT
      SUM(accord)::bigint as votes_communs,
      COUNT(*)::bigint as votes_totaux
    FROM comparaison
  `;

  const { votes_communs, votes_totaux } = result[0] || { votes_communs: 0n, votes_totaux: 0n };
  const tauxAccord = votes_totaux > 0n
    ? Math.round((Number(votes_communs) / Number(votes_totaux)) * 100)
    : 0;

  // Upsert les deux directions (g1->g2 et g2->g1) pour faciliter les requêtes
  await prisma.groupeAlliance.upsert({
    where: { groupeFromId_groupeToId: { groupeFromId: groupeId1, groupeToId: groupeId2 } },
    create: {
      groupeFromId: groupeId1,
      groupeToId: groupeId2,
      votesCommuns: Number(votes_communs),
      votesTotaux: Number(votes_totaux),
      tauxAccord,
      calculatedAt: new Date(),
    },
    update: {
      votesCommuns: Number(votes_communs),
      votesTotaux: Number(votes_totaux),
      tauxAccord,
      calculatedAt: new Date(),
    },
  });

  // Direction inverse
  await prisma.groupeAlliance.upsert({
    where: { groupeFromId_groupeToId: { groupeFromId: groupeId2, groupeToId: groupeId1 } },
    create: {
      groupeFromId: groupeId2,
      groupeToId: groupeId1,
      votesCommuns: Number(votes_communs),
      votesTotaux: Number(votes_totaux),
      tauxAccord,
      calculatedAt: new Date(),
    },
    update: {
      votesCommuns: Number(votes_communs),
      votesTotaux: Number(votes_totaux),
      tauxAccord,
      calculatedAt: new Date(),
    },
  });
}

// =============================================================================
// THEMATIC STATS CALCULATION
// =============================================================================

// Thématiques principales basées sur les tags existants des scrutins
const THEMATIQUES = [
  'budget',
  'fiscalité',
  'social',
  'travail',
  'santé',
  'éducation',
  'sécurité',
  'justice',
  'environnement',
  'europe',
  'international',
  'immigration',
  'institutions',
  'agriculture',
  'économie',
  'culture',
];

/**
 * Calcule et stocke les stats thématiques pour TOUS les groupes
 */
export async function calculateAllGroupeThematiques(
  chambre?: 'assemblee' | 'senat'
): Promise<{ total: number; duration: string }> {
  const startTime = Date.now();

  logger.info({ chambre: chambre || 'all' }, 'Starting groupe thematiques calculation...');

  const groupes = await prisma.groupePolitique.findMany({
    where: {
      actif: true,
      ...(chambre && { chambre }),
    },
    select: { id: true, slug: true, chambre: true },
  });

  let totalStats = 0;

  for (const groupe of groupes) {
    try {
      await calculateAndStoreGroupeThematiques(groupe.id, groupe.chambre);
      totalStats += THEMATIQUES.length;
    } catch (error: any) {
      logger.error({ groupe: groupe.slug, error: error.message }, 'Error calculating thematiques');
    }
  }

  const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
  logger.info({ totalStats, duration }, 'Groupe thematiques calculation completed');

  return { total: totalStats, duration };
}

/**
 * Calcule les stats thématiques pour un groupe
 */
async function calculateAndStoreGroupeThematiques(groupeId: string, chambre: string): Promise<void> {
  for (const thematique of THEMATIQUES) {
    // Requête SQL pour calculer les stats de vote sur cette thématique
    const result = await prisma.$queryRaw<{
      votes_totaux: bigint;
      votes_pour: bigint;
      votes_contre: bigint;
      votes_abstention: bigint;
      avg_cohesion: number | null;
    }[]>`
      WITH scrutins_theme AS (
        SELECT id
        FROM scrutins
        WHERE chambre = ${chambre}
          AND (
            ${thematique} = ANY(tags)
            OR LOWER(titre) LIKE ${`%${thematique}%`}
          )
      ),
      groupe_votes AS (
        SELECT
          v.scrutin_id,
          v.position,
          COUNT(*) as vote_count,
          ROW_NUMBER() OVER (PARTITION BY v.scrutin_id ORDER BY COUNT(*) DESC) as rn
        FROM votes v
        JOIN parlementaires p ON v.parlementaire_id = p.id
        WHERE p.groupe_id = ${groupeId}
          AND v.scrutin_id IN (SELECT id FROM scrutins_theme)
          AND v.position != 'absent'
        GROUP BY v.scrutin_id, v.position
      ),
      positions_majoritaires AS (
        SELECT scrutin_id, position, vote_count,
               (SELECT SUM(vote_count) FROM groupe_votes gv2 WHERE gv2.scrutin_id = gv.scrutin_id) as total_votes
        FROM groupe_votes gv
        WHERE rn = 1
      )
      SELECT
        COUNT(*)::bigint as votes_totaux,
        SUM(CASE WHEN position = 'pour' THEN 1 ELSE 0 END)::bigint as votes_pour,
        SUM(CASE WHEN position = 'contre' THEN 1 ELSE 0 END)::bigint as votes_contre,
        SUM(CASE WHEN position = 'abstention' THEN 1 ELSE 0 END)::bigint as votes_abstention,
        AVG(CAST(vote_count AS FLOAT) / NULLIF(total_votes, 0) * 100) as avg_cohesion
      FROM positions_majoritaires
    `;

    const stats = result[0] || {
      votes_totaux: 0n,
      votes_pour: 0n,
      votes_contre: 0n,
      votes_abstention: 0n,
      avg_cohesion: null,
    };

    const votesTotaux = Number(stats.votes_totaux);
    const votesPour = Number(stats.votes_pour);
    const votesContre = Number(stats.votes_contre);
    const votesAbstention = Number(stats.votes_abstention);

    // Position moyenne: +100 = toujours Pour, -100 = toujours Contre, 0 = neutre/abstention
    const positionMoyenne = votesTotaux > 0
      ? ((votesPour - votesContre) / votesTotaux) * 100
      : 0;

    const cohesionMoyenne = Math.round(stats.avg_cohesion || 0);

    // Upsert
    await prisma.groupeThematique.upsert({
      where: { groupeId_thematique: { groupeId, thematique } },
      create: {
        groupeId,
        thematique,
        votesTotaux,
        votesPour,
        votesContre,
        votesAbstention,
        positionMoyenne,
        cohesionMoyenne,
        calculatedAt: new Date(),
      },
      update: {
        votesTotaux,
        votesPour,
        votesContre,
        votesAbstention,
        positionMoyenne,
        cohesionMoyenne,
        calculatedAt: new Date(),
      },
    });
  }
}
