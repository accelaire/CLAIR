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
  .option('--amendements-senat', 'Synchroniser uniquement les amendements Sénat (CSV senat.fr)')
  .option('--amendements-senat-ameli', 'Synchroniser les amendements Sénat via AMELI (ancien mode, commission uniquement)')
  .option('--texte-ids <ids>', 'IDs texte AMELI à cibler (séparés par des virgules, avec --amendements-senat)')
  .option('-D, --dossiers', 'Synchroniser uniquement les dossiers législatifs (AN Open Data)')
  .option('--dossiers-senat', 'Synchroniser uniquement les dossiers législatifs Sénat (data.senat.fr DOSLEG)')
  .option('--link-interventions', 'Lier les interventions aux scrutins (par seanceRef ou date)')
  .option('--link-amendements', 'Lier les scrutins aux amendements (par parsing du titre)')
  .option('--enrich-amendements-an', 'Enrichir les scrutins AN en scrappant la page HTML pour extraire le lien amendement')
  .option('--enrich-amendements-senat', 'Enrichir les scrutins Sénat en scrappant la page HTML pour extraire le lien amendement')
  .option('--reset', 'Avec --link-amendements: réinitialiser les liens existants avant de re-lier')
  .option('-L, --lobbying', 'Synchroniser uniquement les lobbyistes (HATVP)')
  .option('--declarations', 'Synchroniser les déclarations HATVP (intérêts & patrimoine des parlementaires)')
  .option('-l, --limit <number>', 'Limiter le nombre de scrutins/séances/amendements/lobbyistes', parseInt)
  .option('--no-actions', 'Ne pas synchroniser les actions de lobbying (avec -L)')
  .option('--dry-run', 'Mode simulation (affiche ce qui serait fait sans modifier)')
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
        const texteIds = options.texteIds
          ? options.texteIds.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n))
          : undefined;
        await syncAmendementsSenatCsv({ texteIds });
      } else if (options.amendementsSenatAmeli) {
        await syncAmendementsSenat({ maxAmendements: options.limit });
      } else if (options.dossiers) {
        await syncDossiers({ limit: options.limit });
      } else if (options.dossiersSenat) {
        await syncDossiersSenat({ limit: options.limit });
      } else if (options.linkInterventions) {
        const result = await linkInterventionsToScrutins({ dryRun: options.dryRun });
        console.log(`\n📊 Interventions liées: ${result.linked}`);
        console.log(`   - Par seanceRef: ${result.bySeanceRef}`);
        console.log(`   - Par date: ${result.byDate}`);
      } else if (options.linkAmendements) {
        const result = await linkScrutinsToAmendements({
          dryRun: options.dryRun,
          reset: options.reset,
        });
        console.log(`\n📊 Scrutins liés à des amendements: ${result.linked}`);
        console.log(`   - Non trouvés en base: ${result.notFound}`);
        if (options.reset && !options.dryRun) {
          console.log(`   ⚠️  Les liens existants ont été réinitialisés avant re-linkage`);
        }
      } else if (options.enrichAmendementsAn) {
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
      } else if (options.enrichAmendementsSenat) {
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
      } else if (options.lobbying) {
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
  .option('-A, --amendements', 'Inclure les amendements (AN + Sénat)')
  .option('-D, --dossiers', 'Inclure les dossiers législatifs (AN)')
  .option('-I, --interventions', 'Inclure les interventions (DILA + Sénat)')
  .option('-L, --lobbying', 'Inclure les lobbyistes')
  .option('--scrutins-limit <number>', 'Limite pour les scrutins (défaut: TOUT)', parseInt)
  .option('--amendements-limit <number>', 'Limite pour les amendements (défaut: TOUT)', parseInt)
  .option('--dossiers-limit <number>', 'Limite pour les dossiers législatifs (défaut: TOUT)', parseInt)
  .option('--interventions-limit <number>', 'Limite pour les interventions (défaut: TOUT)', parseInt)
  .option('--lobbying-limit <number>', 'Limite pour les lobbyistes (défaut: TOUT)', parseInt)
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
        scrutinsLimit: options.scrutinsLimit,
        amendementsLimit: options.amendementsLimit,
        dossiersLimit: options.dossiersLimit,
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
// COMMANDE: enrich-ia
// =============================================================================
program
  .command('enrich-ia')
  .description('Enrichir les entités parlementaires via IA (Mistral) — résumés accessibles')
  .option('--scrutins', 'Enrichir uniquement les scrutins')
  .option('--dossiers', 'Enrichir uniquement les dossiers')
  .option('--sujets', 'Enrichir uniquement les sujets')
  .option('--parlementaires', 'Enrichir uniquement les fiches parlementaires (Wikipedia + Tavily + Mistral)')
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
      };

      // Sans flag spécifique → cascade complète : scrutins → dossiers → sujets → parlementaires
      const enrichAll = !options.scrutins && !options.dossiers && !options.sujets && !options.parlementaires;

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

      if (options.parlementaires || enrichAll) {
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
        const report = await runDataQualityChecks(prisma);
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

program.parse();
