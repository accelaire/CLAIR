// =============================================================================
// Stats Calculator - Calcul batch des statistiques parlementaires
// Exécuté après chaque ingestion pour pré-calculer les stats
// =============================================================================

import { PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Pour la version legacy uniquement
const limit = pLimit(1);

export interface StatsCalculationResult {
  total: number;
  updated: number;
  errors: number;
  duration: string;
}

/**
 * Calcule et stocke les stats pour tous les parlementaires d'une chambre
 * VERSION OPTIMISÉE: Une seule requête SQL pour calculer toutes les stats
 */
export async function calculateAllStats(
  chambre?: 'assemblee' | 'senat'
): Promise<StatsCalculationResult> {
  const startTime = Date.now();
  // Pour le filtre SQL: si chambre est null, on matche tout
  const chambreFilter = chambre || '%';

  logger.info({ chambre: chambre || 'all' }, 'Starting stats calculation (SQL optimized)...');

  try {
    // Étape 1: Calculer les stats de base (présence, participation, interventions, amendements)
    // en une seule requête SQL massive avec CTEs
    logger.info('Calculating base stats (votes, interventions, amendments)...');

    const baseStatsUpdated = await prisma.$executeRaw`
      WITH scrutin_counts AS (
        SELECT chambre, COUNT(*) as total
        FROM scrutins
        WHERE chambre LIKE ${chambreFilter}
        GROUP BY chambre
      ),
      scrutin_solennel_counts AS (
        SELECT chambre, COUNT(*) as total
        FROM scrutins
        WHERE type_vote = 'solennel'
          AND chambre LIKE ${chambreFilter}
        GROUP BY chambre
      ),
      vote_stats AS (
        SELECT
          v.parlementaire_id,
          COUNT(*) FILTER (WHERE v.position != 'absent') as votes_non_absent,
          COUNT(*) FILTER (WHERE v.position != 'absent' AND s.type_vote = 'solennel') as votes_solennel_non_absent
        FROM votes v
        JOIN scrutins s ON v.scrutin_id = s.id
        WHERE s.chambre LIKE ${chambreFilter}
        GROUP BY v.parlementaire_id
      ),
      intervention_stats AS (
        SELECT
          i.parlementaire_id,
          COUNT(*) as total_interventions,
          COUNT(*) FILTER (WHERE i.type = 'question') as total_questions
        FROM interventions i
        WHERE i.chambre LIKE ${chambreFilter}
        GROUP BY i.parlementaire_id
      ),
      amendement_stats AS (
        SELECT
          a.parlementaire_id,
          COUNT(*) as total_amendements,
          COUNT(*) FILTER (WHERE a.sort IN ('Adopté', 'adopte', 'adopte_modifie')) as total_adoptes
        FROM amendements a
        WHERE a.chambre LIKE ${chambreFilter}
        GROUP BY a.parlementaire_id
      ),
      all_stats AS (
        SELECT
          p.id,
          CASE
            WHEN sc.total > 0 THEN ROUND((COALESCE(vs.votes_non_absent, 0)::float / sc.total) * 100)
            ELSE 0
          END as new_presence,
          CASE
            WHEN ssc.total > 0 THEN ROUND((COALESCE(vs.votes_solennel_non_absent, 0)::float / ssc.total) * 100)
            ELSE NULL
          END as new_presence_solennel,
          COALESCE(vs.votes_non_absent, 0) as new_participation,
          COALESCE(ist.total_interventions, 0) as new_interventions,
          COALESCE(ist.total_questions, 0) as new_questions,
          COALESCE(ast.total_amendements, 0) as new_amendements,
          COALESCE(ast.total_adoptes, 0) as new_adoptes
        FROM parlementaires p
        LEFT JOIN scrutin_counts sc ON sc.chambre = p.chambre
        LEFT JOIN scrutin_solennel_counts ssc ON ssc.chambre = p.chambre
        LEFT JOIN vote_stats vs ON vs.parlementaire_id = p.id
        LEFT JOIN intervention_stats ist ON ist.parlementaire_id = p.id
        LEFT JOIN amendement_stats ast ON ast.parlementaire_id = p.id
        WHERE p.actif = true
          AND p.chambre LIKE ${chambreFilter}
      )
      UPDATE parlementaires
      SET
        stats_presence = all_stats.new_presence,
        stats_presence_solennel = all_stats.new_presence_solennel,
        stats_participation = all_stats.new_participation,
        stats_interventions = all_stats.new_interventions,
        stats_questions = all_stats.new_questions,
        stats_amendements = all_stats.new_amendements,
        stats_amendements_adoptes = all_stats.new_adoptes,
        stats_calculated_at = NOW()
      FROM all_stats
      WHERE parlementaires.id = all_stats.id
    `;

    logger.info({ updated: baseStatsUpdated }, 'Base stats calculated');

    // Étape 2: Calculer la loyauté (requête plus complexe avec window functions)
    // Exécuté séparément car très lourd
    logger.info('Calculating loyalty stats...');

    const loyaltyUpdated = await prisma.$executeRaw`
      WITH group_majority_positions AS (
        SELECT
          v.scrutin_id,
          p.groupe_id,
          v.position,
          COUNT(*) as vote_count,
          ROW_NUMBER() OVER (PARTITION BY v.scrutin_id, p.groupe_id ORDER BY COUNT(*) DESC) as rn
        FROM votes v
        JOIN parlementaires p ON v.parlementaire_id = p.id
        JOIN scrutins s ON v.scrutin_id = s.id
        WHERE v.position != 'absent'
          AND p.groupe_id IS NOT NULL
          AND s.chambre LIKE ${chambreFilter}
        GROUP BY v.scrutin_id, p.groupe_id, v.position
      ),
      parlementaire_loyalty AS (
        SELECT
          v.parlementaire_id,
          COUNT(*) as total_votes,
          COUNT(*) FILTER (WHERE v.position = gmp.position) as loyal_votes
        FROM votes v
        JOIN parlementaires p ON v.parlementaire_id = p.id
        JOIN scrutins s ON v.scrutin_id = s.id
        LEFT JOIN group_majority_positions gmp
          ON gmp.scrutin_id = v.scrutin_id
          AND gmp.groupe_id = p.groupe_id
          AND gmp.rn = 1
        WHERE v.position != 'absent'
          AND p.groupe_id IS NOT NULL
          AND s.chambre LIKE ${chambreFilter}
        GROUP BY v.parlementaire_id
      )
      UPDATE parlementaires
      SET stats_loyaute = CASE
        WHEN pl.total_votes > 0 THEN ROUND((pl.loyal_votes::float / pl.total_votes) * 100)
        ELSE 0
      END
      FROM parlementaire_loyalty pl
      WHERE parlementaires.id = pl.parlementaire_id
        AND parlementaires.actif = true
        AND parlementaires.groupe_id IS NOT NULL
        AND parlementaires.chambre LIKE ${chambreFilter}
    `;

    logger.info({ updated: loyaltyUpdated }, 'Loyalty stats calculated');

    // Compter le total mis à jour
    const countResult = await prisma.parlementaire.count({
      where: {
        actif: true,
        statsCalculatedAt: { not: null },
        ...(chambre && { chambre }),
      },
    });

    const duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

    logger.info({
      total: countResult,
      updated: countResult,
      errors: 0,
      duration,
    }, 'Stats calculation completed');

    return {
      total: countResult,
      updated: countResult,
      errors: 0,
      duration,
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Stats calculation failed');
    throw error;
  }
}

/**
 * Version legacy avec batches (fallback si la version SQL pose problème)
 */
export async function calculateAllStatsLegacy(
  chambre?: 'assemblee' | 'senat'
): Promise<StatsCalculationResult> {
  const startTime = Date.now();
  const BATCH_SIZE = 20;

  logger.info({ chambre: chambre || 'all' }, 'Starting stats calculation (legacy batch mode)...');

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

  // Traiter par VRAIS batches pour éviter l'accumulation mémoire
  const totalBatches = Math.ceil(parlementaires.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, parlementaires.length);
    const batch = parlementaires.slice(batchStart, batchEnd);

    // Log progression tous les 5 batches ou au premier/dernier
    if (batchIndex === 0 || batchIndex === totalBatches - 1 || (batchIndex + 1) % 5 === 0) {
      logger.info({
        batch: batchIndex + 1,
        totalBatches,
        progress: `${Math.round(((batchIndex + 1) / totalBatches) * 100)}%`,
        processed: batchStart,
        total: parlementaires.length,
      }, 'Stats calculation progress');
    }

    const results = await Promise.all(
      batch.map((p) =>
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

    // Pause entre les batches pour laisser le GC respirer
    // Augmentée à 500ms pour réduire la pression mémoire
    if (batchIndex < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
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

  // Traiter séquentiellement avec logging (peu de groupes, pas besoin de parallélisme excessif)
  for (let i = 0; i < groupes.length; i++) {
    const g = groupes[i]!;
    try {
      logger.debug({ groupe: g.slug, progress: `${i + 1}/${groupes.length}` }, 'Calculating groupe stats');
      await calculateAndStoreGroupeStats(g);
      updated++;
    } catch (error: any) {
      logger.error({ groupe: g.slug, error: error.message }, 'Error calculating groupe stats');
      errors++;
    }
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
    const totalPairsInChambre = (groupesInChambre.length * (groupesInChambre.length - 1)) / 2;
    let processedInChambre = 0;

    logger.info({ chambre: chambreKey, pairs: totalPairsInChambre }, 'Starting alliances calculation for chambre');

    for (let i = 0; i < groupesInChambre.length; i++) {
      for (let j = i + 1; j < groupesInChambre.length; j++) {
        const g1 = groupesInChambre[i]!;
        const g2 = groupesInChambre[j]!;

        try {
          await calculateAndStoreAlliance(g1.id, g2.id, chambreKey);
          totalPairs++;
          processedInChambre++;

          // Log progression tous les 10 paires
          if (processedInChambre % 10 === 0) {
            logger.debug({
              chambre: chambreKey,
              progress: `${processedInChambre}/${totalPairsInChambre}`,
            }, 'Alliances progress');
          }
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
  const totalGroupes = groupes.length;

  for (let i = 0; i < groupes.length; i++) {
    const groupe = groupes[i]!;
    try {
      logger.debug({
        groupe: groupe.slug,
        progress: `${i + 1}/${totalGroupes}`,
        thematiques: THEMATIQUES.length,
      }, 'Calculating thematiques for groupe');

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
