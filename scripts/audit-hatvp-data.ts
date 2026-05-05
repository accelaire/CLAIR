/**
 * Script d'audit complet des données HATVP (lobbying)
 *
 * Compare nos données avec les chiffres officiels HATVP et vérifie la cohérence interne.
 *
 * Usage: npx ts-node scripts/audit-hatvp-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Chiffres officiels HATVP (source: https://www.hatvp.fr/le-repertoire/)
// Mis à jour le 2026-01-09
const HATVP_OFFICIAL = {
  representants: 3451,
  representantsAvecActivites: 3220,
  activites: 107791,
  dateVerification: '2026-01-09',
};

interface AuditResult {
  section: string;
  status: 'OK' | 'WARNING' | 'ERROR' | 'INFO';
  message: string;
  details?: Record<string, unknown>;
}

const results: AuditResult[] = [];

function log(result: AuditResult) {
  const icon = {
    OK: '✓',
    WARNING: '⚠',
    ERROR: '✗',
    INFO: 'ℹ',
  }[result.status];

  console.log(`${icon} [${result.section}] ${result.message}`);
  if (result.details) {
    for (const [key, value] of Object.entries(result.details)) {
      console.log(`    ${key}: ${JSON.stringify(value)}`);
    }
  }
  results.push(result);
}

async function auditLobbyistes() {
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT DES LOBBYISTES (Représentants d\'intérêts)');
  console.log('='.repeat(60) + '\n');

  // 1. Comptage total
  const totalLobbyistes = await prisma.lobbyiste.count();
  const ecartRepresentants = totalLobbyistes - HATVP_OFFICIAL.representants;
  const ecartPct = ((ecartRepresentants / HATVP_OFFICIAL.representants) * 100).toFixed(1);

  log({
    section: 'Lobbyistes',
    status: Math.abs(ecartRepresentants) > 100 ? 'WARNING' : 'OK',
    message: `Total: ${totalLobbyistes} (HATVP officiel: ${HATVP_OFFICIAL.representants})`,
    details: {
      ecart: `${ecartRepresentants > 0 ? '+' : ''}${ecartRepresentants} (${ecartPct}%)`,
    },
  });

  // 2. Analyse des doublons potentiels par SIREN
  const sirenDuplicates = await prisma.$queryRaw<Array<{ siren: string; count: bigint }>>`
    SELECT siren, COUNT(*) as count
    FROM lobbyistes
    WHERE siren IS NOT NULL AND siren != ''
    GROUP BY siren
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `;

  const totalSirenDuplicates = sirenDuplicates.reduce((acc, d) => acc + Number(d.count) - 1, 0);

  log({
    section: 'Doublons SIREN',
    status: totalSirenDuplicates > 50 ? 'WARNING' : 'INFO',
    message: `${sirenDuplicates.length} SIREN partagés par plusieurs entités (${totalSirenDuplicates} entrées "supplémentaires")`,
    details: sirenDuplicates.length > 0 ? {
      top5: sirenDuplicates.slice(0, 5).map(d => `SIREN ${d.siren}: ${d.count} entités`),
    } : undefined,
  });

  // 3. Analyse des doublons potentiels par nom (similarité)
  const nameDuplicates = await prisma.$queryRaw<Array<{ nom: string; count: bigint }>>`
    SELECT UPPER(TRIM(nom)) as nom, COUNT(*) as count
    FROM lobbyistes
    GROUP BY UPPER(TRIM(nom))
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10
  `;

  log({
    section: 'Doublons Nom',
    status: nameDuplicates.length > 20 ? 'WARNING' : 'INFO',
    message: `${nameDuplicates.length} noms identiques (casse ignorée)`,
    details: nameDuplicates.length > 0 ? {
      exemples: nameDuplicates.slice(0, 5).map(d => `"${d.nom}": ${d.count} fois`),
    } : undefined,
  });

  // 4. Distribution par type
  const byType = await prisma.lobbyiste.groupBy({
    by: ['type'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  log({
    section: 'Types',
    status: 'INFO',
    message: 'Distribution par type de représentant',
    details: {
      distribution: byType.map(t => `${t.type}: ${t._count.id}`),
    },
  });

  // 5. Lobbyistes sans identifiantNational (potentiellement créés manuellement ou problème)
  const sansSourceId = await prisma.lobbyiste.count({
    where: { identifiantNational: null },
  });

  log({
    section: 'Source',
    status: sansSourceId > 0 ? 'WARNING' : 'OK',
    message: `${sansSourceId} lobbyistes sans identifiantNational HATVP`,
  });

  // 6. Lobbyistes avec actions vs sans actions
  const avecActions = await prisma.lobbyiste.count({
    where: { actions: { some: {} } },
  });

  const ecartAvecActivites = avecActions - HATVP_OFFICIAL.representantsAvecActivites;

  log({
    section: 'Avec activités',
    status: Math.abs(ecartAvecActivites) > 100 ? 'WARNING' : 'OK',
    message: `${avecActions} lobbyistes avec au moins 1 action (HATVP: ${HATVP_OFFICIAL.representantsAvecActivites})`,
    details: {
      ecart: `${ecartAvecActivites > 0 ? '+' : ''}${ecartAvecActivites}`,
      sansActions: totalLobbyistes - avecActions,
    },
  });

  return { totalLobbyistes, avecActions, sirenDuplicates: totalSirenDuplicates };
}

async function auditActions() {
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT DES ACTIONS (Activités de lobbying)');
  console.log('='.repeat(60) + '\n');

  // 1. Comptage total
  const totalActions = await prisma.actionLobby.count();
  const ecartActions = totalActions - HATVP_OFFICIAL.activites;
  const ecartPct = ((ecartActions / HATVP_OFFICIAL.activites) * 100).toFixed(1);
  const ratio = (totalActions / HATVP_OFFICIAL.activites).toFixed(2);

  log({
    section: 'Actions',
    status: ecartActions > HATVP_OFFICIAL.activites ? 'WARNING' : 'OK',
    message: `Total: ${totalActions.toLocaleString('fr-FR')} (HATVP officiel: ${HATVP_OFFICIAL.activites.toLocaleString('fr-FR')})`,
    details: {
      ecart: `${ecartActions > 0 ? '+' : ''}${ecartActions.toLocaleString('fr-FR')} (${ecartPct}%)`,
      ratio: `${ratio}x le chiffre HATVP`,
    },
  });

  // 2. Distribution par année (via dateDebut)
  const byYear = await prisma.$queryRaw<Array<{ year: number; count: bigint }>>`
    SELECT EXTRACT(YEAR FROM date_debut)::int as year, COUNT(*) as count
    FROM actions_lobby
    GROUP BY year
    ORDER BY year DESC
  `;

  log({
    section: 'Par année',
    status: 'INFO',
    message: 'Distribution des actions par année de début',
    details: {
      distribution: byYear.map(y => `${y.year}: ${Number(y.count).toLocaleString('fr-FR')}`),
    },
  });

  // 3. Nombre moyen d'actions par lobbyiste
  const avgActions = await prisma.$queryRaw<Array<{ avg: number }>>`
    SELECT AVG(action_count)::float as avg
    FROM (
      SELECT lobbyiste_id, COUNT(*) as action_count
      FROM actions_lobby
      GROUP BY lobbyiste_id
    ) sub
  `;

  const moyenneActions = avgActions[0]?.avg?.toFixed(1) || 'N/A';

  log({
    section: 'Moyenne',
    status: 'INFO',
    message: `${moyenneActions} actions en moyenne par lobbyiste`,
  });

  // 4. Top lobbyistes par nombre d'actions
  const topLobbyistes = await prisma.lobbyiste.findMany({
    select: {
      nom: true,
      type: true,
      _count: { select: { actions: true } },
    },
    orderBy: { actions: { _count: 'desc' } },
    take: 10,
  });

  log({
    section: 'Top 10',
    status: 'INFO',
    message: 'Lobbyistes avec le plus d\'actions',
    details: {
      top: topLobbyistes.map((l, i) => `${i + 1}. ${l.nom} (${l.type}): ${l._count.actions} actions`),
    },
  });

  // 5. Actions sans lobbyiste valide (orphelines)
  const orphanActions = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM actions_lobby al
    LEFT JOIN lobbyistes l ON al.lobbyiste_id = l.id
    WHERE l.id IS NULL
  `;

  const nbOrphans = Number(orphanActions[0]?.count || 0);

  log({
    section: 'Orphelins',
    status: nbOrphans > 0 ? 'ERROR' : 'OK',
    message: `${nbOrphans} actions sans lobbyiste associé`,
  });

  // 6. Actions avec cible parlementaire identifiée
  const avecParlementaire = await prisma.actionLobby.count({
    where: { parlementaireId: { not: null } },
  });

  log({
    section: 'Cibles',
    status: 'INFO',
    message: `${avecParlementaire.toLocaleString('fr-FR')} actions liées à un parlementaire identifié (${((avecParlementaire / totalActions) * 100).toFixed(1)}%)`,
  });

  // 7. Analyse des descriptions uniques vs totales
  const uniqueDescriptions = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT description) as count
    FROM actions_lobby
  `;

  const nbUniqueDesc = Number(uniqueDescriptions[0]?.count || 0);
  const duplicationRatio = (totalActions / nbUniqueDesc).toFixed(2);

  log({
    section: 'Unicité',
    status: Number(duplicationRatio) > 3 ? 'WARNING' : 'INFO',
    message: `${nbUniqueDesc.toLocaleString('fr-FR')} descriptions uniques pour ${totalActions.toLocaleString('fr-FR')} actions`,
    details: {
      ratio: `${duplicationRatio}x (chaque description apparaît en moyenne ${duplicationRatio} fois)`,
      explication: 'Un ratio élevé indique que les mêmes activités sont comptées sur plusieurs exercices',
    },
  });

  // 8. Vérifier si même description + même lobbyiste sur plusieurs années
  const multiYearActivities = await prisma.$queryRaw<Array<{ count: bigint; years: number }>>`
    SELECT COUNT(*) as count, COUNT(DISTINCT EXTRACT(YEAR FROM date_debut)) as years
    FROM actions_lobby
    GROUP BY lobbyiste_id, description
    HAVING COUNT(DISTINCT EXTRACT(YEAR FROM date_debut)) > 1
  `;

  const nbMultiYear = multiYearActivities.length;

  log({
    section: 'Multi-exercices',
    status: nbMultiYear > 1000 ? 'WARNING' : 'INFO',
    message: `${nbMultiYear.toLocaleString('fr-FR')} couples (lobbyiste, description) présents sur plusieurs années`,
    details: {
      explication: 'Ces activités identiques sur plusieurs exercices expliquent l\'écart avec HATVP',
    },
  });

  return { totalActions, byYear, nbMultiYear };
}

async function auditFraicheur() {
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT DE LA FRAÎCHEUR DES DONNÉES');
  console.log('='.repeat(60) + '\n');

  // 1. Dernière mise à jour des lobbyistes
  const dernierLobbyiste = await prisma.lobbyiste.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true, nom: true },
  });

  log({
    section: 'Lobbyistes',
    status: 'INFO',
    message: `Dernière MAJ: ${dernierLobbyiste?.updatedAt?.toISOString() || 'N/A'}`,
    details: { dernier: dernierLobbyiste?.nom },
  });

  // 2. Dernière action créée
  const derniereAction = await prisma.actionLobby.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, description: true },
  });

  log({
    section: 'Actions',
    status: 'INFO',
    message: `Dernière création: ${derniereAction?.createdAt?.toISOString() || 'N/A'}`,
  });

  // 3. Action la plus récente par dateDebut
  const actionPlusRecente = await prisma.actionLobby.findFirst({
    orderBy: { dateDebut: 'desc' },
    select: { dateDebut: true, description: true },
  });

  log({
    section: 'Activité récente',
    status: 'INFO',
    message: `Activité la plus récente: ${actionPlusRecente?.dateDebut?.toISOString().split('T')[0] || 'N/A'}`,
  });

  // 4. Vérifier SourceState pour HATVP
  const sourceState = await prisma.$queryRaw<Array<{ source_type: string; last_sync: Date; status: string }>>`
    SELECT source_type, last_sync, status
    FROM source_states
    WHERE source_type ILIKE '%hatvp%' OR source_type ILIKE '%lobby%'
    LIMIT 5
  `.catch(() => []);

  if (sourceState.length > 0) {
    log({
      section: 'SourceState',
      status: 'INFO',
      message: 'États de synchronisation HATVP',
      details: {
        sources: sourceState.map(s => `${s.source_type}: ${s.last_sync?.toISOString() || 'N/A'} (${s.status})`),
      },
    });
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('RAPPORT DE SYNTHÈSE');
  console.log('='.repeat(60) + '\n');

  const errors = results.filter(r => r.status === 'ERROR');
  const warnings = results.filter(r => r.status === 'WARNING');
  const oks = results.filter(r => r.status === 'OK');

  console.log(`Résultats: ${oks.length} OK, ${warnings.length} Warnings, ${errors.length} Erreurs\n`);

  if (warnings.length > 0) {
    console.log('--- POINTS D\'ATTENTION ---');
    for (const w of warnings) {
      console.log(`⚠ ${w.section}: ${w.message}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n--- ERREURS ---');
    for (const e of errors) {
      console.log(`✗ ${e.section}: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('EXPLICATION DE LA MÉTHODOLOGIE CLAIR');
  console.log('='.repeat(60) + '\n');

  console.log(`
POURQUOI LES CHIFFRES CLAIR DIFFÈRENT DE HATVP ?

1. DÉFINITION DES "ACTIONS"
   - HATVP compte les "activités déclarées" de façon agrégée
   - CLAIR compte chaque déclaration d'activité PAR EXERCICE FISCAL

   Exemple: Si un lobbyiste déclare la même activité "Suivi du projet de loi X"
   sur les exercices 2022, 2023 et 2024, CLAIR compte 3 actions (une par exercice)
   alors que HATVP peut compter 1 activité.

2. INCLUSION DES DONNÉES HISTORIQUES
   - CLAIR conserve l'historique complet des déclarations
   - Cela permet de suivre l'évolution du lobbying dans le temps
   - HATVP peut afficher uniquement les données "en cours" ou récentes

3. CLIENTS DES CABINETS
   - Les cabinets de lobbying déclarent les activités de leurs clients
   - CLAIR inclut ces activités pour une transparence maximale

4. REPRÉSENTANTS (LOBBYISTES)
   - Certaines entités peuvent avoir plusieurs inscriptions HATVP
     (branches régionales, filiales avec même SIREN)
   - CLAIR les compte comme entités distinctes si elles ont des identifiants différents

NOTRE ENGAGEMENT: Transparence maximale sur les données brutes HATVP,
sans filtrage ni agrégation qui pourrait masquer des informations.

Référence HATVP: ${HATVP_OFFICIAL.dateVerification}
  `);
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         AUDIT QUALITÉ DONNÉES HATVP - CLAIR                ║');
  console.log('║                                                            ║');
  console.log(`║  Date: ${new Date().toISOString().split('T')[0]}                                       ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await auditLobbyistes();
    await auditActions();
    await auditFraicheur();
    await generateReport();
  } catch (error) {
    console.error('Erreur lors de l\'audit:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
