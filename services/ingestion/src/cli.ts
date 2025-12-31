#!/usr/bin/env node
// =============================================================================
// CLI - Interface en ligne de commande pour l'ingestion
// =============================================================================

import 'dotenv/config';
import { Command } from 'commander';
import { fullSync, incrementalSync, syncGroupes, syncDeputes, syncSenateurs, syncScrutins, syncScrutinsSenat, syncInterventions, syncAmendements, syncLobbyistes } from './workers/sync.js';
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
  .option('-i, --interventions', 'Synchroniser uniquement les interventions')
  .option('-a, --amendements', 'Synchroniser uniquement les amendements (AN Open Data)')
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
        await syncInterventions({ maxSeances: options.limit || 50 });
      } else if (options.amendements) {
        await syncAmendements({ limit: options.limit });
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

program.parse();
