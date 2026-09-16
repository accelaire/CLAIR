#!/usr/bin/env node
// =============================================================================
// CLI - Interface en ligne de commande pour l'ingestion
// =============================================================================

import 'dotenv/config';
import { Command } from 'commander';
import { syncTextesArticles } from './workers/textes-articles';
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
  linkScrutinsToAmendements,
  enrichScrutinsANAmendements,
  enrichScrutinsSenatAmendements,
  syncLobbyistes,
  linkANScrutinsByTitle,
  unlinkANScrutinsWrongLegislature,
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
  reconcileActifFromMandats,
  calculateAllStats,
  calculateAllGroupeStats,
  calculateAllGroupeAlliances,
  calculateAllGroupeThematiques,
} from './workers/stats-calculator.js';
import { backfillMandatsParlementaires } from './workers/backfill-mandats.js';
import { backfillNatureVote } from './workers/backfill-nature-vote.js';
import { syncSenateursHistoriques } from './workers/senat-histo.js';
import { SENAT_SESSION_MIN } from './workers/mandats.js';
import { logger } from './utils/logger';
import { errorMessage } from './utils/errors';

/**
 * Plafond de chaque appel de rechargement du cache homepage.
 *
 * Large — la reconstruction agrège beaucoup de données — mais fini : c'est
 * l'absence de borne qui laissait le conteneur cron vivant indéfiniment.
 */
const CACHE_WARM_TIMEOUT_MS = 120_000;

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
  .option('--legislature <number>', 'Législature AN à ingérer (15,16,17 — défaut: courante). Avec -p --an, -s --an ou -d --an', parseInt)
  .option('--sessions <annees>', `Sessions Sénat à ingérer, séparées par des virgules (ex: 2006,2007). Défaut: ${SENAT_SESSION_MIN} → courante. Avec -s --se, permet un backfill par tranches (mémoire).`)
  .option('--dry-run', 'Mode simulation (affiche ce qui serait fait sans modifier)')
  // Opérations de liaison (combiner avec --in ou --am)
  .option('--link', 'Lier les scrutins aux interventions (--in) ou amendements (--am)')
  .option('--enrich', 'Enrichir les scrutins par scraping HTML (avec --am, filtrer avec --an/--se)')
  .option('--reset', 'Réinitialiser les liens existants avant de re-lier')
  .option('--only <ids...>', 'Avec --enrich --am --an : restreindre à des ID de scrutin précis, plutôt que de rescraper tous les scrutins sans lien')
  .action(async (options) => {
    try {
      logger.info({ options }, 'Starting sync command');

      // Sessions Sénat explicites (backfill par tranches) ; sinon le client couvre
      // SENAT_SESSION_MIN → année courante.
      const sessionsSenat: string[] | undefined = options.sessions
        ? String(options.sessions).split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined;

      const chambre: 'an' | 'se' | null =
        options.assembleeNationale ? 'an' : options.senat ? 'se' : null;

      if (options.full) {
        await fullSync();
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
            only: options.only,
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
          await syncDeputes(options.circonscriptions || false, options.legislature);
        } else if (chambre === 'se') {
          await syncSenateurs(false);
        } else {
          await syncDeputes(options.circonscriptions || false, options.legislature);
          await syncSenateurs(false);
        }
      } else if (options.scrutins) {
        if (chambre === 'se') {
          await syncScrutinsSenat({ limit: options.limit, sessions: sessionsSenat });
        } else if (chambre === 'an') {
          await syncScrutins({ limit: options.limit, legislature: options.legislature });
        } else {
          await syncScrutins({ limit: options.limit, legislature: options.legislature });
          await syncScrutinsSenat({ limit: options.limit, sessions: sessionsSenat });
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
          await syncDossiers({ limit: options.limit, legislature: options.legislature });
        } else {
          await syncDossiers({ limit: options.limit, legislature: options.legislature });
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
          // L'agenda d'abord : il crée les réunions, les comptes rendus s'y rattachent.
          const agendaResult = await syncSenatAgenda();
          console.log(`\n📊 Agenda Sénat (séances + commissions):`);
          console.log(`   Séances créées: ${agendaResult.created}`);
          console.log(`   Séances mises à jour: ${agendaResult.updated}`);
          console.log(`   Réunions de commission créées: ${agendaResult.reunionsCreated}`);
          console.log(`   Réunions de commission mises à jour: ${agendaResult.reunionsUpdated}`);

          const result = await syncSenatReunions({ maxWeeks: options.limit });
          console.log(`\n📊 Comptes rendus Sénat:`);
          console.log(`   Comptes rendus trouvés: ${result.comptesRendusFound}`);
          console.log(`   Réunions créées (hors fenêtre agenda): ${result.created}`);
          console.log(`   Réunions enrichies d'un compte rendu: ${result.updated}`);
          console.log(`   Participants liés: ${result.participantsLinked}`);
          console.log(`   Index en erreur: ${result.indexesErrored}`);
          console.log(`   Anciennes réunions reprises: ${result.legacyMigrated}`);
          console.log(`   Anciennes réunions fusionnées: ${result.legacyMerged}`);
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

          // L'agenda d'abord : il crée les réunions, les comptes rendus s'y rattachent.
          const agendaResult = await syncSenatAgenda();
          console.log(`\n📊 Agenda Sénat (séances + commissions):`);
          console.log(`   Séances créées: ${agendaResult.created}`);
          console.log(`   Séances mises à jour: ${agendaResult.updated}`);
          console.log(`   Réunions de commission créées: ${agendaResult.reunionsCreated}`);
          console.log(`   Réunions de commission mises à jour: ${agendaResult.reunionsUpdated}`);

          const resultSE = await syncSenatReunions({ maxWeeks: options.limit });
          console.log(`\n📊 Comptes rendus Sénat:`);
          console.log(`   Comptes rendus trouvés: ${resultSE.comptesRendusFound}`);
          console.log(`   Réunions créées (hors fenêtre agenda): ${resultSE.created}`);
          console.log(`   Réunions enrichies d'un compte rendu: ${resultSE.updated}`);
          console.log(`   Participants liés: ${resultSE.participantsLinked}`);
          console.log(`   Index en erreur: ${resultSE.indexesErrored}`);
          console.log(`   Anciennes réunions reprises: ${resultSE.legacyMigrated}`);
          console.log(`   Anciennes réunions fusionnées: ${resultSE.legacyMerged}`);
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Sync command failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Backfill failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Test failed');
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
  .option('--senat-histo', 'Inclure les anciens sénateurs (open data ODSEN)')
  .option('--re, --reunions', 'Inclure les réunions/agenda parlementaire (AN)')
  .option('--senat-reunions', 'Inclure les réunions Sénat (scraping HTML comptes rendus)')
  .option('--senat-agenda', 'Inclure l\'agenda Sénat (séances publiques à venir via API senat.fr)')
  .option('--senat-bureaux', 'Inclure les fonctions au bureau des commissions Sénat (scraping senat.fr)')
  .option('--senat-dossier-commissions', 'Inclure les commissions saisies des dossiers Sénat (scraping senat.fr)')
  .option('--senat-videos', 'Inclure les vidéos Sénat (scraping videos.senat.fr)')
  .option('--an-videos', 'Inclure les vidéos AN (videos.assemblee-nationale.fr)')
  .option('--seances-odj', 'Inclure l\'enrichissement ODJ des séances publiques (CSV AN)')
  .option('-l, --limit <number>', 'Limite globale pour tous les types (défaut: TOUT)', parseInt)
  .option('--sources <sources>', 'Sources spécifiques à sync (séparées par des virgules)')
  .option('--skip-stats', 'Ne pas recalculer les stats parlementaires après le sync')
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
        includeSenatHisto: options.senatHisto,
        includeReunions: options.reunions,
        includeSenatReunions: options.senatReunions,
        includeSenatAgenda: options.senatAgenda,
        includeSenatBureaux: options.senatBureaux,
        includeSenatDossierCommissions: options.senatDossierCommissions,
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
        skipStatsCalculation: options.skipStats,
      });

      const syncSummary = {
        duration: result.duration,
        sourcesChecked: result.sourcesChecked.length,
        sourcesChanged: result.sourcesChanged.length,
        sourcesSkipped: result.sourcesSkipped.length,
        sourcesFailed: result.sourcesFailed,
      };
      if (result.sourcesFailed.length > 0) {
        logger.error(syncSummary, 'Smart sync completed with failures');
      } else {
        logger.info(syncSummary, 'Smart sync completed');
      }

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

      if (result.sourcesFailed.length > 0) {
        console.log('\n❌ Sources en échec:');
        for (const source of result.sourcesFailed) {
          console.log(`  ❌ ${source}: ${result.results[source]?.error ?? 'erreur inconnue'}`);
        }
      }

      console.log(`\n⏱️  Durée: ${result.duration}`);

      // Recharger le cache homepage via l'URL publique de l'API
      // Cooldown 120s pour laisser Postgres souffler après le sync
      // Étape 1 : invalider le cache (POST /warm)
      // Étape 2 : reconstruire via GET /homepage (comme un user normal)
      //
      // ⚠️ Ces deux fetch DOIVENT être bornés dans le temps. Sans timeout, un
      // appel qui ne répond jamais empêche d'atteindre le process.exit() qui
      // suit, et le conteneur cron reste alors vivant à ne rien faire jusqu'au
      // déploiement suivant — observé les 19, 20, 21 et 24 juillet 2026, où le
      // dernier log est « Invalidation du cache homepage » suivi de plus rien,
      // pour ~90 Mo retenus pendant des heures.
      console.log('\n⏳ Attente 120s avant rechargement du cache (stabilisation DB)...');
      await new Promise(r => setTimeout(r, 120_000));
      const apiUrl = process.env.API_URL || 'http://localhost:3001';
      // Secret interne partagé avec l'API et le frontend
      const internalSecret = (process.env.CLAIR_INTERNAL_SECRET || '').trim();
      if (internalSecret) {
        try {
          // Invalidation
          console.log('\n🔄 Invalidation du cache homepage...');
          const invalidate = await fetch(`${apiUrl}/api/v1/homepage/warm`, {
            method: 'POST',
            headers: {
              'x-clair-internal': internalSecret,
              'user-agent': 'clair-ingestion/1.0',
            },
            signal: AbortSignal.timeout(CACHE_WARM_TIMEOUT_MS),
          });
          if (!invalidate.ok) {
            console.log(`  ⚠️  Invalidation échouée: status ${invalidate.status}`);
          } else {
            // Rebuild — identique à un user qui arrive sur la homepage
            console.log('  ✅ Cache invalidé, reconstruction...');
            const rebuild = await fetch(`${apiUrl}/api/v1/homepage`, {
              headers: {
                'x-clair-internal': internalSecret,
                'user-agent': 'clair-ingestion/1.0',
              },
              signal: AbortSignal.timeout(CACHE_WARM_TIMEOUT_MS),
            });
            if (rebuild.ok) {
              console.log('  ✅ Cache homepage rechargé');
            } else {
              console.log(`  ⚠️  Rebuild échoué: status ${rebuild.status}`);
            }
          }
        } catch (e) {
          console.log(`  ⚠️  Cache warm indisponible: ${errorMessage(e)}`);
        }
      } else {
        console.log('\n⚠️  CLAIR_INTERNAL_SECRET non configuré — cache homepage non rechargé');
      }

      // Code de sortie : non nul UNIQUEMENT si tout a échoué.
      //
      // Le cron Railway est en ON_FAILURE avec restartPolicyMaxRetries=10. Sur
      // un échec partiel, sortir en 1 relancerait jusqu'à dix syncs complets de
      // ~70 min — qui rejoueraient dix-huit sources déjà réussies pour en
      // retenter une seule, et qui marteleraient les serveurs sources (l'AN
      // nous renvoyait déjà 2 040 HTTP 503 sur un seul run). Le remède serait
      // pire que le mal.
      //
      // Un échec partiel se signale donc par le récapitulatif ❌ et par un
      // logger.error sur stderr, que Railway classe en erreur. Le retry doit
      // vivre au niveau de la source, pas du run entier.
      const toutAEchoue =
        result.sourcesFailed.length > 0 && result.sourcesChanged.length === 0;
      process.exit(toutAEchoue ? 1 : 0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Smart sync failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Status check failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: reconcile-actif
// =============================================================================
program
  .command('reconcile-actif')
  .description("Réaligner parlementaires.actif sur « a un mandat en cours » (date_fin NULL)")
  .action(async () => {
    try {
      const { corrected } = await reconcileActifFromMandats();
      console.log(`✅ ${corrected} parlementaire(s) réaligné(s) (actif ⇔ mandat en cours)`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'reconcile-actif failed');
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
  .option('--include-frozen', 'Recalculer aussi les législatures figées (nécessaire après une ingestion historique)')
  .action(async (options) => {
    try {
      logger.info(
        { chambre: options.chambre || 'all', includeFrozen: !!options.includeFrozen },
        'Starting stats calculation'
      );
      let totalErrors = 0;
      const statsOptions = { includeFrozen: !!options.includeFrozen };

      // Stats parlementaires (sauf si --groupes-only)
      if (!options.groupesOnly) {
        console.log('\n📊 Calcul des statistiques parlementaires...\n');
        const parlResult = await calculateAllStats(options.chambre, statsOptions);
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
        const groupeResult = await calculateAllGroupeStats(options.chambre, statsOptions);
        console.log(`✅ Stats calculées pour ${groupeResult.updated}/${groupeResult.total} groupes`);
        if (groupeResult.errors > 0) {
          console.log(`⚠️  ${groupeResult.errors} erreurs`);
        }
        console.log(`⏱️  Durée: ${groupeResult.duration}`);
        totalErrors += groupeResult.errors;

        // Alliances entre groupes
        console.log('\n🤝 Calcul des alliances entre groupes...\n');
        const alliancesResult = await calculateAllGroupeAlliances(options.chambre, statsOptions);
        console.log(`✅ ${alliancesResult.total} paires d'alliances calculées`);
        console.log(`⏱️  Durée: ${alliancesResult.duration}`);

        // Stats thématiques pour radar chart
        console.log('\n🎯 Calcul des positions thématiques...\n');
        const thematiquesResult = await calculateAllGroupeThematiques(options.chambre, statsOptions);
        console.log(`✅ ${thematiquesResult.total} stats thématiques calculées`);
        console.log(`⏱️  Durée: ${thematiquesResult.duration}`);
      }

      console.log('\n');
      process.exit(totalErrors > 0 ? 1 : 0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Stats calculation failed');
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

    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Scheduler failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'link-scrutins-dossiers failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: backfill-mandats (Phase 0 multi-législatures)
// =============================================================================
program
  .command('backfill-mandats')
  .description('Phase 0 multi-législatures : legislature=17 sur l\'AN + bootstrap des mandats parlementaires (idempotent)')
  .action(async () => {
    try {
      logger.info('Starting backfill mandats parlementaires (Phase 0)...');
      const result = await backfillMandatsParlementaires();
      console.log('\n📊 Backfill Phase 0 multi-législatures :');
      console.log(`   Groupes AN (legislature=17) : ${result.groupesUpdated}`);
      console.log(`   Scrutins AN (legislature=17): ${result.scrutinsUpdated}`);
      console.log(`   Mandats créés               : ${result.mandatsCreated}`);
      console.log(`   Mandats déjà présents       : ${result.mandatsSkipped}`);
      if (result.senateursSerieInconnue > 0) {
        console.log(`   ⚠️  Sénateurs sans mandature (série inconnue): ${result.senateursSerieInconnue}`);
      }
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'backfill-mandats failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: backfill-nature-vote
// =============================================================================
program
  .command('backfill-nature-vote')
  .description('Classer la nature des scrutins (ensemble / article / amendement / motion…) à partir de leur objet')
  .option('--force', 'Reclasser tout le corpus, et pas seulement les scrutins sans nature')
  .action(async (options: { force?: boolean }) => {
    try {
      logger.info('Starting backfill nature_vote...');
      const result = await backfillNatureVote({ force: options.force });
      console.log('\n📊 Nature des scrutins :');
      console.log(`   Scrutins examinés : ${result.scanned}`);
      console.log(`   Natures écrites   : ${result.updated}`);
      const total = Object.values(result.parNature).reduce((s, n) => s + n, 0);
      for (const [nature, n] of Object.entries(result.parNature).sort((a, b) => b[1] - a[1])) {
        const pct = total > 0 ? ((n / total) * 100).toFixed(1) : '0.0';
        console.log(`     ${nature.padEnd(12)} ${String(n).padStart(6)}  ${pct}%`);
      }
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'backfill-nature-vote failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: sync-senateurs-histo
// =============================================================================
program
  .command('sync-senateurs-histo')
  .description('Anciens sénateurs (open data ODSEN) : identités + mandats historiques clos + groupe d\'époque')
  .option(
    '--depuis <date>',
    `Plancher du périmètre (YYYY-MM-DD). Défaut: ouverture de la session ${SENAT_SESSION_MIN} ` +
      `(historique complet). Le smart-sync quotidien, lui, se limite à la fenêtre récente.`,
  )
  .action(async (options) => {
    try {
      const perimetreDebut = options.depuis ? new Date(`${options.depuis}T00:00:00Z`) : undefined;
      if (perimetreDebut && isNaN(perimetreDebut.getTime())) {
        throw new Error(`Date --depuis invalide: ${options.depuis}`);
      }
      logger.info({ perimetreDebut }, 'Starting sync sénateurs historiques (ODSEN)...');
      const result = await syncSenateursHistoriques({ perimetreDebut });
      console.log('\n📊 Sénateurs historiques (ODSEN) :');
      console.log(`   Personnes créées (anciens)  : ${result.personnesCreees}`);
      console.log(`   Personnes enrichies (bio)   : ${result.personnesEnrichies}`);
      console.log(`   Mandats créés               : ${result.mandatsCrees}`);
      console.log(`   Mandats mis à jour          : ${result.mandatsMisAJour}`);
      console.log(`   Sénateurs hors périmètre    : ${result.senateursIgnores}`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'sync-senateurs-histo failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: unlink-wrong-legislature
// =============================================================================
program
  .command('unlink-wrong-legislature')
  .description('Casser les liens scrutin AN → dossier d\'une autre législature (réparation one-shot)')
  .action(async () => {
    try {
      logger.info('Starting AN legislature guard cleanup...');
      const result = await unlinkANScrutinsWrongLegislature();
      console.log(`\n🔗 Garde-fou législature (AN):`);
      console.log(`   Liens cassés: ${result.unlinked}`);
      console.log(`   Les scrutins concernés sont redevenus orphelins.`);
      console.log(`   Relancer generate-sujets pour purger les sujets devenus vides.`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'unlink-wrong-legislature failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'link-scrutins-tfidf failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'link-by-texte-numero failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'link-by-loi-titre failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'link-amendements-dossiers failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Sujet generation failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: relabel-sujets
// =============================================================================
program
  .command('relabel-sujets')
  .description('Recalculer le label des sujets restés sur un UID technique (DLR5L…). Ne touche pas aux slugs')
  .option('--dry-run', 'Afficher les changements sans modifier la DB')
  .action(async (options) => {
    try {
      const { relabelTechnicalSujets } = await import('./workers/sujet-generator.js');
      const result = await relabelTechnicalSujets({ dryRun: options.dryRun });

      console.log(`\n🏷️  Labels techniques${options.dryRun ? ' (DRY RUN)' : ''}:`);
      console.log(`   Examinés: ${result.examined}`);
      console.log(`   Renommés: ${result.relabeled}`);
      console.log(`   Sans intitulé exploitable: ${result.stillTechnical}`);
      for (const c of result.changes) {
        console.log(`   ${c.slug}`);
        console.log(`      ${c.before}  →  ${c.after}`);
      }

      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'relabel-sujets failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: reslug-sujets
// =============================================================================
program
  .command('reslug-sujets')
  .description('Recalculer le slug des sujets restés sur un identifiant technique. CASSE les anciennes URLs')
  .option('--dry-run', 'Afficher les changements sans modifier la DB')
  .action(async (options) => {
    try {
      const { reslugTechnicalSujets } = await import('./workers/sujet-generator.js');
      const result = await reslugTechnicalSujets({ dryRun: options.dryRun });

      console.log(`\n🔗 Slugs techniques${options.dryRun ? ' (DRY RUN)' : ''}:`);
      console.log(`   Examinés: ${result.examined}`);
      console.log(`   Renommés: ${result.reslugged}`);
      console.log(`   Laissés en l'état: ${result.skipped}`);
      for (const c of result.changes) {
        console.log(`   [${String(c.scrutinCount).padStart(4)} scrutins]  ${c.before}  →  ${c.after}`);
      }
      if (!options.dryRun && result.reslugged > 0) {
        console.log(`\n   ⚠️  ${result.reslugged} URLs publiques ont changé. Purger Redis (sujets:*, sitemap:*).`);
      }

      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'reslug-sujets failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Sujet links generation failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Sujet context links generation failed');
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
  .option('--skip-recent-days <number>', 'Avec --random : exclure les fiches déjà rafraîchies dans les N derniers jours (défaut 3, 0 pour désactiver)', parseInt)
  .option('-l, --limit <number>', 'Nombre max d\'entités à traiter', parseInt)
  .option('--dry-run', 'Mode simulation (calcule mais n\'écrit pas)')
  .option('--force', 'Ignorer le hash, regénérer tout')
  .option('--only <ids...>', 'Restreindre à des entités précises (id de scrutin, uid de dossier, slug de sujet). Corrige une fiche fautive sans relancer tout le corpus')
  .option('--rehash', 'Recalculer et stocker le hash de contenu SANS appeler le LLM ni modifier les textes. À utiliser après un changement de formule de hash sur un corpus déjà correct')
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
        skipRecentDays: options.skipRecentDays,
        only: options.only,
        rehashOnly: options.rehash,
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'IA enrichment failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: sync-evenements
// =============================================================================
program
  .command('sync-evenements')
  .description('Événements institutionnels de l\'agenda (élections, sessions, suspensions, budget) — liste curée, idempotent')
  .action(async () => {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        const { syncEvenements } = await import('./workers/evenements.js');
        const result = await syncEvenements(prisma);
        console.log('\n📅 Événements institutionnels :');
        console.log(`   Créés      : ${result.created}`);
        console.log(`   Mis à jour : ${result.updated}`);
        console.log(`   Total      : ${result.total}`);
        process.exit(0);
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'sync-evenements failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'Quality check failed');
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
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'IA quality check failed');
      process.exit(1);
    }
  });

// =============================================================================
// COMMANDE: sync-textes-articles
// =============================================================================
program
  .command('segmenter-debats-senat')
  .description("Situer les interventions du Sénat dans la structure du débat (index debats.zip)")
  .option('--depuis-annee <n>', 'Année de départ', (v: string) => parseInt(v, 10), 2024)
  .option('--chemin <fichier>', 'Dump debats.sql déjà décompressé')
  .option('--dry-run', "Ne rien écrire, compter ce qui serait rapproché")
  .action(async (options: { depuisAnnee: number; chemin?: string; dryRun?: boolean }) => {
    try {
      const { segmenterDebatsSenat } = await import('./workers/segmenter-debats-senat.js');
      const result = await segmenterDebatsSenat({
        depuisAnnee: options.depuisAnnee,
        cheminLocal: options.chemin,
        dryRun: options.dryRun,
      });
      console.log(`\nSegments dans l'index          : ${result.segments}`);
      console.log(`Interventions rapprochées      : ${result.interventionsVisees}`);
      console.log(`Lots traités / en échec        : ${result.lots} / ${result.lotsEnEchec}`);
      console.log(
        `Lignes ${options.dryRun ? 'qui seraient modifiées' : 'modifiées'}         : ${result.lignesModifiees}`,
      );
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'segmenter-debats-senat failed');
      process.exit(1);
    }
  });

program
  .command('link-debats-scrutins')
  .description("Rattacher les débats AN aux scrutins qu'ils ont précédés")
  .option('--legislature <n>', 'Législature à traiter', (v: string) => parseInt(v, 10), 17)
  .option('--max-seances <n>', 'Borne de sécurité pour les essais', (v: string) => parseInt(v, 10))
  .option('--repertoire <chemin>', 'Archive déjà décompressée, au lieu de la retélécharger')
  .option('--dry-run', 'Tout mesurer sans rien écrire')
  .option('--refaire-tout', 'Refaire les séances déjà rattachées')
  .option('--sortie <fichier>', 'Écrire les liens dans un fichier TSV au lieu de la base')
  .action(async (options: { legislature: number; maxSeances?: number; repertoire?: string; dryRun?: boolean; refaireTout?: boolean; sortie?: string }) => {
    try {
      // Chargé à l'exécution, comme sync-debats-an : le module instancie son
      // client Prisma et le conteneur tourne déjà au bord de l'OOM.
      const { linkDebatsScrutins } = await import('./workers/link-debats-scrutins.js');
      const result = await linkDebatsScrutins({
        legislature: options.legislature,
        maxSeances: options.maxSeances,
        repertoireLocal: options.repertoire,
        dryRun: options.dryRun,
        refaireTout: options.refaireTout,
        sortie: options.sortie,
      });
      console.log(`\nSéances traitées      : ${result.seances}`);
      console.log(`Séances déjà faites   : ${result.seancesIgnorees}`);
      console.log(`Mises aux voix        : ${result.misesAuxVoix}`);
      console.log(`  rattachées          : ${result.votesApparies}`);
      console.log(`  indiscernables      : ${result.votesAmbigus}`);
      console.log(`  sans scrutin        : ${result.votesSansScrutin}`);
      console.log(`Liens débat-scrutin   : ${result.liens}${options.dryRun ? ' (dry-run)' : ''}`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'link-debats-scrutins failed');
      process.exit(1);
    }
  });

program
  .command('link-debats-scrutins-senat')
  .description('Rattacher les débats du Sénat aux scrutins, par le sujet examiné')
  .option('--depuis-annee <n>', 'Borne basse des séances à lire', (v: string) => parseInt(v, 10), 2024)
  .option('--debats <chemin>', 'Dump debats.sql déjà décompressé')
  .option('--dosleg <chemin>', 'Dump dosleg.sql déjà décompressé')
  .option('--dry-run', 'Tout mesurer sans rien écrire')
  .option('--refaire-tout', 'Refaire les scrutins déjà rattachés')
  .option('--sortie <fichier>', 'Écrire les liens dans un fichier TSV au lieu de la base')
  .action(async (options: { depuisAnnee: number; debats?: string; dosleg?: string; dryRun?: boolean; refaireTout?: boolean; sortie?: string }) => {
    try {
      // Chargé à l'exécution, comme le rattachement de l'Assemblée : le module
      // instancie son client Prisma et le conteneur tourne au bord de l'OOM.
      const { linkDebatsScrutinsSenat } = await import('./workers/link-debats-scrutins-senat.js');
      const result = await linkDebatsScrutinsSenat({
        depuisAnnee: options.depuisAnnee,
        cheminDebats: options.debats,
        cheminDosleg: options.dosleg,
        dryRun: options.dryRun,
        refaireTout: options.refaireTout,
        sortie: options.sortie,
      });
      console.log(`\nSections lues         : ${result.sections}`);
      console.log(`Scrutins examinés     : ${result.scrutins}`);
      console.log(`Scrutins déjà faits   : ${result.scrutinsIgnores}`);
      console.log(`  rattachés           : ${result.rattaches}`);
      console.log(`  sans débat          : ${result.sansDebat}`);
      console.log(`  sans intervention   : ${result.rattachesSansIntervention}`);
      for (const [via, n] of Object.entries(result.parVia).sort((a, b) => b[1] - a[1])) {
        console.log(`    par ${via.padEnd(15)} ${n}`);
      }
      console.log(`Liens débat-scrutin   : ${result.liens}${options.dryRun ? ' (dry-run)' : ''}`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'link-debats-scrutins-senat failed');
      process.exit(1);
    }
  });

program
  .command('sync-debats-an')
  .description("Ingérer les comptes rendus de séance AN (source syceron, remplace DILA)")
  .option('--legislature <n>', 'Législature à moissonner', (v: string) => parseInt(v, 10), 17)
  .option('--max-seances <n>', 'Borne de sécurité pour les essais', (v: string) => parseInt(v, 10))
  .option('--repertoire <chemin>', 'Archive déjà décompressée, au lieu de la retélécharger')
  .option('--reingerer', 'Relire les séances déjà en base et y remplacer les interventions')
  .action(async (options: { legislature: number; maxSeances?: number; repertoire?: string; reingerer?: boolean }) => {
    try {
      // Chargé à l'exécution : le module instancie son client Prisma, et le
      // conteneur d'ingestion tourne déjà au bord de l'OOM.
      const { syncInterventionsSyceron } = await import('./workers/interventions-syceron.js');
      const result = await syncInterventionsSyceron({
        legislature: options.legislature,
        maxSeances: options.maxSeances,
        repertoireLocal: options.repertoire,
        reingerer: options.reingerer,
      });
      console.log(`\nSéances lues          : ${result.seances}`);
      console.log(`Séances déjà en base  : ${result.seancesIgnorees}`);
      console.log(`Interventions écrites : ${result.interventions}`);
      console.log(`Orateurs non résolus  : ${result.sansParlementaire}`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'sync-debats-an failed');
      process.exit(1);
    }
  });

program
  .command('link-interventions-dossiers')
  .description("Rattacher les prises de parole à leur texte (numéro de dépôt → dossier)")
  .option('--refaire-tout', 'Reposer le dossier même là où il est déjà renseigné')
  .option('--dry-run', "Ne rien écrire, dire ce qui serait posé")
  .action(async (options: { refaireTout?: boolean; dryRun?: boolean }) => {
    try {
      const { lierInterventionsAuxDossiers } = await import('./workers/link-interventions-dossiers.js');
      const r = await lierInterventionsAuxDossiers({
        refaireTout: options.refaireTout,
        dryRun: options.dryRun,
      });
      console.log(`\nNuméros de texte vus     : ${r.numerosVus}`);
      console.log(`Numéros résolus          : ${r.numerosResolus}`);
      console.log(`Prises de parole situées : ${r.interventions}`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'link-interventions-dossiers failed');
      process.exit(1);
    }
  });

program
  .command('sync-avis-commission')
  .description("Ingérer les avis de commission sur les amendements (réunions articles 86/88/91)")
  .option('--depuis <date>', 'Ne regarder que les réunions tenues depuis cette date (AAAA-MM-JJ)')
  .option('--max-reunions <n>', 'Borne de sécurité pour les essais', (v: string) => parseInt(v, 10))
  .option('--seulement <refs...>', 'Ne traiter que ces références de compte rendu')
  .option('--reingerer', 'Relire les réunions déjà ingérées et y remplacer les avis')
  .option('--dry-run', "Ne rien écrire, compter ce qui serait ingéré")
  .action(async (options: {
    depuis?: string;
    maxReunions?: number;
    seulement?: string[];
    reingerer?: boolean;
    dryRun?: boolean;
  }) => {
    try {
      const { syncAvisCommission } = await import('./workers/avis-commission.js');
      const r = await syncAvisCommission({
        depuis: options.depuis ? new Date(options.depuis) : undefined,
        maxReunions: options.maxReunions,
        seulement: options.seulement,
        reingerer: options.reingerer,
        dryRun: options.dryRun,
      });
      console.log(`\nRéunions lues            : ${r.reunionsLues}`);
      console.log(`Avis écrits              : ${r.avis}`);
      console.log(`  dont liés à un amdt    : ${r.avisRattaches}`);
      console.log(`Sans compte rendu publié : ${r.sansCompteRendu}`);
      console.log(`Sans tableau (débats)    : ${r.sansTableau}`);
      console.log(`Tableaux illisibles      : ${r.tableauxNonLus}`);
      console.log(`Sans texte nommé         : ${r.sansTexteNomme}`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'sync-avis-commission failed');
      process.exit(1);
    }
  });

program
  .command('sync-intraday')
  .description("Rafraîchir ce qui bouge dans la journée : agendas du jour et vidéos (AN + Sénat)")
  .action(async () => {
    try {
      const { syncIntraday } = await import('./workers/sync.js');
      const r = await syncIntraday();
      console.log(`\nAgenda Sénat — réunions  : ${r.agendaSenatReunions}`);
      console.log(`Agenda Sénat — séances   : ${r.agendaSenatSeances}`);
      console.log(`Vidéos Sénat (séance)    : ${r.videosSenatSeance}`);
      console.log(`Vidéos Sénat (commission): ${r.videosSenatCommission}`);
      console.log(`Vidéos AN                : ${r.videosAn}`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'sync-intraday failed');
      process.exit(1);
    }
  });

program
  .command('sync-agenda-senat')
  .description("Moissonner l'agenda du Sénat sur une fenêtre de jours (API senat.fr, 1 requête par jour)")
  .option('--jours-avant <n>', 'Jours à remonter dans le passé', (v: string) => parseInt(v, 10), 45)
  .option('--jours-apres <n>', 'Jours à couvrir dans le futur', (v: string) => parseInt(v, 10), 30)
  .action(async (options: { joursAvant: number; joursApres: number }) => {
    try {
      const { syncSenatAgenda } = await import('./workers/sync.js');
      const r = await syncSenatAgenda({
        daysBack: options.joursAvant,
        daysAhead: options.joursApres,
      });
      console.log(`\nSéances créées   : ${r.created}`);
      console.log(`Séances mises à jour : ${r.updated}`);
      console.log(`Réunions créées  : ${r.reunionsCreated}`);
      console.log(`Réunions mises à jour : ${r.reunionsUpdated}`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'sync-agenda-senat failed');
      process.exit(1);
    }
  });

program
  .command('sync-videos-commission-senat')
  .description('Rattacher les vidéos de réunion de commission du Sénat (videos.senat.fr)')
  .action(async () => {
    try {
      const { syncSenatVideosCommission } = await import('./workers/sync.js');
      const r = await syncSenatVideosCommission();
      console.log(`\nVidéos au catalogue      : ${r.videos}`);
      console.log(`Réunions liées           : ${r.liees}`);
      console.log(`Commission inconnue      : ${r.commissionInconnue}`);
      console.log(`Aucune réunion ce jour   : ${r.sansReunion}`);
      console.log(`Réunion ambiguë          : ${r.reunionAmbigue}`);
      console.log(`Plusieurs vidéos         : ${r.plusieursVideos}`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'sync-videos-commission-senat failed');
      process.exit(1);
    }
  });

program
  .command('sync-debats-commission')
  .description("Ingérer les comptes rendus de réunion de commission AN (source : PDF du portail)")
  .option('--max-reunions <n>', 'Borne de sécurité pour les essais', (v: string) => parseInt(v, 10))
  .option('--depuis <date>', 'Ne regarder que les réunions tenues depuis cette date (AAAA-MM-JJ)')
  .option('--seulement <refs...>', 'Ne traiter que ces références de compte rendu')
  .option('--reingerer', 'Relire les réunions déjà ingérées et y remplacer les prises de parole')
  .option('--dry-run', "Ne rien écrire, compter ce qui serait ingéré")
  .action(async (options: {
    maxReunions?: number;
    depuis?: string;
    seulement?: string[];
    reingerer?: boolean;
    dryRun?: boolean;
  }) => {
    try {
      // Chargé à l'exécution, comme les débats de séance : le module instancie
      // son client Prisma et le conteneur d'ingestion tourne au bord de l'OOM.
      const { syncInterventionsCommission } = await import('./workers/interventions-commission.js');
      const r = await syncInterventionsCommission({
        maxReunions: options.maxReunions,
        depuis: options.depuis ? new Date(options.depuis) : undefined,
        seulement: options.seulement,
        reingerer: options.reingerer,
        dryRun: options.dryRun,
      });
      console.log(`\nRéunions lues            : ${r.reunionsLues}`);
      console.log(`Prises de parole écrites : ${r.interventions}`);
      console.log(`Sans compte rendu publié : ${r.sansCompteRendu}`);
      console.log(`Réunions d'amendements   : ${r.reunionsDAmendements}`);
      console.log(`Renvoyées à la vidéo     : ${r.videoSeule}`);
      console.log(`Forme inconnue           : ${r.formeInconnue}`);
      console.log(`Orateurs non résolus     : ${r.sansParlementaire}`);
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'sync-debats-commission failed');
      process.exit(1);
    }
  });

program
  .command('sync-textes-articles')
  .description("Récupérer le texte des articles des textes législatifs AN (matière des résumés IA)")
  .option('--texte <ref>', 'Ne traiter que ce texteRef (ex: PIONANR5L17BTC1364)')
  .option('--limit <n>', 'Nombre maximum de textes traités', (v: string) => parseInt(v, 10))
  .option('--force', 'Retraiter les textes déjà en base')
  .option('--dry-run', "Ne rien écrire, afficher ce qui serait ingéré")
  .action(async (options: { texte?: string; limit?: number; force?: boolean; dryRun?: boolean }) => {
    try {
      const result = await syncTextesArticles({
        texteRef: options.texte,
        limit: options.limit,
        force: options.force,
        dryRun: options.dryRun,
      });
      console.log(`\nTextes considérés   : ${result.textesConsideres}`);
      console.log(`Textes traités      : ${result.textesTraites}`);
      console.log(`Textes déjà ingérés : ${result.textesIgnores}`);
      console.log(`Textes non servis    : ${result.textesNonServis}`);
      console.log(`Gabarit non couvert : ${result.textesGabaritInconnu}`);
      console.log(`Articles écrits     : ${result.articlesEcrits}`);
      console.log(`Articles remplacés  : ${result.articlesRemplaces}`);
      if (result.refsGabaritInconnu.length > 0) {
        console.log(`\nTextes au gabarit non couvert (budgets) :`);
        for (const ref of result.refsGabaritInconnu) console.log(`  - ${ref}`);
      }
      process.exit(0);
    } catch (error) {
      logger.error({ error: errorMessage(error) }, 'sync-textes-articles failed');
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
