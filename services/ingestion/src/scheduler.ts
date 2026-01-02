// =============================================================================
// Scheduler - Planification automatique des synchronisations
// =============================================================================

import cron, { ScheduledTask } from 'node-cron';
import { smartSync, syncScrutins, syncScrutinsSenat, syncLobbyistes, syncInterventions } from './workers/sync.js';
import { logger } from './utils/logger';

// =============================================================================
// CONFIGURATION DES HORAIRES
// =============================================================================

/**
 * Horaires de synchronisation (heure française - Europe/Paris)
 *
 * Note: Les sources sont mises à jour à des heures différentes:
 * - AN Députés: ~02:50 du matin
 * - HATVP: ~03:30 du matin
 * - AN Scrutins: après les séances (~18h-19h)
 * - Sénat: mise à jour continue en journée
 *
 * On planifie donc les syncs APRÈS ces heures pour avoir les données fraîches.
 */

export interface ScheduleConfig {
  // Cron expression (format: minute hour day month dayOfWeek)
  cron: string;
  // Description pour les logs
  description: string;
  // Fonction à exécuter
  handler: () => Promise<void>;
  // Actif par défaut
  enabled: boolean;
}

export const SCHEDULES: Record<string, ScheduleConfig> = {
  // Sync quotidien complet - 05:00 (après MAJ des sources vers 3-4h)
  dailySync: {
    cron: '0 5 * * *',
    description: 'Sync quotidien complet (toutes les sources)',
    enabled: true,
    handler: async () => {
      logger.info('Running daily sync (all sources)...');
      const result = await smartSync({
        all: true,
        scrutinsLimit: 50,
        amendementsLimit: 100,
      });
      logger.info({ result }, 'Daily sync completed');
    },
  },

  // Sync scrutins midi - 12:00
  midDayScrutins: {
    cron: '0 12 * * 1-5', // Lundi à vendredi seulement
    description: 'Sync scrutins récents (midi)',
    enabled: true,
    handler: async () => {
      logger.info('Running mid-day scrutins sync...');
      await syncScrutins({ limit: 20 });
      await syncScrutinsSenat({ limit: 10 });
      logger.info('Mid-day scrutins sync completed');
    },
  },

  // Sync scrutins soir - 19:00 (après les séances parlementaires)
  eveningScrutins: {
    cron: '0 19 * * 1-5', // Lundi à vendredi seulement
    description: 'Sync scrutins après séance (19h)',
    enabled: true,
    handler: async () => {
      logger.info('Running evening scrutins sync...');
      await syncScrutins({ limit: 30 });
      await syncScrutinsSenat({ limit: 15 });
      logger.info('Evening scrutins sync completed');
    },
  },

  // Sync lobbying hebdomadaire - Dimanche 04:00
  weeklyLobbying: {
    cron: '0 4 * * 0', // Dimanche à 04:00
    description: 'Sync lobbying hebdomadaire',
    enabled: true,
    handler: async () => {
      logger.info('Running weekly lobbying sync...');
      await syncLobbyistes({ limit: 1000, includeActions: true });
      logger.info('Weekly lobbying sync completed');
    },
  },

  // Sync interventions hebdomadaire - Samedi 03:00
  weeklyInterventions: {
    cron: '0 3 * * 6', // Samedi à 03:00
    description: 'Sync interventions hebdomadaire',
    enabled: true,
    handler: async () => {
      logger.info('Running weekly interventions sync...');
      await syncInterventions({ maxSeances: 50 });
      logger.info('Weekly interventions sync completed');
    },
  },
};

// =============================================================================
// SCHEDULER
// =============================================================================

const activeJobs: Map<string, ScheduledTask> = new Map();

/**
 * Démarre le scheduler avec tous les jobs configurés
 */
export async function startScheduler(): Promise<void> {
  logger.info('Starting scheduler...');

  // Configurer le timezone
  const timezone = process.env.TZ || 'Europe/Paris';

  for (const [name, config] of Object.entries(SCHEDULES)) {
    if (!config.enabled) {
      logger.info({ name }, 'Schedule disabled, skipping');
      continue;
    }

    // Valider l'expression cron
    if (!cron.validate(config.cron)) {
      logger.error({ name, cron: config.cron }, 'Invalid cron expression');
      continue;
    }

    const job = cron.schedule(
      config.cron,
      async () => {
        const startTime = Date.now();
        logger.info({ name, description: config.description }, 'Starting scheduled job');

        try {
          await config.handler();
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          logger.info({ name, duration: `${duration}s` }, 'Scheduled job completed');
        } catch (error: any) {
          logger.error({ name, error: error.message }, 'Scheduled job failed');
        }
      },
      {
        timezone,
      }
    );

    activeJobs.set(name, job);
    logger.info(
      { name, cron: config.cron, description: config.description, timezone },
      'Scheduled job registered'
    );
  }

  // Log le résumé
  logger.info(
    { activeJobs: activeJobs.size, timezone },
    'Scheduler started with all jobs'
  );

  // Afficher le prochain run de chaque job
  console.log('\n📅 Prochaines exécutions:');
  for (const [name, config] of Object.entries(SCHEDULES)) {
    if (config.enabled) {
      console.log(`  - ${name}: ${config.description}`);
      console.log(`    Cron: ${config.cron}`);
    }
  }
  console.log('');
}

/**
 * Arrête tous les jobs planifiés
 */
export function stopScheduler(): void {
  logger.info('Stopping scheduler...');

  for (const [name, job] of activeJobs) {
    job.stop();
    logger.info({ name }, 'Scheduled job stopped');
  }

  activeJobs.clear();
  logger.info('Scheduler stopped');
}

/**
 * Liste les jobs actifs
 */
export function listScheduledJobs(): Array<{
  name: string;
  cron: string;
  description: string;
  enabled: boolean;
}> {
  return Object.entries(SCHEDULES).map(([name, config]) => ({
    name,
    cron: config.cron,
    description: config.description,
    enabled: config.enabled,
  }));
}

/**
 * Exécute un job manuellement
 */
export async function runJobManually(jobName: string): Promise<void> {
  const config = SCHEDULES[jobName];
  if (!config) {
    throw new Error(`Unknown job: ${jobName}`);
  }

  logger.info({ jobName }, 'Running job manually');
  await config.handler();
  logger.info({ jobName }, 'Manual job completed');
}

// Gestion du signal d'arrêt
process.on('SIGINT', () => {
  logger.info('Received SIGINT, stopping scheduler...');
  stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, stopping scheduler...');
  stopScheduler();
  process.exit(0);
});

export default {
  startScheduler,
  stopScheduler,
  listScheduledJobs,
  runJobManually,
  SCHEDULES,
};
