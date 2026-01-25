// =============================================================================
// Cluster Manager - Gestion des sujets et clustering des scrutins
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { HuggingFaceEmbeddingClient } from '../sources/huggingface/embedding-client';
import { detectBudgetPattern, extractYearFromTitles, slugify } from '../utils/text-cleaner';
import { logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION - Seuils ajustés pour éviter la fragmentation
// =============================================================================

const SIMILARITY_THRESHOLD = 0.70;  // Assigner au cluster existant (baissé pour regrouper plus)
const MERGE_THRESHOLD = 0.80;       // Fusionner clusters similaires (baissé pour merger plus)
const MIN_CLUSTER_SIZE = 5;         // Minimum scrutins par cluster (baissé pour petits sujets)

const EMBEDDING_DIMENSIONS = 768;

// =============================================================================
// TYPES
// =============================================================================

export interface AssignmentResult {
  total: number;
  assigned: number;
  skipped: number;
  errors: number;
  duration: string;
}

export interface ClusterDetectionResult {
  total: number;
  newClusters: number;
  merged: number;
  pending: number;
  duration: string;
}

interface EmbeddingWithScrutin {
  id: string;
  scrutinId: string;
  embeddingVec: number[];
  scrutin: {
    id: string;
    titre: string;
    date: Date;
  };
}

interface SujetWithCentroid {
  id: string;
  slug: string;
  label: string;
  centroidVec: number[];
}

// =============================================================================
// DATABASE CLIENT
// =============================================================================

const prisma = new PrismaClient();

// =============================================================================
// ASSIGNMENT TO EXISTING SUJETS
// =============================================================================

/**
 * Assigne les embeddings pending aux sujets existants basé sur la similarité
 */
export async function assignToExistingSujets(options: {
  limit?: number;
  dryRun?: boolean;
} = {}): Promise<AssignmentResult> {
  const startTime = Date.now();
  const limit = options.limit || 500;
  const dryRun = options.dryRun || false;

  logger.info({ limit, dryRun }, 'Starting assignment to existing sujets');

  // Récupérer les embeddings non clusterés
  const pendingEmbeddings = await prisma.$queryRaw<Array<{
    id: string;
    scrutin_id: string;
    embedding_vec: string;
  }>>`
    SELECT e.id, e.scrutin_id, e.embedding_vec::text
    FROM scrutins_embeddings e
    WHERE e.clustered = false
      AND e.embedding_vec IS NOT NULL
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `;

  if (pendingEmbeddings.length === 0) {
    logger.info('No pending embeddings to assign');
    return {
      total: 0,
      assigned: 0,
      skipped: 0,
      errors: 0,
      duration: '0s',
    };
  }

  logger.info({ count: pendingEmbeddings.length }, 'Found pending embeddings');

  // Récupérer les sujets actifs avec centroïdes
  const sujets = await prisma.$queryRaw<Array<{
    id: string;
    slug: string;
    label: string;
    centroid_vec: string;
  }>>`
    SELECT id, slug, label, centroid_vec::text
    FROM sujets
    WHERE actif = true
      AND centroid_vec IS NOT NULL
  `;

  if (sujets.length === 0) {
    logger.info('No sujets with centroids found, all embeddings remain pending');
    return {
      total: pendingEmbeddings.length,
      assigned: 0,
      skipped: pendingEmbeddings.length,
      errors: 0,
      duration: ((Date.now() - startTime) / 1000).toFixed(2) + 's',
    };
  }

  logger.info({ count: sujets.length }, 'Found active sujets');

  // Parser les centroïdes
  const sujetsWithCentroids: SujetWithCentroid[] = sujets.map(s => ({
    id: s.id,
    slug: s.slug,
    label: s.label,
    centroidVec: parseVectorString(s.centroid_vec),
  }));

  let assigned = 0;
  let skipped = 0;
  let errors = 0;

  for (const emb of pendingEmbeddings) {
    try {
      const embeddingVec = parseVectorString(emb.embedding_vec);

      // Trouver le sujet le plus proche
      let bestSujet: SujetWithCentroid | null = null;
      let bestSimilarity = 0;

      for (const sujet of sujetsWithCentroids) {
        const similarity = HuggingFaceEmbeddingClient.cosineSimilarity(embeddingVec, sujet.centroidVec);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestSujet = sujet;
        }
      }

      if (bestSujet && bestSimilarity >= SIMILARITY_THRESHOLD) {
        if (!dryRun) {
          // Créer le lien scrutin-sujet
          await prisma.$executeRaw`
            INSERT INTO scrutins_sujets (id, scrutin_id, sujet_id, similarity, auto, created_at)
            VALUES (gen_random_uuid(), ${emb.scrutin_id}, ${bestSujet.id}, ${bestSimilarity}, true, NOW())
            ON CONFLICT (scrutin_id, sujet_id) DO UPDATE SET
              similarity = EXCLUDED.similarity
          `;

          // Marquer l'embedding comme clusteré
          await prisma.$executeRaw`
            UPDATE scrutins_embeddings
            SET clustered = true, sujet_id = ${bestSujet.id}
            WHERE id = ${emb.id}
          `;

          // Mettre à jour le compteur du sujet
          await prisma.$executeRaw`
            UPDATE sujets
            SET member_count = member_count + 1,
                updated_at = NOW()
            WHERE id = ${bestSujet.id}
          `;
        }

        assigned++;
        logger.debug({
          scrutinId: emb.scrutin_id,
          sujetSlug: bestSujet.slug,
          similarity: bestSimilarity.toFixed(3),
        }, 'Assigned to sujet');
      } else {
        skipped++;
        logger.debug({
          scrutinId: emb.scrutin_id,
          bestSimilarity: bestSimilarity.toFixed(3),
        }, 'No sujet above threshold');
      }
    } catch (error: any) {
      logger.error({
        embeddingId: emb.id,
        error: error.message,
      }, 'Failed to process embedding');
      errors++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

  logger.info({
    total: pendingEmbeddings.length,
    assigned,
    skipped,
    errors,
    duration,
  }, 'Assignment completed');

  return {
    total: pendingEmbeddings.length,
    assigned,
    skipped,
    errors,
    duration,
  };
}

// =============================================================================
// CLUSTER DETECTION (SIMPLIFIED HDBSCAN ALTERNATIVE)
// =============================================================================

/**
 * Détecte de nouveaux clusters parmi les embeddings pending
 * Utilise un algorithme simple de clustering hiérarchique
 */
export async function detectNewClusters(options: {
  minClusterSize?: number;
  dryRun?: boolean;
} = {}): Promise<ClusterDetectionResult> {
  const startTime = Date.now();
  const minClusterSize = options.minClusterSize || MIN_CLUSTER_SIZE;
  const dryRun = options.dryRun || false;

  logger.info({ minClusterSize, dryRun }, 'Starting cluster detection');

  // Récupérer tous les embeddings non clusterés
  const pendingEmbeddings = await prisma.$queryRaw<Array<{
    id: string;
    scrutin_id: string;
    embedding_vec: string;
  }>>`
    SELECT e.id, e.scrutin_id, e.embedding_vec::text
    FROM scrutins_embeddings e
    WHERE e.clustered = false
      AND e.embedding_vec IS NOT NULL
  `;

  if (pendingEmbeddings.length < minClusterSize) {
    logger.info({ pending: pendingEmbeddings.length, minRequired: minClusterSize },
      'Not enough pending embeddings for clustering');
    return {
      total: pendingEmbeddings.length,
      newClusters: 0,
      merged: 0,
      pending: pendingEmbeddings.length,
      duration: '0s',
    };
  }

  logger.info({ count: pendingEmbeddings.length }, 'Found pending embeddings for clustering');

  // Récupérer les titres des scrutins pour l'analyse des patterns
  const scrutinIds = pendingEmbeddings.map(e => e.scrutin_id);
  const scrutins = await prisma.scrutin.findMany({
    where: { id: { in: scrutinIds } },
    select: { id: true, titre: true, date: true },
  });
  const scrutinsMap = new Map(scrutins.map(s => [s.id, s]));

  // Parser les embeddings
  const embeddingsWithData: EmbeddingWithScrutin[] = pendingEmbeddings
    .filter(e => scrutinsMap.has(e.scrutin_id))
    .map(e => ({
      id: e.id,
      scrutinId: e.scrutin_id,
      embeddingVec: parseVectorString(e.embedding_vec),
      scrutin: scrutinsMap.get(e.scrutin_id)!,
    }));

  // Simple greedy clustering
  const clusters: EmbeddingWithScrutin[][] = [];
  const assigned = new Set<string>();

  for (const emb of embeddingsWithData) {
    if (assigned.has(emb.id)) continue;

    // Chercher un cluster existant où cet embedding s'intègre
    let addedToCluster = false;
    for (const cluster of clusters) {
      const centroid = calculateClusterCentroid(cluster);
      const similarity = HuggingFaceEmbeddingClient.cosineSimilarity(emb.embeddingVec, centroid);

      if (similarity >= SIMILARITY_THRESHOLD) {
        cluster.push(emb);
        assigned.add(emb.id);
        addedToCluster = true;
        break;
      }
    }

    // Sinon, créer un nouveau cluster
    if (!addedToCluster) {
      const newCluster = [emb];
      assigned.add(emb.id);

      // Chercher d'autres embeddings similaires
      for (const other of embeddingsWithData) {
        if (assigned.has(other.id)) continue;

        const similarity = HuggingFaceEmbeddingClient.cosineSimilarity(emb.embeddingVec, other.embeddingVec);
        if (similarity >= SIMILARITY_THRESHOLD) {
          newCluster.push(other);
          assigned.add(other.id);
        }
      }

      clusters.push(newCluster);
    }
  }

  logger.info({ clustersFound: clusters.length }, 'Initial clusters detected');

  // Filtrer les clusters trop petits
  const validClusters = clusters.filter(c => c.length >= minClusterSize);
  logger.info({ validClusters: validClusters.length }, 'Valid clusters after size filter');

  // Récupérer les sujets existants pour vérifier les doublons
  const existingSujets = await prisma.$queryRaw<Array<{
    id: string;
    slug: string;
    centroid_vec: string;
  }>>`
    SELECT id, slug, centroid_vec::text
    FROM sujets
    WHERE actif = true AND centroid_vec IS NOT NULL
  `;

  const existingSujetsWithCentroids = existingSujets.map(s => ({
    id: s.id,
    slug: s.slug,
    centroidVec: parseVectorString(s.centroid_vec),
  }));

  let newClusters = 0;
  let merged = 0;

  for (const cluster of validClusters) {
    const centroid = calculateClusterCentroid(cluster);
    const titres = cluster.map(e => e.scrutin.titre);

    // Vérifier si le cluster doit être fusionné avec un sujet existant
    let shouldMerge = false;
    let mergeSujetId: string | null = null;

    for (const sujet of existingSujetsWithCentroids) {
      const similarity = HuggingFaceEmbeddingClient.cosineSimilarity(centroid, sujet.centroidVec);

      if (similarity >= MERGE_THRESHOLD) {
        // Vérifier les patterns budget avant de fusionner
        const budgetPattern = detectBudgetPattern(titres);

        if (budgetPattern.type && budgetPattern.year) {
          // Si c'est un budget avec une année spécifique, ne pas fusionner automatiquement
          logger.info({
            budgetType: budgetPattern.type,
            year: budgetPattern.year,
            sujetSlug: sujet.slug,
          }, 'Budget pattern detected, checking year compatibility');

          // Vérifier si le sujet existant a la même année
          if (!sujet.slug.includes(budgetPattern.year)) {
            continue; // Ne pas fusionner, années différentes
          }
        }

        shouldMerge = true;
        mergeSujetId = sujet.id;
        break;
      }
    }

    if (shouldMerge && mergeSujetId) {
      // Fusionner avec le sujet existant
      if (!dryRun) {
        for (const emb of cluster) {
          await prisma.$executeRaw`
            INSERT INTO scrutins_sujets (id, scrutin_id, sujet_id, similarity, auto, created_at)
            VALUES (gen_random_uuid(), ${emb.scrutinId}, ${mergeSujetId}, ${MERGE_THRESHOLD}, true, NOW())
            ON CONFLICT (scrutin_id, sujet_id) DO NOTHING
          `;

          await prisma.$executeRaw`
            UPDATE scrutins_embeddings
            SET clustered = true, sujet_id = ${mergeSujetId}
            WHERE id = ${emb.id}
          `;
        }

        // Mettre à jour le centroïde du sujet
        await updateSujetCentroid(mergeSujetId);
      }

      merged++;
      logger.info({ sujetId: mergeSujetId, clusterSize: cluster.length }, 'Merged cluster with existing sujet');
    } else {
      // Créer un nouveau sujet
      if (!dryRun) {
        const newSujetId = await createNewSujetFromCluster(cluster, centroid);
        if (newSujetId) {
          newClusters++;
          logger.info({ sujetId: newSujetId, clusterSize: cluster.length }, 'Created new sujet from cluster');
        }
      } else {
        newClusters++;
        logger.info({ clusterSize: cluster.length, titresSample: titres.slice(0, 3) },
          'Would create new sujet (dry run)');
      }
    }
  }

  // Compter les embeddings restants non assignés
  const stillPending = embeddingsWithData.length -
    validClusters.reduce((sum, c) => sum + c.length, 0);

  // Auto-merge des sujets similaires après création
  if (!dryRun && newClusters > 0) {
    logger.info('Running auto-merge after cluster creation...');
    const mergeResult = await mergeSimilarSujets({ threshold: MERGE_THRESHOLD, dryRun: false });
    merged += mergeResult.merged;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

  logger.info({
    total: embeddingsWithData.length,
    newClusters,
    merged,
    pending: stillPending,
    duration,
  }, 'Cluster detection completed');

  return {
    total: embeddingsWithData.length,
    newClusters,
    merged,
    pending: stillPending,
    duration,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse une chaîne vector PostgreSQL en tableau de nombres
 */
function parseVectorString(vecStr: string): number[] {
  // Format: "[0.1,0.2,...]" ou "0.1,0.2,..."
  const clean = vecStr.replace(/^\[|\]$/g, '');
  return clean.split(',').map(s => parseFloat(s.trim()));
}

/**
 * Calcule le centroïde d'un cluster
 */
function calculateClusterCentroid(cluster: EmbeddingWithScrutin[]): number[] {
  const embeddings = cluster.map(e => e.embeddingVec);
  return HuggingFaceEmbeddingClient.calculateCentroid(embeddings);
}

/**
 * Crée un nouveau sujet à partir d'un cluster
 * Génère un slug temporaire qui sera remplacé par le label generator
 */
async function createNewSujetFromCluster(
  cluster: EmbeddingWithScrutin[],
  centroid: number[]
): Promise<string | null> {
  try {
    const titres = cluster.map(e => e.scrutin.titre);
    const dates = cluster.map(e => e.scrutin.date);

    // Détecter le pattern budget pour le slug
    const budgetPattern = detectBudgetPattern(titres);
    let tempSlug: string;

    if (budgetPattern.type && budgetPattern.year) {
      tempSlug = `cluster-${budgetPattern.type.toLowerCase()}-${budgetPattern.year}`;
    } else {
      tempSlug = `cluster-${Date.now()}`;
    }

    // Vérifier l'unicité du slug
    const existing = await prisma.sujet.findUnique({ where: { slug: tempSlug } });
    if (existing) {
      tempSlug = `${tempSlug}-${Math.random().toString(36).substring(7)}`;
    }

    // Créer le sujet avec un label temporaire
    const sujet = await prisma.sujet.create({
      data: {
        slug: tempSlug,
        label: `Cluster temporaire (${cluster.length} scrutins)`,
        description: null,
        memberCount: cluster.length,
        dateDebut: new Date(Math.min(...dates.map(d => d.getTime()))),
        dateFin: new Date(Math.max(...dates.map(d => d.getTime()))),
        actif: true,
        featured: false,
      },
    });

    // Stocker le centroïde
    await prisma.$executeRaw`
      UPDATE sujets
      SET centroid_vec = ${`[${centroid.join(',')}]`}::vector
      WHERE id = ${sujet.id}
    `;

    // Lier les scrutins
    for (const emb of cluster) {
      const similarity = HuggingFaceEmbeddingClient.cosineSimilarity(emb.embeddingVec, centroid);

      await prisma.$executeRaw`
        INSERT INTO scrutins_sujets (id, scrutin_id, sujet_id, similarity, auto, created_at)
        VALUES (gen_random_uuid(), ${emb.scrutinId}, ${sujet.id}, ${similarity}, true, NOW())
        ON CONFLICT (scrutin_id, sujet_id) DO NOTHING
      `;

      await prisma.$executeRaw`
        UPDATE scrutins_embeddings
        SET clustered = true, sujet_id = ${sujet.id}
        WHERE id = ${emb.id}
      `;
    }

    return sujet.id;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to create sujet from cluster');
    return null;
  }
}

/**
 * Met à jour le centroïde d'un sujet en recalculant à partir de tous ses membres
 */
async function updateSujetCentroid(sujetId: string): Promise<void> {
  try {
    // Récupérer tous les embeddings liés à ce sujet
    const embeddings = await prisma.$queryRaw<Array<{ embedding_vec: string }>>`
      SELECT e.embedding_vec::text
      FROM scrutins_embeddings e
      WHERE e.sujet_id = ${sujetId}
        AND e.embedding_vec IS NOT NULL
    `;

    if (embeddings.length === 0) return;

    const vectors = embeddings.map(e => parseVectorString(e.embedding_vec));
    const newCentroid = HuggingFaceEmbeddingClient.calculateCentroid(vectors);

    await prisma.$executeRaw`
      UPDATE sujets
      SET centroid_vec = ${`[${newCentroid.join(',')}]`}::vector,
          member_count = ${embeddings.length},
          updated_at = NOW()
      WHERE id = ${sujetId}
    `;

    logger.debug({ sujetId, memberCount: embeddings.length }, 'Updated sujet centroid');
  } catch (error: any) {
    logger.error({ sujetId, error: error.message }, 'Failed to update sujet centroid');
  }
}

/**
 * Recalcule tous les centroïdes des sujets
 */
export async function recalculateAllCentroids(): Promise<void> {
  logger.info('Recalculating all sujet centroids');

  const sujets = await prisma.sujet.findMany({
    where: { actif: true },
    select: { id: true },
  });

  for (const sujet of sujets) {
    await updateSujetCentroid(sujet.id);
  }

  logger.info({ count: sujets.length }, 'Finished recalculating centroids');
}

// =============================================================================
// MERGE SIMILAR SUJETS
// =============================================================================

export interface MergeResult {
  total: number;
  merged: number;
  kept: number;
  duration: string;
}

/**
 * Fusionne les sujets similaires post-labeling
 * Garde le sujet avec le plus de membres et absorbe les autres
 */
export async function mergeSimilarSujets(options: {
  threshold?: number;
  dryRun?: boolean;
} = {}): Promise<MergeResult> {
  const startTime = Date.now();
  const threshold = options.threshold || MERGE_THRESHOLD;
  const dryRun = options.dryRun || false;

  logger.info({ threshold, dryRun }, 'Starting merge of similar sujets');

  // Récupérer tous les sujets actifs avec centroïdes
  const sujets = await prisma.$queryRaw<Array<{
    id: string;
    slug: string;
    label: string;
    member_count: number;
    centroid_vec: string;
  }>>`
    SELECT id, slug, label, member_count, centroid_vec::text
    FROM sujets
    WHERE actif = true AND centroid_vec IS NOT NULL
    ORDER BY member_count DESC
  `;

  if (sujets.length < 2) {
    logger.info('Not enough sujets to merge');
    return { total: sujets.length, merged: 0, kept: sujets.length, duration: '0s' };
  }

  logger.info({ count: sujets.length }, 'Found sujets for merge analysis');

  // Parser les centroïdes
  const sujetsWithCentroids = sujets.map(s => ({
    ...s,
    centroidVec: parseVectorString(s.centroid_vec),
  }));

  // Trouver les paires à fusionner
  const toMerge: Array<{ keep: typeof sujetsWithCentroids[0]; absorb: typeof sujetsWithCentroids[0]; similarity: number }> = [];
  const absorbed = new Set<string>();

  for (let i = 0; i < sujetsWithCentroids.length; i++) {
    const sujetA = sujetsWithCentroids[i];
    if (absorbed.has(sujetA.id)) continue;

    for (let j = i + 1; j < sujetsWithCentroids.length; j++) {
      const sujetB = sujetsWithCentroids[j];
      if (absorbed.has(sujetB.id)) continue;

      const similarity = HuggingFaceEmbeddingClient.cosineSimilarity(
        sujetA.centroidVec,
        sujetB.centroidVec
      );

      // Extraire année et type budget des slugs
      const yearA = extractYearFromSlug(sujetA.slug);
      const yearB = extractYearFromSlug(sujetB.slug);
      const budgetTypeA = extractBudgetType(sujetA.slug);
      const budgetTypeB = extractBudgetType(sujetB.slug);

      // Années différentes = jamais merger
      if (yearA && yearB && yearA !== yearB) {
        continue;
      }

      // Seuil adaptatif : plus bas pour les budgets de même année
      const isSameBudgetYear = yearA && yearB && yearA === yearB && budgetTypeA && budgetTypeB;
      const effectiveThreshold = isSameBudgetYear ? 0.70 : threshold;

      if (similarity >= effectiveThreshold) {
        // Le sujet avec plus de membres est gardé
        const [keep, absorb] = sujetA.member_count >= sujetB.member_count
          ? [sujetA, sujetB]
          : [sujetB, sujetA];

        toMerge.push({ keep, absorb, similarity });
        absorbed.add(absorb.id);

        logger.info({
          keepSlug: keep.slug,
          absorbSlug: absorb.slug,
          keepCount: keep.member_count,
          absorbCount: absorb.member_count,
          similarity: similarity.toFixed(3),
          effectiveThreshold,
        }, 'Will merge sujets');
      }
    }
  }

  if (toMerge.length === 0) {
    logger.info('No similar sujets found to merge');
    return { total: sujets.length, merged: 0, kept: sujets.length, duration: '0s' };
  }

  let merged = 0;

  if (!dryRun) {
    for (const { keep, absorb } of toMerge) {
      try {
        // Transférer les liens scrutins_sujets
        await prisma.$executeRaw`
          UPDATE scrutins_sujets
          SET sujet_id = ${keep.id}
          WHERE sujet_id = ${absorb.id}
            AND scrutin_id NOT IN (
              SELECT scrutin_id FROM scrutins_sujets WHERE sujet_id = ${keep.id}
            )
        `;

        // Supprimer les doublons (scrutins déjà liés au sujet gardé)
        await prisma.$executeRaw`
          DELETE FROM scrutins_sujets
          WHERE sujet_id = ${absorb.id}
        `;

        // Mettre à jour les embeddings
        await prisma.$executeRaw`
          UPDATE scrutins_embeddings
          SET sujet_id = ${keep.id}
          WHERE sujet_id = ${absorb.id}
        `;

        // Désactiver le sujet absorbé
        await prisma.sujet.update({
          where: { id: absorb.id },
          data: { actif: false },
        });

        // Recalculer le centroïde du sujet gardé
        await updateSujetCentroid(keep.id);

        merged++;
        logger.info({
          keepSlug: keep.slug,
          absorbedSlug: absorb.slug,
        }, 'Merged sujets');

      } catch (error: any) {
        logger.error({
          keepId: keep.id,
          absorbId: absorb.id,
          error: error.message,
        }, 'Failed to merge sujets');
      }
    }
  } else {
    merged = toMerge.length;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
  const kept = sujets.length - merged;

  logger.info({
    total: sujets.length,
    merged,
    kept,
    duration,
  }, 'Merge completed');

  return { total: sujets.length, merged, kept, duration };
}

/**
 * Extrait l'année d'un slug (ex: "plf-2026" -> "2026")
 */
function extractYearFromSlug(slug: string): string | null {
  const match = slug.match(/\b(202[4-9]|203[0-9])\b/);
  return match ? match[1] : null;
}

/**
 * Extrait le type de budget d'un slug (plf, plfss, budget)
 */
function extractBudgetType(slug: string): string | null {
  if (slug.includes('plfss') || slug.includes('securite-sociale')) return 'plfss';
  if (slug.includes('plf') || slug.includes('budget')) return 'plf';
  return null;
}

export default {
  assignToExistingSujets,
  detectNewClusters,
  recalculateAllCentroids,
  mergeSimilarSujets,
};
