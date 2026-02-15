// =============================================================================
// Data Quality Checks — Invariants & Threshold-based regression detection
// =============================================================================

import { PrismaClient } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface ThresholdConfig {
  type: 'invariant' | 'threshold';
  label: string;
  min: number;
  max?: number;
  query: string;
}

export interface CheckResult {
  key: string;
  label: string;
  type: 'invariant' | 'threshold';
  expected: string;
  actual: number;
  passed: boolean;
}

export interface MultiAmendmentMismatch {
  scrutinId: string;
  chambre: string;
  expectedNumeros: string[];
  linkedNumeros: string[];
  missingNumeros: string[];
  extraNumeros: string[];
}

export interface MultiAmendmentChambreStats {
  total: number;
  correct: number;
  incorrect: number;
}

export interface MultiAmendmentReport {
  total: number;
  correct: number;
  incorrect: number;
  byChambre: Record<string, MultiAmendmentChambreStats>;
  mismatches: MultiAmendmentMismatch[];
}

export interface QualityReport {
  results: CheckResult[];
  multiAmendment: MultiAmendmentReport;
  passed: boolean;
  invariantsPassed: boolean;
  thresholdsPassed: boolean;
  duration: string;
}

// =============================================================================
// THRESHOLDS — Hardcoded quality checks
// =============================================================================

export const THRESHOLDS: Record<string, ThresholdConfig> = {
  // ---- Invariants (0 tolérance) ----
  orphan_votes: {
    type: 'invariant',
    label: 'Votes sans scrutin valide',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM votes v LEFT JOIN scrutins s ON v.scrutin_id = s.id WHERE s.id IS NULL`,
  },
  scrutins_without_votes: {
    type: 'invariant',
    label: 'Scrutins sans aucun vote',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM scrutins s WHERE NOT EXISTS (SELECT 1 FROM votes v WHERE v.scrutin_id = s.id)`,
  },
  duplicate_scrutins: {
    type: 'invariant',
    label: 'Doublons scrutins (numero+chambre+session)',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM (SELECT numero, chambre, session FROM scrutins GROUP BY numero, chambre, session HAVING COUNT(*) > 1) sub`,
  },
  duplicate_amendements: {
    type: 'invariant',
    label: 'Doublons amendements (uid)',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM (SELECT uid FROM amendements GROUP BY uid HAVING COUNT(*) > 1) sub`,
  },
  parlementaires_without_groupe: {
    type: 'invariant',
    label: 'Parlementaires actifs sans groupe',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM parlementaires WHERE actif = true AND groupe_id IS NULL`,
  },

  // ---- Seuils quantitatifs (minimums) ----
  parlementaires_count: {
    type: 'threshold',
    label: 'Nombre de parlementaires',
    min: 900,
    query: `SELECT COUNT(*)::int AS value FROM parlementaires`,
  },
  groupes_count: {
    type: 'threshold',
    label: 'Nombre de groupes politiques',
    min: 15,
    query: `SELECT COUNT(*)::int AS value FROM groupes_politiques`,
  },
  scrutins_count: {
    type: 'threshold',
    label: 'Nombre de scrutins',
    min: 5000,
    query: `SELECT COUNT(*)::int AS value FROM scrutins`,
  },
  votes_count: {
    type: 'threshold',
    label: 'Nombre de votes',
    min: 1000000,
    query: `SELECT COUNT(*)::int AS value FROM votes`,
  },
  amendements_count: {
    type: 'threshold',
    label: "Nombre d'amendements",
    min: 150000,
    query: `SELECT COUNT(*)::int AS value FROM amendements`,
  },
  interventions_count: {
    type: 'threshold',
    label: "Nombre d'interventions",
    min: 70000,
    query: `SELECT COUNT(*)::int AS value FROM interventions`,
  },
  lobbyistes_count: {
    type: 'threshold',
    label: 'Nombre de lobbyistes',
    min: 3500,
    query: `SELECT COUNT(*)::int AS value FROM lobbyistes`,
  },
  actions_lobby_count: {
    type: 'threshold',
    label: 'Nombre d\'actions lobby',
    min: 400,
    query: `SELECT COUNT(*)::int AS value FROM actions_lobby`,
  },
  dossiers_count: {
    type: 'threshold',
    label: 'Nombre de dossiers législatifs',
    min: 6000,
    query: `SELECT COUNT(*)::int AS value FROM dossiers_legislatifs`,
  },
  amendement_scrutin_links: {
    type: 'threshold',
    label: 'Liens amendement-scrutin',
    min: 4000,
    query: `SELECT COUNT(*)::int AS value FROM "_AmendementToScrutin"`,
  },
  an_amendment_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison scrutins-amendements AN (%)',
    min: 80,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "_AmendementToScrutin" ast WHERE ast."B" = s.id)) AS linked FROM scrutins s WHERE s.chambre = 'assemblee' AND s.titre ILIKE '%amendement%') sub`,
  },
  senat_amendment_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison scrutins-amendements Sénat (%)',
    min: 90,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "_AmendementToScrutin" ast WHERE ast."B" = s.id)) AS linked FROM scrutins s WHERE s.chambre = 'senat' AND s.titre ILIKE '%amendement%') sub`,
  },
  scrutin_dossier_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison scrutins-dossiers (%)',
    min: 50,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE dossier_id IS NOT NULL) AS linked FROM scrutins) sub`,
  },
  amendement_dossier_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison amendements-dossiers (%)',
    min: 40,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE dossier_id IS NOT NULL) AS linked FROM amendements) sub`,
  },
};

// =============================================================================
// Multi-amendment integrity check
// =============================================================================

/**
 * Extrait les numéros d'amendements du titre d'un scrutin.
 * Ex: "sur les amendements identiques n° I-77 rectifié, ... n° I-444 rectifié bis"
 * → ["I-77", "I-444"]
 */
export function extractAmendmentNumbers(titre: string): string[] {
  const matches: string[] = [];
  const regex = /n°\s+([A-Za-z]*-?\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(titre)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

/**
 * Normalise un numéro d'amendement en strippant le suffixe rectificatif.
 * Ex: "2816 (Rect)" → "2816", "10 (2ème Rect)" → "10", "I-77" → "I-77"
 */
export function normalizeNumero(numero: string): string {
  return numero.replace(/\s*\(.*\)$/, '');
}

/**
 * Vérifie que chaque scrutin portant sur plusieurs amendements (titre "amendements identiques")
 * est bien linké à EXACTEMENT les bons amendements — tous présents, aucun en trop.
 */
export async function runMultiAmendmentCheck(prisma: PrismaClient): Promise<MultiAmendmentReport> {
  // Récupère tous les scrutins "amendements identiques" avec leurs amendements linkés
  const rows: Array<{
    id: string;
    titre: string;
    chambre: string;
    linked_numeros: string[] | null;
  }> = await prisma.$queryRawUnsafe(`
    SELECT s.id, s.titre, s.chambre,
           array_agg(a.numero ORDER BY a.numero) FILTER (WHERE a.numero IS NOT NULL) AS linked_numeros
    FROM scrutins s
    LEFT JOIN "_AmendementToScrutin" ast ON ast."B" = s.id
    LEFT JOIN amendements a ON a.id = ast."A"
    WHERE s.titre ILIKE '%amendements identiques%'
    GROUP BY s.id, s.titre, s.chambre
  `);

  const mismatches: MultiAmendmentMismatch[] = [];
  let correct = 0;
  let skipped = 0;

  for (const row of rows) {
    const expectedNumeros = extractAmendmentNumbers(row.titre).sort();

    // Ignore les scrutins avec un seul n° explicite (pattern AN "n° X et les amendements identiques suivants")
    if (expectedNumeros.length < 2) {
      skipped++;
      continue;
    }

    // Normalise les numeros DB: "2816 (Rect)" → "2816"
    const linkedNumerosRaw = row.linked_numeros ?? [];
    const linkedNumeros = linkedNumerosRaw.map(normalizeNumero).sort();

    const expectedSet = new Set(expectedNumeros);
    const linkedSet = new Set(linkedNumeros);

    const missingNumeros = expectedNumeros.filter((n) => !linkedSet.has(n));
    const extraNumeros = linkedNumeros.filter((n) => !expectedSet.has(n));

    if (missingNumeros.length === 0 && extraNumeros.length === 0) {
      correct++;
    } else {
      mismatches.push({
        scrutinId: row.id,
        chambre: row.chambre,
        expectedNumeros,
        linkedNumeros: linkedNumerosRaw, // raw pour le rapport
        missingNumeros,
        extraNumeros,
      });
    }
  }

  const checked = rows.length - skipped;

  // Stats par chambre
  const byChambre: Record<string, MultiAmendmentChambreStats> = {};
  for (const row of rows) {
    const nums = extractAmendmentNumbers(row.titre);
    if (nums.length < 2) continue;
    if (!byChambre[row.chambre]) {
      byChambre[row.chambre] = { total: 0, correct: 0, incorrect: 0 };
    }
    byChambre[row.chambre].total++;
  }
  for (const m of mismatches) {
    if (byChambre[m.chambre]) byChambre[m.chambre].incorrect++;
  }
  for (const [chambre, stats] of Object.entries(byChambre)) {
    stats.correct = stats.total - stats.incorrect;
  }

  return {
    total: checked,
    correct,
    incorrect: mismatches.length,
    byChambre,
    mismatches,
  };
}

// =============================================================================
// Runner
// =============================================================================

export async function runDataQualityChecks(prisma: PrismaClient): Promise<QualityReport> {
  const start = Date.now();
  const results: CheckResult[] = [];

  for (const [key, config] of Object.entries(THRESHOLDS)) {
    const rows: Array<{ value: number }> = await prisma.$queryRawUnsafe(config.query);
    const actual = Number(rows[0]?.value ?? 0);

    let passed: boolean;
    let expected: string;

    if (config.type === 'invariant') {
      passed = actual === 0;
      expected = '= 0';
    } else {
      passed = actual >= config.min;
      expected = `>= ${config.min.toLocaleString('fr-FR')}`;
    }

    results.push({
      key,
      label: config.label,
      type: config.type,
      expected,
      actual,
      passed,
    });
  }

  const multiAmendment = await runMultiAmendmentCheck(prisma);

  const invariantResults = results.filter((r) => r.type === 'invariant');
  const thresholdResults = results.filter((r) => r.type === 'threshold');

  const duration = `${((Date.now() - start) / 1000).toFixed(1)}s`;

  return {
    results,
    multiAmendment,
    passed: results.every((r) => r.passed),
    invariantsPassed: invariantResults.every((r) => r.passed),
    thresholdsPassed: thresholdResults.every((r) => r.passed),
    duration,
  };
}

// =============================================================================
// Report printer
// =============================================================================

export function printReport(report: QualityReport): void {
  console.log('\n========================================');
  console.log('  DATA QUALITY REPORT');
  console.log('========================================\n');

  // Invariants
  const invariants = report.results.filter((r) => r.type === 'invariant');
  if (invariants.length > 0) {
    console.log('--- Invariants (zero tolérance) ---\n');
    for (const r of invariants) {
      const icon = r.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      const actualStr = r.passed
        ? `${r.actual}`
        : `\x1b[31m${r.actual}\x1b[0m`;
      console.log(`  ${icon}  ${r.label.padEnd(42)} ${r.expected.padEnd(12)} actual: ${actualStr}`);
    }
    console.log();
  }

  // Thresholds
  const thresholds = report.results.filter((r) => r.type === 'threshold');
  if (thresholds.length > 0) {
    console.log('--- Seuils quantitatifs ---\n');
    for (const r of thresholds) {
      const icon = r.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      const actualStr = r.passed
        ? r.actual.toLocaleString('fr-FR')
        : `\x1b[31m${r.actual.toLocaleString('fr-FR')}\x1b[0m`;
      console.log(`  ${icon}  ${r.label.padEnd(42)} ${r.expected.padEnd(16)} actual: ${actualStr}`);
    }
    console.log();
  }

  // Multi-amendment integrity (informatif — ne bloque pas le pass/fail)
  const ma = report.multiAmendment;
  console.log('--- Intégrité multi-amendements (informatif) ---\n');
  const maRate = ma.total > 0 ? Math.round((ma.correct / ma.total) * 100) : 100;
  const maIcon = ma.incorrect === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[33m⚠\x1b[0m';
  console.log(`  ${maIcon}  Global: ${ma.correct}/${ma.total} corrects (${maRate}%)`);

  for (const [chambre, stats] of Object.entries(ma.byChambre)) {
    const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100;
    const icon = stats.incorrect === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[33m⚠\x1b[0m';
    console.log(`  ${icon}  ${chambre.padEnd(12)} ${stats.correct}/${stats.total} (${rate}%)`);
  }

  if (ma.mismatches.length > 0) {
    console.log();
    const limit = Math.min(ma.mismatches.length, 5);
    for (let i = 0; i < limit; i++) {
      const m = ma.mismatches[i];
      console.log(`    \x1b[33m⚠\x1b[0m  [${m.chambre}] scrutin ${m.scrutinId.slice(0, 8)}...`);
      if (m.missingNumeros.length > 0) {
        console.log(`       Manquants: ${m.missingNumeros.join(', ')}`);
      }
      if (m.extraNumeros.length > 0) {
        console.log(`       En trop:   ${m.extraNumeros.join(', ')}`);
      }
    }
    if (ma.mismatches.length > limit) {
      console.log(`    ... et ${ma.mismatches.length - limit} autres`);
    }
  }
  console.log();

  // Summary
  console.log('========================================');
  const totalPassed = report.results.filter((r) => r.passed).length;
  const total = report.results.length;

  if (report.passed) {
    console.log(`  \x1b[32m✓ PASSED\x1b[0m  ${totalPassed}/${total} checks  (${report.duration})`);
  } else {
    const failedChecks = report.results.filter((r) => !r.passed);
    console.log(`  \x1b[31m✗ FAILED\x1b[0m  ${totalPassed}/${total} checks  (${report.duration})`);
    console.log(`  Échecs: ${failedChecks.map((r) => r.key).join(', ')}`);
  }
  console.log('========================================\n');
}
