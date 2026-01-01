// =============================================================================
// Source Freshness Checker - Vérifie si une source a changé via ETag/Last-Modified
// =============================================================================

import axios from 'axios';
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export interface SourceConfig {
  source: string;
  dataType: string;
  url: string;
}

export interface FreshnessCheckResult {
  hasChanged: boolean;
  currentEtag: string | null;
  currentLastModified: Date | null;
  previousEtag: string | null;
  previousLastModified: Date | null;
  lastSyncAt: Date | null;
}

// =============================================================================
// SOURCES CONFIGURATION
// =============================================================================

const LEGISLATURE = process.env.ASSEMBLEE_NATIONALE_LEGISLATURE || '17';

export const SOURCES: Record<string, SourceConfig> = {
  // ==========================================================================
  // ASSEMBLÉE NATIONALE (Open Data)
  // ==========================================================================
  'assemblee_nationale:deputes': {
    source: 'assemblee_nationale',
    dataType: 'deputes',
    url: `https://data.assemblee-nationale.fr/static/openData/repository/${LEGISLATURE}/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip`,
  },
  'assemblee_nationale:scrutins': {
    source: 'assemblee_nationale',
    dataType: 'scrutins',
    url: `https://data.assemblee-nationale.fr/static/openData/repository/${LEGISLATURE}/loi/scrutins/Scrutins.json.zip`,
  },
  'assemblee_nationale:amendements': {
    source: 'assemblee_nationale',
    dataType: 'amendements',
    url: `https://data.assemblee-nationale.fr/static/openData/repository/${LEGISLATURE}/loi/amendements_div_legis/Amendements.json.zip`,
  },

  // ==========================================================================
  // SÉNAT (data.senat.fr + API)
  // ==========================================================================
  'senat:senateurs': {
    source: 'senat',
    dataType: 'senateurs',
    url: 'https://www.senat.fr/api-senat/senateurs.json',
  },
  'senat:scrutins': {
    source: 'senat',
    dataType: 'scrutins',
    // Page d'index des scrutins 2024 - on vérifie si elle change
    url: 'https://www.senat.fr/scrutin-public/scr2024.html',
  },
  'senat:amendements': {
    source: 'senat',
    dataType: 'amendements',
    // Base AMELI complète (~140MB)
    url: 'https://data.senat.fr/data/ameli/ameli.zip',
  },
  'senat:interventions': {
    source: 'senat',
    dataType: 'interventions',
    // Comptes rendus intégraux (~500MB)
    url: 'https://data.senat.fr/data/debats/cri.zip',
  },

  // ==========================================================================
  // DILA (Débats AN - echanges.dila.gouv.fr)
  // ==========================================================================
  'dila:interventions': {
    source: 'dila',
    dataType: 'interventions',
    // Index de l'année courante (fallback vers année précédente géré dans checkSourceFreshness)
    url: `https://echanges.dila.gouv.fr/OPENDATA/Debats/AN/${new Date().getFullYear()}/`,
  },

  // ==========================================================================
  // HATVP (Lobbying)
  // ==========================================================================
  'hatvp:lobbyistes': {
    source: 'hatvp',
    dataType: 'lobbyistes',
    url: 'https://www.hatvp.fr/agora/opendata/csv/Vues_Separees_CSV.zip',
  },
};

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Vérifie si une source a changé en utilisant les headers HTTP (ETag, Last-Modified)
 */
export async function checkSourceFreshness(
  sourceKey: string
): Promise<FreshnessCheckResult> {
  const config = SOURCES[sourceKey];
  if (!config) {
    throw new Error(`Unknown source: ${sourceKey}`);
  }

  const { source, dataType } = config;
  let url = config.url;

  // Récupérer l'état précédent
  const previousState = await prisma.sourceState.findUnique({
    where: { source_dataType: { source, dataType } },
  });

  // Faire une requête HEAD pour obtenir les headers
  let currentEtag: string | null = null;
  let currentLastModified: Date | null = null;

  try {
    let response = await axios.head(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
      },
    });

    currentEtag = response.headers['etag'] || null;
    const lastModHeader = response.headers['last-modified'];
    if (lastModHeader) {
      currentLastModified = new Date(lastModHeader);
      if (isNaN(currentLastModified.getTime())) {
        currentLastModified = null;
      }
    }

    logger.debug(
      { sourceKey, currentEtag, currentLastModified },
      'Source headers fetched'
    );
  } catch (error: any) {
    // Pour DILA: si 404 sur l'année courante, essayer l'année précédente
    if (
      sourceKey === 'dila:interventions' &&
      error.response?.status === 404
    ) {
      const previousYearUrl = url.replace(
        `/${new Date().getFullYear()}/`,
        `/${new Date().getFullYear() - 1}/`
      );
      logger.info(
        { sourceKey, fallbackUrl: previousYearUrl },
        'DILA current year not found, trying previous year...'
      );

      try {
        const fallbackResponse = await axios.head(previousYearUrl, {
          timeout: 30000,
          headers: {
            'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
          },
        });

        currentEtag = fallbackResponse.headers['etag'] || null;
        const lastModHeader = fallbackResponse.headers['last-modified'];
        if (lastModHeader) {
          currentLastModified = new Date(lastModHeader);
          if (isNaN(currentLastModified.getTime())) {
            currentLastModified = null;
          }
        }

        logger.debug(
          { sourceKey, currentEtag, currentLastModified, url: previousYearUrl },
          'Source headers fetched (fallback year)'
        );
      } catch (fallbackError: any) {
        logger.error(
          { sourceKey, error: fallbackError.message },
          'Failed to check source freshness (fallback also failed)'
        );
        return {
          hasChanged: true,
          currentEtag: null,
          currentLastModified: null,
          previousEtag: previousState?.lastEtag || null,
          previousLastModified: previousState?.lastModified || null,
          lastSyncAt: previousState?.lastSyncAt || null,
        };
      }
    } else {
      logger.error(
        { sourceKey, error: error.message },
        'Failed to check source freshness'
      );
      // En cas d'erreur, on considère que la source a changé (pour ne pas bloquer)
      return {
        hasChanged: true,
        currentEtag: null,
        currentLastModified: null,
        previousEtag: previousState?.lastEtag || null,
        previousLastModified: previousState?.lastModified || null,
        lastSyncAt: previousState?.lastSyncAt || null,
      };
    }
  }

  // Déterminer si la source a changé
  let hasChanged = true;

  if (previousState) {
    // Priorité à ETag si disponible
    if (currentEtag && previousState.lastEtag) {
      hasChanged = currentEtag !== previousState.lastEtag;
    }
    // Sinon utiliser Last-Modified
    else if (currentLastModified && previousState.lastModified) {
      hasChanged = currentLastModified.getTime() > previousState.lastModified.getTime();
    }
    // Si pas d'info, considérer comme changé
  }

  logger.info(
    {
      sourceKey,
      hasChanged,
      currentEtag,
      previousEtag: previousState?.lastEtag,
      currentLastModified,
      previousLastModified: previousState?.lastModified,
    },
    hasChanged ? 'Source has changed' : 'Source unchanged, skipping sync'
  );

  return {
    hasChanged,
    currentEtag,
    currentLastModified,
    previousEtag: previousState?.lastEtag || null,
    previousLastModified: previousState?.lastModified || null,
    lastSyncAt: previousState?.lastSyncAt || null,
  };
}

/**
 * Met à jour l'état d'une source après un sync réussi
 */
export async function updateSourceState(
  sourceKey: string,
  etag: string | null,
  lastModified: Date | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  const config = SOURCES[sourceKey];
  if (!config) {
    throw new Error(`Unknown source: ${sourceKey}`);
  }

  const { source, dataType, url } = config;
  const now = new Date();

  await prisma.sourceState.upsert({
    where: { source_dataType: { source, dataType } },
    create: {
      source,
      dataType,
      resourceUrl: url,
      lastEtag: etag,
      lastModified,
      lastSyncAt: now,
      lastCheckAt: now,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
    update: {
      resourceUrl: url,
      lastEtag: etag,
      lastModified,
      lastSyncAt: now,
      lastCheckAt: now,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  logger.debug({ sourceKey, etag, lastModified }, 'Source state updated');
}

/**
 * Met à jour uniquement la date de dernière vérification (quand pas de changement)
 */
export async function updateSourceCheckTime(sourceKey: string): Promise<void> {
  const config = SOURCES[sourceKey];
  if (!config) return;

  const { source, dataType } = config;

  await prisma.sourceState.updateMany({
    where: { source, dataType },
    data: { lastCheckAt: new Date() },
  });
}

/**
 * Récupère tous les états des sources
 */
export async function getAllSourceStates(): Promise<
  Array<{
    source: string;
    dataType: string;
    lastSyncAt: Date | null;
    lastModified: Date | null;
  }>
> {
  return prisma.sourceState.findMany({
    select: {
      source: true,
      dataType: true,
      lastSyncAt: true,
      lastModified: true,
    },
    orderBy: { source: 'asc' },
  });
}

/**
 * Vérifie toutes les sources et retourne celles qui ont changé
 */
export async function checkAllSourcesFreshness(): Promise<string[]> {
  const changedSources: string[] = [];

  for (const sourceKey of Object.keys(SOURCES)) {
    try {
      const result = await checkSourceFreshness(sourceKey);
      if (result.hasChanged) {
        changedSources.push(sourceKey);
      }
    } catch (error: any) {
      logger.error({ sourceKey, error: error.message }, 'Error checking source');
      // En cas d'erreur, on inclut la source pour ne pas bloquer
      changedSources.push(sourceKey);
    }
  }

  return changedSources;
}

export default {
  checkSourceFreshness,
  updateSourceState,
  updateSourceCheckTime,
  getAllSourceStates,
  checkAllSourcesFreshness,
  SOURCES,
};
