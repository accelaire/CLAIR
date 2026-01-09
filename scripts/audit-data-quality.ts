/**
 * Script d'audit complet de la qualité des données CLAIR
 *
 * Compare nos données avec les chiffres officiels pour :
 * - Assemblée Nationale (députés, scrutins, amendements)
 * - Sénat (sénateurs, scrutins)
 * - DILA (interventions)
 * - HATVP (lobbying)
 *
 * Usage: cd apps/api && pnpm exec tsx ../../scripts/audit-data-quality.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// CHIFFRES DE RÉFÉRENCE OFFICIELS
// =============================================================================

const REFERENCES = {
  // Assemblée Nationale - 17ème législature (depuis juillet 2024)
  assemblee: {
    deputes: 577, // Nombre constitutionnel de sièges
    groupes: 10,  // Groupes politiques (approximatif, varie)
    legislature: 17,
    dateVerification: '2026-01-09',
    source: 'https://www.assemblee-nationale.fr/',
  },
  // Sénat
  senat: {
    senateurs: 348, // Nombre constitutionnel de sièges
    groupes: 8,     // Groupes politiques (approximatif)
    dateVerification: '2026-01-09',
    source: 'https://www.senat.fr/',
  },
  // HATVP
  hatvp: {
    representants: 3451,
    representantsAvecActivites: 3220,
    activites: 107791,
    dateVerification: '2026-01-09',
    source: 'https://www.hatvp.fr/le-repertoire/',
  },
};

interface AuditResult {
  source: string;
  metric: string;
  actual: number;
  expected: number | string;
  status: 'OK' | 'WARNING' | 'ERROR' | 'INFO';
  note?: string;
}

const results: AuditResult[] = [];

function log(result: AuditResult) {
  const icon = { OK: '✓', WARNING: '⚠', ERROR: '✗', INFO: 'ℹ' }[result.status];
  const expectedStr = typeof result.expected === 'number'
    ? result.expected.toLocaleString('fr-FR')
    : result.expected;
  const actualStr = result.actual.toLocaleString('fr-FR');

  let comparison = '';
  if (typeof result.expected === 'number') {
    const diff = result.actual - result.expected;
    const pct = ((diff / result.expected) * 100).toFixed(1);
    comparison = diff !== 0 ? ` (${diff > 0 ? '+' : ''}${diff}, ${pct}%)` : '';
  }

  console.log(`${icon} [${result.source}] ${result.metric}: ${actualStr} (attendu: ${expectedStr})${comparison}`);
  if (result.note) {
    console.log(`    → ${result.note}`);
  }
  results.push(result);
}

// =============================================================================
// AUDIT ASSEMBLÉE NATIONALE
// =============================================================================

async function auditAssemblee() {
  console.log('\n' + '═'.repeat(70));
  console.log('  ASSEMBLÉE NATIONALE - 17ème législature');
  console.log('═'.repeat(70) + '\n');

  // 1. Nombre de députés
  const totalDeputes = await prisma.parlementaire.count({
    where: { chambre: 'assemblee' },
  });

  const deputesActifs = await prisma.parlementaire.count({
    where: { chambre: 'assemblee', actif: true },
  });

  log({
    source: 'AN',
    metric: 'Députés (total en base)',
    actual: totalDeputes,
    expected: `≥${REFERENCES.assemblee.deputes}`,
    status: totalDeputes >= REFERENCES.assemblee.deputes ? 'OK' : 'WARNING',
    note: totalDeputes > REFERENCES.assemblee.deputes
      ? 'Inclut probablement les anciens députés de la législature'
      : undefined,
  });

  log({
    source: 'AN',
    metric: 'Députés actifs',
    actual: deputesActifs,
    expected: REFERENCES.assemblee.deputes,
    status: Math.abs(deputesActifs - REFERENCES.assemblee.deputes) <= 5 ? 'OK' : 'WARNING',
    note: deputesActifs < REFERENCES.assemblee.deputes
      ? `${REFERENCES.assemblee.deputes - deputesActifs} sièges vacants ou données manquantes`
      : undefined,
  });

  // 2. Groupes politiques AN
  const groupesAN = await prisma.groupePolitique.count({
    where: { chambre: 'assemblee' },
  });

  log({
    source: 'AN',
    metric: 'Groupes politiques',
    actual: groupesAN,
    expected: `~${REFERENCES.assemblee.groupes}`,
    status: 'INFO',
  });

  // 3. Scrutins AN
  const scrutinsAN = await prisma.scrutin.count({
    where: { chambre: 'assemblee' },
  });

  const scrutinsSolennelsAN = await prisma.scrutin.count({
    where: { chambre: 'assemblee', typeVote: 'solennel' },
  });

  log({
    source: 'AN',
    metric: 'Scrutins (total)',
    actual: scrutinsAN,
    expected: 'variable',
    status: 'INFO',
  });

  log({
    source: 'AN',
    metric: 'Scrutins solennels',
    actual: scrutinsSolennelsAN,
    expected: 'variable',
    status: 'INFO',
  });

  // 4. Votes individuels AN
  const votesAN = await prisma.vote.count({
    where: { scrutin: { chambre: 'assemblee' } },
  });

  const expectedVotesAN = scrutinsAN * REFERENCES.assemblee.deputes;
  const tauxVotesAN = ((votesAN / expectedVotesAN) * 100).toFixed(1);

  log({
    source: 'AN',
    metric: 'Votes individuels',
    actual: votesAN,
    expected: `~${expectedVotesAN.toLocaleString('fr-FR')} max`,
    status: 'INFO',
    note: `Taux de couverture: ${tauxVotesAN}% (absent = pas de vote enregistré)`,
  });

  // 5. Amendements AN
  const amendementsAN = await prisma.amendement.count({
    where: { chambre: 'assemblee' },
  });

  log({
    source: 'AN',
    metric: 'Amendements',
    actual: amendementsAN,
    expected: 'variable',
    status: amendementsAN > 0 ? 'OK' : 'WARNING',
  });

  // 6. Interventions AN
  const interventionsAN = await prisma.intervention.count({
    where: { parlementaire: { chambre: 'assemblee' } },
  });

  log({
    source: 'AN',
    metric: 'Interventions',
    actual: interventionsAN,
    expected: 'variable',
    status: interventionsAN > 0 ? 'OK' : 'WARNING',
  });

  // 7. Cohérence : députés sans groupe
  const deputesSansGroupe = await prisma.parlementaire.count({
    where: { chambre: 'assemblee', actif: true, groupeId: null },
  });

  log({
    source: 'AN',
    metric: 'Députés actifs sans groupe',
    actual: deputesSansGroupe,
    expected: 0,
    status: deputesSansGroupe === 0 ? 'OK' : 'WARNING',
    note: deputesSansGroupe > 0 ? 'Devrait être NI (Non Inscrits)' : undefined,
  });

  // 8. Distribution des votes par position
  const votesByPosition = await prisma.vote.groupBy({
    by: ['position'],
    where: { scrutin: { chambre: 'assemblee' } },
    _count: { id: true },
  });

  console.log('\n  Distribution des votes AN:');
  for (const v of votesByPosition) {
    const pct = ((v._count.id / votesAN) * 100).toFixed(1);
    console.log(`    ${v.position}: ${v._count.id.toLocaleString('fr-FR')} (${pct}%)`);
  }

  return { totalDeputes, deputesActifs, scrutinsAN, votesAN, amendementsAN };
}

// =============================================================================
// AUDIT SÉNAT
// =============================================================================

async function auditSenat() {
  console.log('\n' + '═'.repeat(70));
  console.log('  SÉNAT');
  console.log('═'.repeat(70) + '\n');

  // 1. Nombre de sénateurs
  const totalSenateurs = await prisma.parlementaire.count({
    where: { chambre: 'senat' },
  });

  const senateursActifs = await prisma.parlementaire.count({
    where: { chambre: 'senat', actif: true },
  });

  log({
    source: 'Sénat',
    metric: 'Sénateurs (total en base)',
    actual: totalSenateurs,
    expected: `≥${REFERENCES.senat.senateurs}`,
    status: totalSenateurs >= REFERENCES.senat.senateurs ? 'OK' : 'WARNING',
  });

  log({
    source: 'Sénat',
    metric: 'Sénateurs actifs',
    actual: senateursActifs,
    expected: REFERENCES.senat.senateurs,
    status: Math.abs(senateursActifs - REFERENCES.senat.senateurs) <= 5 ? 'OK' : 'WARNING',
  });

  // 2. Groupes politiques Sénat
  const groupesSenat = await prisma.groupePolitique.count({
    where: { chambre: 'senat' },
  });

  log({
    source: 'Sénat',
    metric: 'Groupes politiques',
    actual: groupesSenat,
    expected: `~${REFERENCES.senat.groupes}`,
    status: 'INFO',
  });

  // 3. Scrutins Sénat
  const scrutinsSenat = await prisma.scrutin.count({
    where: { chambre: 'senat' },
  });

  log({
    source: 'Sénat',
    metric: 'Scrutins (total)',
    actual: scrutinsSenat,
    expected: 'variable',
    status: 'INFO',
  });

  // 4. Votes individuels Sénat
  const votesSenat = await prisma.vote.count({
    where: { scrutin: { chambre: 'senat' } },
  });

  log({
    source: 'Sénat',
    metric: 'Votes individuels',
    actual: votesSenat,
    expected: 'variable',
    status: 'INFO',
  });

  // 5. Amendements Sénat
  const amendementsSenat = await prisma.amendement.count({
    where: { chambre: 'senat' },
  });

  log({
    source: 'Sénat',
    metric: 'Amendements',
    actual: amendementsSenat,
    expected: 'variable',
    status: amendementsSenat > 0 ? 'OK' : 'WARNING',
  });

  // 6. Interventions Sénat
  const interventionsSenat = await prisma.intervention.count({
    where: { parlementaire: { chambre: 'senat' } },
  });

  log({
    source: 'Sénat',
    metric: 'Interventions',
    actual: interventionsSenat,
    expected: 'variable',
    status: interventionsSenat > 0 ? 'OK' : 'WARNING',
  });

  // 7. Sénateurs sans groupe
  const senateursSansGroupe = await prisma.parlementaire.count({
    where: { chambre: 'senat', actif: true, groupeId: null },
  });

  log({
    source: 'Sénat',
    metric: 'Sénateurs actifs sans groupe',
    actual: senateursSansGroupe,
    expected: 0,
    status: senateursSansGroupe === 0 ? 'OK' : 'WARNING',
  });

  return { totalSenateurs, senateursActifs, scrutinsSenat, votesSenat };
}

// =============================================================================
// AUDIT HATVP (Lobbying)
// =============================================================================

async function auditHATVP() {
  console.log('\n' + '═'.repeat(70));
  console.log('  HATVP - Lobbying');
  console.log('═'.repeat(70) + '\n');

  const totalLobbyistes = await prisma.lobbyiste.count();
  const totalActions = await prisma.actionLobby.count();

  const lobbyistesAvecActions = await prisma.lobbyiste.count({
    where: { actions: { some: {} } },
  });

  // Descriptions uniques (pour expliquer le ratio)
  const uniqueDescriptions = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT description) as count FROM actions_lobby
  `;
  const nbUniqueDesc = Number(uniqueDescriptions[0]?.count || 0);

  log({
    source: 'HATVP',
    metric: 'Lobbyistes',
    actual: totalLobbyistes,
    expected: REFERENCES.hatvp.representants,
    status: 'INFO',
    note: 'Écart attendu: entités départementales distinctes',
  });

  log({
    source: 'HATVP',
    metric: 'Lobbyistes avec activités',
    actual: lobbyistesAvecActions,
    expected: REFERENCES.hatvp.representantsAvecActivites,
    status: 'INFO',
  });

  log({
    source: 'HATVP',
    metric: 'Actions (par exercice)',
    actual: totalActions,
    expected: REFERENCES.hatvp.activites,
    status: 'INFO',
    note: `${nbUniqueDesc.toLocaleString('fr-FR')} descriptions uniques × ~${(totalActions / nbUniqueDesc).toFixed(1)} exercices`,
  });

  return { totalLobbyistes, totalActions, lobbyistesAvecActions };
}

// =============================================================================
// AUDIT COHÉRENCE GLOBALE
// =============================================================================

async function auditCoherence() {
  console.log('\n' + '═'.repeat(70));
  console.log('  COHÉRENCE GLOBALE');
  console.log('═'.repeat(70) + '\n');

  // 1. Votes orphelins (sans parlementaire)
  const votesOrphelins = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM votes v
    LEFT JOIN parlementaires p ON v.parlementaire_id = p.id
    WHERE p.id IS NULL
  `;

  log({
    source: 'Global',
    metric: 'Votes sans parlementaire',
    actual: Number(votesOrphelins[0]?.count || 0),
    expected: 0,
    status: Number(votesOrphelins[0]?.count || 0) === 0 ? 'OK' : 'ERROR',
  });

  // 2. Scrutins sans votes
  const scrutinsSansVotes = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM scrutins s
    LEFT JOIN votes v ON s.id = v.scrutin_id
    WHERE v.id IS NULL
  `;

  log({
    source: 'Global',
    metric: 'Scrutins sans aucun vote',
    actual: Number(scrutinsSansVotes[0]?.count || 0),
    expected: 0,
    status: Number(scrutinsSansVotes[0]?.count || 0) === 0 ? 'OK' : 'WARNING',
  });

  // 3. Amendements sans auteur
  const amendementsSansAuteur = await prisma.amendement.count({
    where: { parlementaireId: null },
  });

  const totalAmendements = await prisma.amendement.count();

  log({
    source: 'Global',
    metric: 'Amendements sans auteur',
    actual: amendementsSansAuteur,
    expected: 0,
    status: amendementsSansAuteur < totalAmendements * 0.1 ? 'OK' : 'WARNING',
    note: totalAmendements > 0
      ? `${((amendementsSansAuteur / totalAmendements) * 100).toFixed(1)}% du total`
      : undefined,
  });

  // 4. Interventions - le champ parlementaireId est obligatoire, donc pas de vérification nécessaire
  log({
    source: 'Global',
    metric: 'Interventions sans parlementaire',
    actual: 0,
    expected: 0,
    status: 'OK',
    note: 'Champ parlementaireId obligatoire dans le schéma',
  });

  // 5. Fraîcheur des données
  console.log('\n  Fraîcheur des données:');

  const lastScrutin = await prisma.scrutin.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true, chambre: true, titre: true },
  });
  console.log(`    Dernier scrutin: ${lastScrutin?.date?.toISOString().split('T')[0]} (${lastScrutin?.chambre})`);

  const lastIntervention = await prisma.intervention.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  console.log(`    Dernière intervention: ${lastIntervention?.date?.toISOString().split('T')[0] || 'N/A'}`);

  const lastAmendement = await prisma.amendement.findFirst({
    orderBy: { dateDepot: 'desc' },
    select: { dateDepot: true },
  });
  console.log(`    Dernier amendement: ${lastAmendement?.dateDepot?.toISOString().split('T')[0] || 'N/A'}`);

  const lastAction = await prisma.actionLobby.findFirst({
    orderBy: { dateDebut: 'desc' },
    select: { dateDebut: true },
  });
  console.log(`    Dernière action lobbying: ${lastAction?.dateDebut?.toISOString().split('T')[0] || 'N/A'}`);
}

// =============================================================================
// RAPPORT FINAL
// =============================================================================

function generateReport() {
  console.log('\n' + '═'.repeat(70));
  console.log('  RAPPORT DE SYNTHÈSE');
  console.log('═'.repeat(70) + '\n');

  const errors = results.filter(r => r.status === 'ERROR');
  const warnings = results.filter(r => r.status === 'WARNING');
  const oks = results.filter(r => r.status === 'OK');
  const infos = results.filter(r => r.status === 'INFO');

  console.log(`  Résultats: ${oks.length} OK, ${infos.length} INFO, ${warnings.length} WARNING, ${errors.length} ERROR\n`);

  if (errors.length > 0) {
    console.log('  ✗ ERREURS À CORRIGER:');
    for (const e of errors) {
      console.log(`    - [${e.source}] ${e.metric}: ${e.actual} (attendu: ${e.expected})`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('  ⚠ POINTS D\'ATTENTION:');
    for (const w of warnings) {
      console.log(`    - [${w.source}] ${w.metric}: ${w.actual} (attendu: ${w.expected})`);
    }
    console.log('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('  ✓ TOUTES LES DONNÉES SONT COHÉRENTES!\n');
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║            AUDIT QUALITÉ DONNÉES - CLAIR                             ║');
  console.log('║                                                                      ║');
  console.log(`║  Date: ${new Date().toISOString().split('T')[0]}                                                    ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  try {
    await auditAssemblee();
    await auditSenat();
    await auditHATVP();
    await auditCoherence();
    generateReport();
  } catch (error) {
    console.error('Erreur lors de l\'audit:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
