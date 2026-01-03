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
  const [voteCounts, interventionCounts, amendementCounts] = await Promise.all([
    // Votes: présence et participation
    prisma.vote.groupBy({
      by: ['position'],
      where: { parlementaireId: id },
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

  // Calculer présence
  const totalScrutins = globalData.scrutinCountMap.get(chambre) || 1;
  const votesNonAbsent = voteCounts
    .filter((v) => v.position !== 'absent')
    .reduce((sum, v) => sum + v._count.id, 0);
  const statsPresence = Math.round((votesNonAbsent / totalScrutins) * 100);

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
 */
async function calculateLoyaute(
  parlementaireId: string,
  groupeId: string,
  chambre: string,
  since?: Date
): Promise<number> {
  const sinceDate = since || new Date('2022-01-01');

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
