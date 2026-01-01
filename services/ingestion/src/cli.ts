#!/usr/bin/env node
// =============================================================================
// CLI - Interface en ligne de commande pour l'ingestion
// =============================================================================

import 'dotenv/config';
import { Command } from 'commander';
import {
  fullSync,
  incrementalSync,
  smartSync,
  checkSourcesStatus,
  syncGroupes,
  syncDeputes,
  syncSenateurs,
  syncScrutins,
  syncScrutinsSenat,
  syncInterventions,
  syncInterventionsSenat,
  syncAmendements,
  syncAmendementsSenat,
  syncLobbyistes,
} from './workers/sync.js';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('clair-ingestion')
  .description('CLI pour la gestion de l\'ingestion des données CLAIR')
  .version('0.1.0');

// =============================================================================
// COMMANDE: sync
// =============================================================================
program
  .command('sync')
  .description('Synchroniser les données depuis les sources')
  .option('-f, --full', 'Synchronisation complète (backfill)')
  .option('-g, --groupes', 'Synchroniser uniquement les groupes')
  .option('-d, --deputes', 'Synchroniser uniquement les députés')
  .option('-S, --senateurs', 'Synchroniser uniquement les sénateurs')
  .option('-s, --scrutins', 'Synchroniser uniquement les scrutins AN')
  .option('--scrutins-senat', 'Synchroniser uniquement les scrutins Sénat')
  .option('-c, --circonscriptions', 'Synchroniser uniquement les circonscriptions')
  .option('-i, --interventions', 'Synchroniser uniquement les interventions AN')
  .option('--interventions-senat', 'Synchroniser uniquement les interventions Sénat (data.senat.fr)')
  .option('-a, --amendements', 'Synchroniser uniquement les amendements (AN Open Data)')
  .option('--amendements-senat', 'Synchroniser uniquement les amendements Sénat (data.senat.fr AMELI)')
  .option('-L, --lobbying', 'Synchroniser uniquement les lobbyistes (HATVP)')
  .option('-l, --limit <number>', 'Limiter le nombre de scrutins/séances/amendements/lobbyistes', parseInt)
  .option('--no-actions', 'Ne pas synchroniser les actions de lobbying (avec -L)')
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting sync command');

      if (options.full) {
        await fullSync();
      } else if (options.groupes) {
        await syncGroupes();
      } else if (options.deputes) {
        await syncDeputes(false);
      } else if (options.senateurs) {
        await syncSenateurs(false);
      } else if (options.scrutins) {
        await syncScrutins({ limit: options.limit });
      } else if (options.scrutinsSenat) {
        await syncScrutinsSenat({ limit: options.limit });
      } else if (options.circonscriptions) {
        // Les circonscriptions sont créées automatiquement avec les députés
        await syncDeputes(true);
      } else if (options.interventions) {
        await syncInterventions({ maxSeances: options.limit }); // Utilise le défaut du client (100) si pas de --limit
      } else if (options.interventionsSenat) {
        await syncInterventionsSenat({ maxSeances: options.limit });
      } else if (options.amendements) {
        await syncAmendements({ limit: options.limit });
      } else if (options.amendementsSenat) {
        await syncAmendementsSenat({ maxAmendements: options.limit });
      } else if (options.lobbying) {
        await syncLobbyistes({ limit: options.limit, includeActions: options.actions !== false });
      } else {
        // Par défaut: sync incrémental
        await incrementalSync();
      }

      logger.info('Sync command completed successfully');
      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sync command failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: backfill
// =============================================================================
program
  .command('backfill')
  .description('Effectuer un backfill complet des données')
  .option('--from-scrutin <number>', 'Numéro du scrutin de départ', parseInt)
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting backfill command');
      await fullSync();
      logger.info('Backfill completed successfully');
      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Backfill failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: test
// =============================================================================
program
  .command('test')
  .description('Tester la connexion aux sources de données')
  .option('-l, --legifrance', 'Tester uniquement Légifrance/PISTE')
  .action(async (options) => {
    try {
      if (options.legifrance) {
        // Test Légifrance uniquement
        const { LegifranceClient } = await import('./sources/legifrance/client');
        const client = new LegifranceClient();

        logger.info('Testing Légifrance/PISTE API...');
        const result = await client.testConnection();

        if (result.success) {
          logger.info(result.message);
          process.exit(0);
        } else {
          logger.error(result.message);
          process.exit(1);
        }
      } else {
        // Test Assemblée Nationale API
        const { AssembleeNationaleDeputesClient } = await import('./sources/assemblee-nationale/deputes-client.js');
        const client = new AssembleeNationaleDeputesClient(17);

        logger.info('Testing Assemblée Nationale API...');
        const { deputes, groupes } = await client.getDeputes();
        logger.info({ deputes: deputes.length, groupes: groupes.length }, 'Assemblée Nationale API OK');

        logger.info('All tests passed!');
        process.exit(0);
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'Test failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: smart-sync
// =============================================================================
program
  .command('smart-sync')
  .description('Synchronisation intelligente - ne sync que les sources modifiées')
  .option('-a, --all', 'Synchroniser TOUT dans le bon ordre (parlementaires, scrutins, amendements, interventions, lobbying)')
  .option('-f, --force', 'Forcer le sync même si pas de changement')
  .option('-s, --scrutins', 'Inclure les scrutins (AN + Sénat)')
  .option('-A, --amendements', 'Inclure les amendements (AN + Sénat)')
  .option('-I, --interventions', 'Inclure les interventions (DILA + Sénat)')
  .option('-L, --lobbying', 'Inclure les lobbyistes')
  .option('--scrutins-limit <number>', 'Limite pour les scrutins (défaut: 50)', parseInt)
  .option('--amendements-limit <number>', 'Limite pour les amendements (défaut: 200)', parseInt)
  .option('--interventions-limit <number>', 'Limite pour les séances d\'interventions (défaut: 50)', parseInt)
  .option('--lobbying-limit <number>', 'Limite pour les lobbyistes (défaut: 500)', parseInt)
  .option('--sources <sources>', 'Sources spécifiques à sync (séparées par des virgules)')
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting smart sync command');

      const result = await smartSync({
        all: options.all,
        force: options.force,
        includeScrutins: options.scrutins,
        includeAmendements: options.amendements,
        includeInterventions: options.interventions,
        includeLobbying: options.lobbying,
        scrutinsLimit: options.scrutinsLimit,
        amendementsLimit: options.amendementsLimit,
        interventionsLimit: options.interventionsLimit,
        lobbyingLimit: options.lobbyingLimit,
        sources: options.sources?.split(',').map((s: string) => s.trim()),
      });

      logger.info({
        duration: result.duration,
        sourcesChecked: result.sourcesChecked.length,
        sourcesChanged: result.sourcesChanged.length,
        sourcesSkipped: result.sourcesSkipped.length,
      }, 'Smart sync completed');

      // Afficher le résumé
      if (result.sourcesChanged.length > 0) {
        console.log('\n📊 Sources synchronisées:');
        for (const source of result.sourcesChanged) {
          const r = result.results[source];
          if (r) {
            console.log(`  ✅ ${source}: ${r.created} créés, ${r.updated} mis à jour`);
          }
        }
      }

      if (result.sourcesSkipped.length > 0) {
        console.log('\n⏭️  Sources inchangées (skipped):');
        for (const source of result.sourcesSkipped) {
          console.log(`  ⚪ ${source}`);
        }
      }

      console.log(`\n⏱️  Durée: ${result.duration}`);

      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Smart sync failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: status
// =============================================================================
program
  .command('status')
  .description('Afficher le statut de fraîcheur des sources')
  .action(async () => {
    try {
      console.log('\n📡 Vérification des sources...\n');
      await checkSourcesStatus();
      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Status check failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: schedule
// =============================================================================
program
  .command('schedule')
  .description('Démarrer le scheduler de synchronisation automatique')
  .option('-d, --dry-run', 'Mode test - affiche les horaires sans exécuter')
  .action(async (options) => {
    try {
      const { startScheduler } = await import('./scheduler.js');

      if (options.dryRun) {
        console.log('\n📅 Horaires de synchronisation prévus:\n');
        console.log('  🌙 05:00 - Sync complet quotidien (AN + Sénat + Scrutins)');
        console.log('  📊 12:00 - Sync scrutins récents');
        console.log('  📊 18:00 - Sync scrutins récents');
        console.log('  📋 Dimanche 04:00 - Sync lobbying hebdomadaire');
        console.log('\n⚠️  Mode dry-run: scheduler non démarré');
        process.exit(0);
      }

      logger.info('Starting scheduler...');
      await startScheduler();

      // Keep the process running
      console.log('\n✅ Scheduler démarré. Ctrl+C pour arrêter.\n');

    } catch (error: any) {
      logger.error({ error: error.message }, 'Scheduler failed');
      process.exit(1);
    }
  });

program.parse();
