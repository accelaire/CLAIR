// =============================================================================
// Embedding Generator - Génération d'embeddings pour les scrutins
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { HuggingFaceEmbeddingClient } from '../sources/huggingface/embedding-client';
import { buildEmbeddingText } from '../utils/text-cleaner';
import { logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_BATCH_SIZE = 10;
const EMBEDDING_DIMENSIONS = 768;

// =============================================================================
// TYPES
// =============================================================================

export interface GenerateEmbeddingsResult {
  total: number;
  generated: number;
  skipped: number;
  errors: number;
  duration: string;
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

const prisma = new PrismaClient();

/**
 * Génère les embeddings manquants pour les scrutins
 */
export async function generateMissingEmbeddings(options: {
  limit?: number;
  batchSize?: number;
  dryRun?: boolean;
} = {}): Promise<GenerateEmbeddingsResult> {
  const startTime = Date.now();
  const limit = options.limit || 200;
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const dryRun = options.dryRun || false;

  logger.info({ limit, batchSize, dryRun }, 'Starting embedding generation');

  // Trouver les scrutins sans embedding
  const scrutinsSansEmbedding = await prisma.scrutin.findMany({
    where: {
      embedding: null,
    },
    include: {
      dossier: {
        select: {
          titre: true,
          titreCourt: true,
        },
      },
    },
    orderBy: { date: 'desc' },
    take: limit,
  });

  if (scrutinsSansEmbedding.length === 0) {
    logger.info('No scrutins without embeddings found');
    return {
      total: 0,
      generated: 0,
      skipped: 0,
      errors: 0,
      duration: '0s',
    };
  }

  logger.info({ count: scrutinsSansEmbedding.length }, 'Found scrutins without embeddings');

  if (dryRun) {
    logger.info('Dry run mode - not generating embeddings');
    return {
      total: scrutinsSansEmbedding.length,
      generated: 0,
      skipped: scrutinsSansEmbedding.length,
      errors: 0,
      duration: '0s',
    };
  }

  // Initialiser le client HuggingFace
  let embeddingClient: HuggingFaceEmbeddingClient;
  try {
    embeddingClient = new HuggingFaceEmbeddingClient();
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to initialize embedding client');
    throw error;
  }

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  // Traiter par batches
  for (let i = 0; i < scrutinsSansEmbedding.length; i += batchSize) {
    const batch = scrutinsSansEmbedding.slice(i, i + batchSize);
    logger.info({
      batch: Math.floor(i / batchSize) + 1,
      total: Math.ceil(scrutinsSansEmbedding.length / batchSize),
      range: `${i + 1}-${Math.min(i + batchSize, scrutinsSansEmbedding.length)}`,
    }, 'Processing batch');

    for (const scrutin of batch) {
      try {
        // Construire le texte pour l'embedding
        const embeddingText = buildEmbeddingText({
          titre: scrutin.titre,
          objetLibelle: scrutin.objetLibelle,
          dossier: scrutin.dossier,
        });

        logger.debug({
          scrutinId: scrutin.id,
          numero: scrutin.numero,
          text: embeddingText.substring(0, 100),
        }, 'Generating embedding');

        // Générer l'embedding
        const embedding = await embeddingClient.embed(embeddingText);

        if (embedding.length !== EMBEDDING_DIMENSIONS) {
          logger.warn({
            scrutinId: scrutin.id,
            expected: EMBEDDING_DIMENSIONS,
            received: embedding.length,
          }, 'Unexpected embedding dimensions, skipping');
          skipped++;
          continue;
        }

        // Stocker l'embedding avec la colonne vectorielle
        await prisma.$executeRaw`
          INSERT INTO scrutins_embeddings (id, scrutin_id, embedding_vec, clustered, created_at)
          VALUES (
            gen_random_uuid(),
            ${scrutin.id},
            ${`[${embedding.join(',')}]`}::vector,
            false,
            NOW()
          )
          ON CONFLICT (scrutin_id) DO UPDATE SET
            embedding_vec = EXCLUDED.embedding_vec,
            clustered = false
        `;

        generated++;

        if (generated % 10 === 0) {
          logger.info({ generated, total: scrutinsSansEmbedding.length }, 'Progress');
        }
      } catch (error: any) {
        logger.error({
          scrutinId: scrutin.id,
          numero: scrutin.numero,
          error: error.message,
        }, 'Failed to generate embedding');
        errors++;
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

  logger.info({
    total: scrutinsSansEmbedding.length,
    generated,
    skipped,
    errors,
    duration,
  }, 'Embedding generation completed');

  return {
    total: scrutinsSansEmbedding.length,
    generated,
    skipped,
    errors,
    duration,
  };
}

/**
 * Régénère tous les embeddings (backfill)
 */
export async function regenerateAllEmbeddings(options: {
  batchSize?: number;
} = {}): Promise<GenerateEmbeddingsResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;

  logger.info('Starting full embedding regeneration');

  // Compter tous les scrutins
  const totalScrutins = await prisma.scrutin.count();
  logger.info({ total: totalScrutins }, 'Total scrutins to process');

  // Supprimer tous les embeddings existants
  await prisma.scrutinEmbedding.deleteMany({});
  logger.info('Cleared existing embeddings');

  // Traiter par pages
  let processed = 0;
  let errors = 0;

  const embeddingClient = new HuggingFaceEmbeddingClient();

  while (processed < totalScrutins) {
    const scrutins = await prisma.scrutin.findMany({
      include: {
        dossier: {
          select: {
            titre: true,
            titreCourt: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      skip: processed,
      take: batchSize,
    });

    if (scrutins.length === 0) break;

    for (const scrutin of scrutins) {
      try {
        const embeddingText = buildEmbeddingText({
          titre: scrutin.titre,
          objetLibelle: scrutin.objetLibelle,
          dossier: scrutin.dossier,
        });

        const embedding = await embeddingClient.embed(embeddingText);

        await prisma.$executeRaw`
          INSERT INTO scrutins_embeddings (id, scrutin_id, embedding_vec, clustered, created_at)
          VALUES (
            gen_random_uuid(),
            ${scrutin.id},
            ${`[${embedding.join(',')}]`}::vector,
            false,
            NOW()
          )
        `;

        processed++;

        if (processed % 50 === 0) {
          logger.info({ processed, total: totalScrutins }, 'Regeneration progress');
        }
      } catch (error: any) {
        logger.error({ scrutinId: scrutin.id, error: error.message }, 'Failed to generate embedding');
        errors++;
        processed++; // Count as processed even if failed
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

  logger.info({
    total: totalScrutins,
    generated: processed - errors,
    errors,
    duration,
  }, 'Full embedding regeneration completed');

  return {
    total: totalScrutins,
    generated: processed - errors,
    skipped: 0,
    errors,
    duration,
  };
}

/**
 * Vérifie l'état des embeddings
 */
export async function checkEmbeddingsStatus(): Promise<{
  totalScrutins: number;
  withEmbedding: number;
  withoutEmbedding: number;
  clustered: number;
  pending: number;
}> {
  const [totalScrutins, withEmbedding, clustered] = await Promise.all([
    prisma.scrutin.count(),
    prisma.scrutinEmbedding.count(),
    prisma.scrutinEmbedding.count({ where: { clustered: true } }),
  ]);

  return {
    totalScrutins,
    withEmbedding,
    withoutEmbedding: totalScrutins - withEmbedding,
    clustered,
    pending: withEmbedding - clustered,
  };
}

export default {
  generateMissingEmbeddings,
  regenerateAllEmbeddings,
  checkEmbeddingsStatus,
};
