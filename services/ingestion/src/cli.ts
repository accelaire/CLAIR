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
  syncAmendementsSenatCsv,
  syncDossiers,
  syncDossiersSenat,
  linkInterventionsToScrutins,
  linkScrutinsToAmendements,
  enrichScrutinsANAmendements,
  enrichScrutinsSenatAmendements,
  syncLobbyistes,
  linkANScrutinsByTitle,
  linkOrphanScrutinsByTFIDF,
  linkOrphanScrutinsByTexteNumero,
  linkOrphansByLoiTitre,
  linkAmendementsToDossiers,
  linkAmendementsToDossiersByTexteRef,
  propagateDossierIdBySiblingTexteRef,
  syncCommissions,
  syncReunions,
  syncSeancesODJ,
  syncSenatReunions,
  syncSenatAgenda,
} from './workers/sync.js';
import {
  calculateAllStats,
  calculateAllGroupeStats,
  calculateAllGroupeAlliances,
  calculateAllGroupeThematiques,
} from './workers/stats-calculator.js';
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
  // Filtres de chambre
  .option('--an, --assemblee-nationale', 'Filtrer sur l\'Assemblée Nationale uniquement')
  .option('--se, --senat', 'Filtrer sur le Sénat uniquement')
  // Types de données
  .option('-f, --full', 'Synchronisation complète (backfill)')
  .option('-p, --parlementaires', 'Synchroniser les parlementaires (députés + sénateurs, ou filtrer avec --an/--se)')
  .option('-g, --groupes', 'Synchroniser les groupes politiques')
  .option('-s, --scrutins', 'Synchroniser les scrutins (--an ou --se pour filtrer)')
  .option('--in, --interventions', 'Synchroniser les interventions (--an ou --se pour filtrer)')
  .option('--am, --amendements', 'Synchroniser les amendements (--an ou --se pour filtrer)')
  .option('--do, --dossiers', 'Synchroniser les dossiers législatifs (--an ou --se pour filtrer)')
  .option('--lo, --lobbyistes', 'Synchroniser les lobbyistes et actions (HATVP)')
  .option('--de, --declarations', 'Synchroniser les déclarations HATVP (intérêts & patrimoine des parlementaires)')
  .option('--co, --commissions', 'Synchroniser les commissions parlementaires (AN + Sénat)')
  .option('--re, --reunions', 'Synchroniser les réunions/agenda parlementaire (--an ou --se pour filtrer)')
  .option('--seances-odj', 'Enrichir les réunions séance publique avec l\'ODJ du CSV AN (AN uniquement)')
  // Modificateurs
  .option('-c, --circonscriptions', 'Inclure les circonscriptions (avec -p --an)')
  .option('--ameli', 'Utiliser le mode AMELI legacy (avec --se -a)')
  .option('--texte-ids <ids>', 'IDs texte AMELI à cibler (séparés par des virgules, avec --se -a)')
  .option('--no-actions', 'Ne pas synchroniser les actions de lobbying (avec --lo)')
  .option('-l, --limit <number>', 'Limiter le nombre d\'éléments à synchroniser', parseInt)
  .option('--dry-run', 'Mode simulation (affiche ce qui serait fait sans modifier)')
  // Opérations de liaison (combiner avec --in ou --am)
  .option('--link', 'Lier les scrutins aux interventions (--in) ou amendements (--am)')
  .option('--enrich', 'Enrichir les scrutins par scraping HTML (avec --am, filtrer avec --an/--se)')
  .option('--reset', 'Réinitialiser les liens existants avant de re-lier')
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting sync command');

      const chambre: 'an' | 'se' | null =
        options.assembleeNationale ? 'an' : options.senat ? 'se' : null;

      if (options.full) {
        await fullSync();
      } else if (options.link && options.interventions) {
        const result = await linkInterventionsToScrutins({ dryRun: options.dryRun });
        console.log(`\n📊 Interventions liées: ${result.linked}`);
        console.log(`   - Par seanceRef: ${result.bySeanceRef}`);
        console.log(`   - Par date: ${result.byDate}`);
      } else if (options.link && options.amendements) {
        const result = await linkScrutinsToAmendements({
          dryRun: options.dryRun,
          reset: options.reset,
        });
        console.log(`\n📊 Scrutins liés à des amendements: ${result.linked}`);
        console.log(`   - Non trouvés en base: ${result.notFound}`);
        if (options.reset && !options.dryRun) {
          console.log(`   ⚠️  Les liens existants ont été réinitialisés avant re-linkage`);
        }
      } else if (options.enrich && options.amendements) {
        if (chambre === 'se') {
          const result = await enrichScrutinsSenatAmendements({
            limit: options.limit,
            dryRun: options.dryRun,
            reset: options.reset,
          });
          console.log(`\n📊 Enrichissement scrutins Sénat (scraping HTML):`);
          if (options.reset && result.resetCount) {
            console.log(`   - Liens réinitialisés: ${result.resetCount}`);
          }
          console.log(`   - Enrichis: ${result.enriched}`);
          console.log(`   - Non trouvés: ${result.notFound}`);
          console.log(`   - Erreurs: ${result.errors}`);
        } else if (chambre === 'an') {
          const result = await enrichScrutinsANAmendements({
            limit: options.limit,
            dryRun: options.dryRun,
            reset: options.reset,
          });
          console.log(`\n📊 Enrichissement scrutins AN (scraping HTML):`);
          if (options.reset && result.resetCount) {
            console.log(`   - Liens réinitialisés: ${result.resetCount}`);
          }
          console.log(`   - Enrichis: ${result.enriched}`);
          console.log(`   - Non trouvés: ${result.notFound}`);
          console.log(`   - Erreurs: ${result.errors}`);
        } else {
          const resultAN = await enrichScrutinsANAmendements({
            limit: options.limit,
            dryRun: options.dryRun,
            reset: options.reset,
          });
          console.log(`\n📊 Enrichissement scrutins AN (scraping HTML):`);
          if (options.reset && resultAN.resetCount) {
            console.log(`   - Liens réinitialisés: ${resultAN.resetCount}`);
          }
          console.log(`   - Enrichis: ${resultAN.enriched}`);
          console.log(`   - Non trouvés: ${resultAN.notFound}`);
          console.log(`   - Erreurs: ${resultAN.errors}`);

          const resultSE = await enrichScrutinsSenatAmendements({
            limit: options.limit,
            dryRun: options.dryRun,
            reset: options.reset,
          });
          console.log(`\n📊 Enrichissement scrutins Sénat (scraping HTML):`);
          if (options.reset && resultSE.resetCount) {
            console.log(`   - Liens réinitialisés: ${resultSE.resetCount}`);
          }
          console.log(`   - Enrichis: ${resultSE.enriched}`);
          console.log(`   - Non trouvés: ${resultSE.notFound}`);
          console.log(`   - Erreurs: ${resultSE.errors}`);
        }
      } else if (options.groupes) {
        await syncGroupes();
      } else if (options.parlementaires) {
        if (chambre === 'an') {
          await syncDeputes(options.circonscriptions || false);
        } else if (chambre === 'se') {
          await syncSenateurs(false);
        } else {
          await syncDeputes(options.circonscriptions || false);
          await syncSenateurs(false);
        }
      } else if (options.scrutins) {
        if (chambre === 'se') {
          await syncScrutinsSenat({ limit: options.limit });
        } else if (chambre === 'an') {
          await syncScrutins({ limit: options.limit });
        } else {
          await syncScrutins({ limit: options.limit });
          await syncScrutinsSenat({ limit: options.limit });
        }
      } else if (options.interventions) {
        if (chambre === 'se') {
          await syncInterventionsSenat({ maxSeances: options.limit });
        } else if (chambre === 'an') {
          await syncInterventions({ maxSeances: options.limit });
        } else {
          await syncInterventions({ maxSeances: options.limit });
          await syncInterventionsSenat({ maxSeances: options.limit });
        }
      } else if (options.amendements) {
        if (chambre === 'se') {
          if (options.ameli) {
            await syncAmendementsSenat({ maxAmendements: options.limit });
          } else {
            const texteIds = options.texteIds
              ? options.texteIds.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n))
              : undefined;
            await syncAmendementsSenatCsv({ texteIds });
          }
        } else if (chambre === 'an') {
          await syncAmendements({ limit: options.limit });
        } else {
          await syncAmendements({ limit: options.limit });
          await syncAmendementsSenatCsv({});
        }
      } else if (options.dossiers) {
        if (chambre === 'se') {
          await syncDossiersSenat({ limit: options.limit });
        } else if (chambre === 'an') {
          await syncDossiers({ limit: options.limit });
        } else {
          await syncDossiers({ limit: options.limit });
          await syncDossiersSenat({ limit: options.limit });
        }
      } else if (options.lobbyistes) {
        await syncLobbyistes({ limit: options.limit, includeActions: options.actions !== false });
      } else if (options.declarations) {
        const { syncDeclarationsHATVP } = await import('./workers/declarations-sync.js');
        const result = await syncDeclarationsHATVP();
        console.log(`\n📊 Déclarations HATVP:`);
        console.log(`   Total CSV: ${result.total}`);
        console.log(`   Matchés: ${result.matched}`);
        console.log(`   Créés/mis à jour: ${result.created}`);
        console.log(`   Non matchés: ${result.unmatched}`);
        console.log(`   Erreurs: ${result.errors}`);
      } else if (options.commissions) {
        const result = await syncCommissions();
        console.log(`\n📊 Commissions:`);
        console.log(`   Créées: ${result.created}`);
        console.log(`   Mises à jour: ${result.updated}`);
        console.log(`   Mandats liés: ${result.mandatsLinked}`);
      } else if (options.reunions) {
        if (chambre === 'se') {
          const result = await syncSenatReunions({ maxWeeks: options.limit });
          console.log(`\n📊 Réunions Sénat (scraping HTML):`);
          console.log(`   Créées: ${result.created}`);
          console.log(`   Mises à jour: ${result.updated}`);
          console.log(`   Participants liés: ${result.participantsLinked}`);
          console.log(`   Semaines traitées: ${result.weeksFetched}`);
          console.log(`   Pages parsées: ${result.pagesParsed}`);
          console.log(`   Pages en erreur: ${result.pagesErrored}`);

          const agendaResult = await syncSenatAgenda();
          console.log(`\n📊 Agenda Sénat (séances publiques à venir):`);
          console.log(`   Créées: ${agendaResult.created}`);
          console.log(`   Mises à jour: ${agendaResult.updated}`);
        } else if (chambre === 'an') {
          const result = await syncReunions({ limit: options.limit });
          console.log(`\n📊 Réunions AN:`);
          console.log(`   Créées: ${result.created}`);
          console.log(`   Mises à jour: ${result.updated}`);
          console.log(`   Participants liés: ${result.participantsLinked}`);
        } else {
          const resultAN = await syncReunions({ limit: options.limit });
          console.log(`\n📊 Réunions AN:`);
          console.log(`   Créées: ${resultAN.created}`);
          console.log(`   Mises à jour: ${resultAN.updated}`);
          console.log(`   Participants liés: ${resultAN.participantsLinked}`);

          const resultSE = await syncSenatReunions({ maxWeeks: options.limit });
          console.log(`\n📊 Réunions Sénat (scraping HTML):`);
          console.log(`   Créées: ${resultSE.created}`);
          console.log(`   Mises à jour: ${resultSE.updated}`);
          console.log(`   Participants liés: ${resultSE.participantsLinked}`);
          console.log(`   Semaines traitées: ${resultSE.weeksFetched}`);
          console.log(`   Pages parsées: ${resultSE.pagesParsed}`);
          console.log(`   Pages en erreur: ${resultSE.pagesErrored}`);

          const agendaResult = await syncSenatAgenda();
          console.log(`\n📊 Agenda Sénat (séances publiques à venir):`);
          console.log(`   Créées: ${agendaResult.created}`);
          console.log(`   Mises à jour: ${agendaResult.updated}`);
        }
      } else if (options.seancesOdj) {
        const result = await syncSeancesODJ();
        console.log(`\n📊 Séances publiques ODJ:`);
        console.log(`   Lignes CSV: ${result.totalCsvRows}`);
        console.log(`   Réunions matchées: ${result.matched}`);
        console.log(`   Mises à jour: ${result.updated}`);
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
  .action(async () => {
    try {
      const { AssembleeNationaleDeputesClient } = await import('./sources/assemblee-nationale/deputes-client.js');
      const client = new AssembleeNationaleDeputesClient(17);

      logger.info('Testing Assemblée Nationale API...');
      const { deputes, groupes } = await client.getDeputes();
      logger.info({ deputes: deputes.length, groupes: groupes.length }, 'Assemblée Nationale API OK');

      logger.info('All tests passed!');
      process.exit(0);
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
  .option('-a, --all', 'Synchroniser TOUT dans le bon ordre (parlementaires, scrutins, amendements, dossiers, interventions, lobbying)')
  .option('-f, --force', 'Forcer le sync même si pas de changement')
  .option('-s, --scrutins', 'Inclure les scrutins (AN + Sénat)')
  .option('--am, --amendements', 'Inclure les amendements (AN + Sénat)')
  .option('--do, --dossiers', 'Inclure les dossiers législatifs (AN)')
  .option('--in, --interventions', 'Inclure les interventions (DILA + Sénat)')
  .option('--lo, --lobbying', 'Inclure les lobbyistes')
  .option('--co, --commissions', 'Inclure les commissions parlementaires')
  .option('--re, --reunions', 'Inclure les réunions/agenda parlementaire (AN)')
  .option('--senat-reunions', 'Inclure les réunions Sénat (scraping HTML comptes rendus)')
  .option('--senat-agenda', 'Inclure l\'agenda Sénat (séances publiques à venir via API senat.fr)')
  .option('--senat-videos', 'Inclure les vidéos Sénat (scraping videos.senat.fr)')
  .option('--an-videos', 'Inclure les vidéos AN (videos.assemblee-nationale.fr)')
  .option('--seances-odj', 'Inclure l\'enrichissement ODJ des séances publiques (CSV AN)')
  .option('-l, --limit <number>', 'Limite globale pour tous les types (défaut: TOUT)', parseInt)
  .option('--sources <sources>', 'Sources spécifiques à sync (séparées par des virgules)')
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting smart sync command');

      const result = await smartSync({
        all: options.all,
        force: options.force,
        includeScrutins: options.scrutins,
        includeAmendements: options.amendements,
        includeDossiers: options.dossiers,
        includeInterventions: options.interventions,
        includeLobbying: options.lobbying,
        includeCommissions: options.commissions,
        includeReunions: options.reunions,
        includeSenatReunions: options.senatReunions,
        includeSenatAgenda: options.senatAgenda,
        includeSenatVideos: options.senatVideos,
        includeAnVideos: options.anVideos,
        includeSeancesODJ: options.seancesOdj,
        scrutinsLimit: options.limit,
        amendementsLimit: options.limit,
        dossiersLimit: options.limit,
        interventionsLimit: options.limit,
        lobbyingLimit: options.limit,
        reunionsLimit: options.limit,
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

      // Recharger le cache homepage via l'URL publique de l'API
      // Cooldown 120s pour laisser Postgres souffler après le sync
      // Étape 1 : invalider le cache (POST /warm)
      // Étape 2 : reconstruire via GET /homepage (comme un user normal)
      console.log('\n⏳ Attente 120s avant rechargement du cache (stabilisation DB)...');
      await new Promise(r => setTimeout(r, 120_000));
      const apiUrl = process.env.API_URL || 'http://localhost:3001';
      const warmToken = process.env.CACHE_WARM_TOKEN?.trim();
      if (warmToken) {
        try {
          // Invalidation
          console.log('\n🔄 Invalidation du cache homepage...');
          const invalidate = await fetch(`${apiUrl}/api/v1/homepage/warm`, {
            method: 'POST',
            headers: {
              'x-warm-token': warmToken,
              'user-agent': 'clair-ingestion/1.0',
            },
          });
          if (!invalidate.ok) {
            console.log(`  ⚠️  Invalidation échouée: status ${invalidate.status}`);
          } else {
            // Rebuild — identique à un user qui arrive sur la homepage
            console.log('  ✅ Cache invalidé, reconstruction...');
            const rebuild = await fetch(`${apiUrl}/api/v1/homepage`, {
              headers: { 'user-agent': 'clair-ingestion/1.0' },
            });
            if (rebuild.ok) {
              console.log('  ✅ Cache homepage rechargé');
            } else {
              console.log(`  ⚠️  Rebuild échoué: status ${rebuild.status}`);
            }
          }
        } catch (e: any) {
          console.log(`  ⚠️  Cache warm indisponible: ${e.message}`);
        }
      } else {
        console.log('\n⚠️  CACHE_WARM_TOKEN non configuré — cache homepage non rechargé');
      }

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
// COMMANDE: calculate-stats
// =============================================================================
program
  .command('calculate-stats')
  .description('Calculer/recalculer les statistiques pré-calculées des parlementaires et groupes')
  .option('-c, --chambre <chambre>', 'Chambre spécifique (assemblee ou senat)')
  .option('--parlementaires-only', 'Calculer uniquement les stats des parlementaires')
  .option('--groupes-only', 'Calculer uniquement les stats des groupes')
  .action(async (options) => {
    try {
      logger.info({ chambre: options.chambre || 'all' }, 'Starting stats calculation');
      let totalErrors = 0;

      // Stats parlementaires (sauf si --groupes-only)
      if (!options.groupesOnly) {
        console.log('\n📊 Calcul des statistiques parlementaires...\n');
        const parlResult = await calculateAllStats(options.chambre);
        console.log(`✅ Stats calculées pour ${parlResult.updated}/${parlResult.total} parlementaires`);
        if (parlResult.errors > 0) {
          console.log(`⚠️  ${parlResult.errors} erreurs`);
        }
        console.log(`⏱️  Durée: ${parlResult.duration}`);
        totalErrors += parlResult.errors;
      }

      // Stats groupes (sauf si --parlementaires-only)
      if (!options.parlementairesOnly) {
        console.log('\n📊 Calcul des statistiques des groupes politiques...\n');
        const groupeResult = await calculateAllGroupeStats(options.chambre);
        console.log(`✅ Stats calculées pour ${groupeResult.updated}/${groupeResult.total} groupes`);
        if (groupeResult.errors > 0) {
          console.log(`⚠️  ${groupeResult.errors} erreurs`);
        }
        console.log(`⏱️  Durée: ${groupeResult.duration}`);
        totalErrors += groupeResult.errors;

        // Alliances entre groupes
        console.log('\n🤝 Calcul des alliances entre groupes...\n');
        const alliancesResult = await calculateAllGroupeAlliances(options.chambre);
        console.log(`✅ ${alliancesResult.total} paires d'alliances calculées`);
        console.log(`⏱️  Durée: ${alliancesResult.duration}`);

        // Stats thématiques pour radar chart
        console.log('\n🎯 Calcul des positions thématiques...\n');
        const thematiquesResult = await calculateAllGroupeThematiques(options.chambre);
        console.log(`✅ ${thematiquesResult.total} stats thématiques calculées`);
        console.log(`⏱️  Durée: ${thematiquesResult.duration}`);
      }

      console.log('\n');
      process.exit(totalErrors > 0 ? 1 : 0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Stats calculation failed');
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

// =============================================================================
// COMMANDE: link-scrutins-dossiers
// =============================================================================
program
  .command('link-scrutins-dossiers')
  .description('Lier les scrutins AN orphelins aux dossiers législatifs par matching de titre')
  .action(async () => {
    try {
      logger.info('Starting AN scrutins-dossiers title linking...');
      const result = await linkANScrutinsByTitle();
      console.log(`\nScrutins liés aux dossiers: ${result.linked}`);
      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'link-scrutins-dossiers failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: link-scrutins-tfidf
// =============================================================================
program
  .command('link-scrutins-tfidf')
  .description('Lier les scrutins orphelins aux dossiers par TF-IDF (cosine similarity sur titres)')
  .action(async () => {
    try {
      logger.info('Starting TF-IDF scrutin-dossier linking...');
      const result = await linkOrphanScrutinsByTFIDF();
      console.log(`\n📊 TF-IDF scrutin-dossier linking:`);
      console.log(`   Liés: ${result.linked}`);
      console.log(`   Ignorés (score trop bas): ${result.skipped}`);
      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'link-scrutins-tfidf failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: link-by-texte-numero
// =============================================================================
program
  .command('link-by-texte-numero')
  .description('Lier les scrutins orphelins aux dossiers par texte_numero partagé')
  .action(async () => {
    try {
      logger.info('Starting texte_numero orphan linking...');
      const result = await linkOrphanScrutinsByTexteNumero();
      console.log(`\nScrutins liés par texte_numero: ${result.linked}`);
      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'link-by-texte-numero failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: link-by-loi-titre
// =============================================================================
program
  .command('link-by-loi-titre')
  .description('Lier les scrutins orphelins aux dossiers par loi_titre (titre de la loi promulguée)')
  .action(async () => {
    try {
      logger.info('Starting loi_titre orphan linking...');
      const result = await linkOrphansByLoiTitre();
      console.log(`\nScrutins liés par loi_titre: ${result.linked}`);
      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'link-by-loi-titre failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: link-amendements-dossiers
// =============================================================================
program
  .command('link-amendements-dossiers')
  .description('Propager dossier_id des scrutins vers les amendements')
  .action(async () => {
    try {
      const result = await linkAmendementsToDossiers();
      console.log(`\nAmendements liés via scrutins: ${result.linked}`);
      const result2 = await linkAmendementsToDossiersByTexteRef();
      console.log(`Amendements liés via texteRef: ${result2.linked}`);
      const result3 = await propagateDossierIdBySiblingTexteRef();
      console.log(`Amendements liés via sibling texteRef (safe): ${result3.linked}`);
      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'link-amendements-dossiers failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: generate-sujets
// =============================================================================
program
  .command('generate-sujets')
  .description('Générer les sujets parlementaires par cross-référence déterministe AN ↔ Sénat')
  .option('--reset', 'Vider les sujet_id existants avant de regénérer')
  .option('--dry-run', 'Afficher les stats sans modifier la DB')
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting sujet generation...');
      const { generateSujets } = await import('./workers/sujet-generator.js');
      const result = await generateSujets({
        reset: options.reset,
        dryRun: options.dryRun,
      });

      console.log(`\n📊 Sujets parlementaires${options.dryRun ? ' (DRY RUN)' : ''}:`);
      console.log(`   Créés: ${result.created}`);
      console.log(`   Mis à jour: ${result.updated}`);
      console.log(`   Cross-chambre: ${result.crossRef}`);
      console.log(`   Solo: ${result.solo}`);
      console.log(`   Dossiers couverts: ${result.totalDossiers}`);
      console.log(`   Scrutins couverts: ${result.totalScrutins}`);

      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sujet generation failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: generate-sujet-links
// =============================================================================
program
  .command('generate-sujet-links')
  .description('Générer les liens sortants des sujets — famille "construction" (documents officiels AN)')
  .option('--no-validate', 'Ne pas vérifier (HEAD) que les URLs résolvent')
  .option('--dry-run', 'Afficher les stats sans modifier la DB')
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting sujet links generation...');
      const { generateSujetLinks } = await import('./workers/sujet-links-generator.js');
      const result = await generateSujetLinks({
        validate: options.validate,
        dryRun: options.dryRun,
      });

      console.log(`\n🔗 Liens sujets — construction${options.dryRun ? ' (DRY RUN)' : ''}:`);
      console.log(`   Sujets traités: ${result.sujetsProcessed}`);
      console.log(`   Liens créés: ${result.created}`);
      console.log(`   Liens supprimés: ${result.deleted}`);
      console.log(`   URLs validées: ${result.validated}`);
      console.log(`   Écartés (URL morte): ${result.dropped}`);

      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sujet links generation failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: generate-sujet-context
// =============================================================================
program
  .command('generate-sujet-context')
  .description('Résoudre les liens "contexte" des sujets (vie-publique + Wikipédia FR)')
  .option('--dry-run', 'Afficher les stats sans modifier la DB')
  .option('--incremental', 'Ne traiter que les sujets nouveaux/modifiés (défaut: tous)')
  .option('-l, --limit <number>', 'Nombre max de sujets à traiter (test)', parseInt)
  .option('-c, --concurrency <number>', 'Appels externes en parallèle (défaut: 3)', parseInt)
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting sujet context links generation...');
      const { generateSujetContextLinks } = await import('./workers/sujet-links-generator.js');
      const result = await generateSujetContextLinks({
        dryRun: options.dryRun,
        limit: options.limit,
        concurrency: options.concurrency,
        incremental: options.incremental,
      });

      console.log(`\n📚 Liens sujets — contexte${options.dryRun ? ' (DRY RUN)' : ''}:`);
      console.log(`   Sujets traités: ${result.sujetsProcessed}`);
      console.log(`   Sujets avec ≥1 lien: ${result.resolved}`);
      console.log(`   vie-publique: ${result.viePublique}   ·   Wikipédia: ${result.wikipedia}`);
      console.log(`   Liens créés: ${result.created}`);
      console.log(`   Liens supprimés: ${result.deleted}`);

      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sujet context links generation failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: enrich-ia
// =============================================================================
program
  .command('enrich-ia')
  .description('Enrichir les entités parlementaires via IA (Mistral) — résumés accessibles')
  .option('--scrutins', 'Enrichir uniquement les scrutins')
  .option('--dossiers', 'Enrichir uniquement les dossiers')
  .option('--sujets', 'Enrichir uniquement les sujets')
  .option('--parlementaires', 'Enrichir uniquement les fiches parlementaires (Wikipedia + Tavily + Mistral)')
  .option('--groupe-amendements', 'Enrichir les descriptions d\'amendements par groupe pour les sujets')
  .option('--random <number>', 'Parlementaires uniquement : régénérer un échantillon aléatoire de N fiches actives (rafraîchit aussi la date)', parseInt)
  .option('-l, --limit <number>', 'Nombre max d\'entités à traiter', parseInt)
  .option('--dry-run', 'Mode simulation (calcule mais n\'écrit pas)')
  .option('--force', 'Ignorer le hash, regénérer tout')
  .option('-c, --concurrency <number>', 'Nombre d\'appels LLM en parallèle (défaut: 3)', parseInt)
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting IA enrichment command');

      const enrichOptions = {
        limit: options.limit,
        dryRun: options.dryRun,
        force: options.force,
        concurrency: options.concurrency,
        randomSample: options.random,
      };

      // --random cible exclusivement les parlementaires (pas de cascade complète)
      // Sans flag spécifique → cascade complète : scrutins → dossiers → sujets → parlementaires
      const enrichAll = !options.scrutins && !options.dossiers && !options.sujets && !options.parlementaires && !options.groupeAmendements && options.random == null;

      if (options.scrutins || enrichAll) {
        const { enrichScrutinsIA } = await import('./workers/ia-enrichment.js');
        const result = await enrichScrutinsIA(enrichOptions);
        console.log(`\n📊 Enrichissement IA des scrutins${options.dryRun ? ' (DRY RUN)' : ''}:`);
        console.log(`   Enrichis: ${result.enriched}`);
        console.log(`   Inchangés (skip): ${result.skipped}`);
        console.log(`   Erreurs: ${result.errors}`);
        console.log(`   Tokens IN: ${result.totalTokensIn} | OUT: ${result.totalTokensOut}`);
      }

      if (options.dossiers || enrichAll) {
        const { enrichDossiersIA } = await import('./workers/ia-enrichment.js');
        const result = await enrichDossiersIA(enrichOptions);
        console.log(`\n📊 Enrichissement IA des dossiers${options.dryRun ? ' (DRY RUN)' : ''}:`);
        console.log(`   Enrichis: ${result.enriched}`);
        console.log(`   Inchangés (skip): ${result.skipped}`);
        console.log(`   Erreurs: ${result.errors}`);
        console.log(`   Tokens IN: ${result.totalTokensIn} | OUT: ${result.totalTokensOut}`);
      }

      if (options.sujets || enrichAll) {
        const { enrichSujetsIA } = await import('./workers/ia-enrichment.js');
        const result = await enrichSujetsIA(enrichOptions);
        console.log(`\n📊 Enrichissement IA des sujets${options.dryRun ? ' (DRY RUN)' : ''}:`);
        console.log(`   Enrichis: ${result.enriched}`);
        console.log(`   Inchangés (skip): ${result.skipped}`);
        console.log(`   Erreurs: ${result.errors}`);
        console.log(`   Tokens IN: ${result.totalTokensIn} | OUT: ${result.totalTokensOut}`);
      }

      if (options.groupeAmendements || enrichAll) {
        const { enrichSujetGroupeAmendements } = await import('./workers/ia-enrichment.js');
        const result = await enrichSujetGroupeAmendements(enrichOptions);
        console.log(`\n📊 Enrichissement descriptions amendements par groupe${options.dryRun ? ' (DRY RUN)' : ''}:`);
        console.log(`   Enrichis: ${result.enriched}`);
        console.log(`   Inchangés (skip): ${result.skipped}`);
        console.log(`   Erreurs: ${result.errors}`);
        console.log(`   Tokens IN: ${result.totalTokensIn} | OUT: ${result.totalTokensOut}`);
      }

      if (options.parlementaires || options.random != null || enrichAll) {
        const { enrichParlementairesIA } = await import('./workers/parlementaire-enrichment.js');
        const result = await enrichParlementairesIA(enrichOptions);
        console.log(`\n📊 Enrichissement IA des parlementaires${options.dryRun ? ' (DRY RUN)' : ''}:`);
        console.log(`   Enrichis: ${result.enriched}`);
        console.log(`   Inchangés (skip): ${result.skipped}`);
        console.log(`   Erreurs: ${result.errors}`);
        console.log(`   Tokens IN: ${result.totalTokensIn} | OUT: ${result.totalTokensOut}`);
      }

      process.exit(0);
    } catch (error: any) {
      logger.error({ error: error.message }, 'IA enrichment failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: check-quality
// =============================================================================
program
  .command('check-quality')
  .description('Vérifier la qualité des données en base')
  .action(async () => {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        console.log('\n🔍 Vérification de la qualité des données...\n');
        const { runDataQualityChecks, printReport } = await import('./checks/data-quality.js');
        const report = await runDataQualityChecks(prisma, { checkSujetLinksHttp: true });
        printReport(report);
        process.exit(report.passed ? 0 : 1);
      } finally {
        await prisma.$disconnect();
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'Quality check failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: check-ia-quality
// =============================================================================
program
  .command('check-ia-quality')
  .description('Vérifier la qualité des résumés IA (détection d\'inversions de positions)')
  .action(async () => {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        console.log('\n🤖 Vérification de la qualité des résumés IA...\n');
        const { runIAQualityChecks, printIAQualityReport } = await import('./checks/ia-quality.js');
        const report = await runIAQualityChecks(prisma);
        printIAQualityReport(report);
        process.exit(report.passed ? 0 : 1);
      } finally {
        await prisma.$disconnect();
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'IA quality check failed');
      process.exit(1);
    }
  });

// pnpm forwards '--' from 'pnpm run script -- args' into the child process argv.
// Commander treats '--' as end-of-options, so flags after it are ignored.
// Strip the first '--' that appears after the subcommand name.
const argv = process.argv.slice();
const firstDoubleDash = argv.indexOf('--', 3);
if (firstDoubleDash !== -1) {
  argv.splice(firstDoubleDash, 1);
}
program.parse(argv);
