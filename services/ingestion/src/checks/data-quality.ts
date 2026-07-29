// =============================================================================
// Data Quality Checks — Invariants & Threshold-based regression detection
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { LEGISLATURE_AN_COURANTE } from '../workers/mandats';

// =============================================================================
// Périmètre des taux de liaison
// =============================================================================
//
// Dossiers et amendements ne sont ingérés que pour la législature courante (AN)
// et le Sénat. Les scrutins des législatures historiques (15, 16) existent en
// base sans dossier ni amendement associé : les compter au dénominateur ferait
// mesurer le *périmètre d'ingestion* au lieu de la *qualité de liaison*.
// On restreint donc ces deux taux au périmètre où les sources liées existent.
// Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
const SCRUTINS_PERIMETRE_LIE = `(s.chambre = 'senat' OR s.legislature = ${LEGISLATURE_AN_COURANTE})`;

// Sessions Sénat pour lesquelles on ingère ET enrichit les amendements (période courante).
// Les scrutins historiques (< cette borne) n'ont AUCUN amendement en base — la source ne
// remonte pas si loin — donc les compter fausserait le taux de liaison. Borne PLANCHER
// stable : contrairement à `LEGISLATURE_AN_COURANTE`, elle ne s'incrémente jamais (les
// sessions futures 2025, 2026… sont toutes >= à ce plancher). Les dossiers, eux, se lient
// sur tout l'historique : scrutins ET dossiers Sénat sont ingérés sur la même fenêtre
// (`SENAT_SESSION_MIN`, cf. workers/mandats), donc leur taux n'a pas besoin de ce
// périmètre — à surveiller au premier run couvrant les sessions antérieures à 2020.
const SENAT_SESSION_AMENDEMENTS_MIN = '2024';

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

export interface SujetLiensFamilleStats {
  totalLinks: number;
  sujetsCovered: number;
  coverageRate: number; // % de sujets actifs portant ≥1 lien de cette famille
}

export interface SujetLiensDeadLinkSample {
  sampled: number; // liens tirés au sort
  checked: number; // liens ayant renvoyé une réponse HTTP
  dead: number;    // réponses >= 400
  deadUrls: string[];
}

export interface SujetLiensReport {
  available: boolean; // false si la table n'existe pas encore (migration non appliquée)
  sujetsTotal: number;
  construction: SujetLiensFamilleStats;
  contexte: SujetLiensFamilleStats;
  deadLinks: SujetLiensDeadLinkSample | null; // null si le check HTTP n'a pas été demandé
}

export interface QualityReport {
  results: CheckResult[];
  multiAmendment: MultiAmendmentReport;
  sujetLiens: SujetLiensReport;
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
  cross_chamber_links: {
    type: 'invariant',
    label: 'Liens scrutin-dossier inter-chambres',
    min: 0,
    max: 0,
    query: `SELECT COUNT(*)::int AS value FROM scrutins s JOIN dossiers_legislatifs d ON s.dossier_id = d.id WHERE (s.chambre = 'assemblee' AND d.uid LIKE 'SENAT%') OR (s.chambre = 'senat' AND d.uid NOT LIKE 'SENAT%')`,
  },
  cross_legislature_links: {
    type: 'invariant',
    label: 'Liens scrutin-dossier inter-législatures (AN)',
    min: 0,
    max: 0,
    // Un scrutin AN ne peut appartenir qu'à un dossier de sa propre législature.
    // Non nul = le matching a rattaché des scrutins à un dossier d'une autre
    // législature, faute de dossier ingéré pour la leur.
    query: `SELECT COUNT(*)::int AS value FROM scrutins s JOIN dossiers_legislatifs d ON s.dossier_id = d.id WHERE s.chambre = 'assemblee' AND d.uid NOT LIKE 'SENAT%' AND s.session ~ '^[0-9]+$' AND d.legislature <> s.session::int`,
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
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "_AmendementToScrutin" ast WHERE ast."B" = s.id)) AS linked FROM scrutins s WHERE s.chambre = 'assemblee' AND s.legislature = ${LEGISLATURE_AN_COURANTE} AND s.titre ILIKE '%amendement%') sub`,
  },
  senat_amendment_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison scrutins-amendements Sénat (%)',
    min: 45,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "_AmendementToScrutin" ast WHERE ast."B" = s.id)) AS linked FROM scrutins s WHERE s.chambre = 'senat' AND s.session >= '${SENAT_SESSION_AMENDEMENTS_MIN}' AND s.titre ILIKE '%amendement%') sub`,
  },
  scrutin_dossier_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison scrutins-dossiers (%)',
    min: 90,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE s.dossier_id IS NOT NULL) AS linked FROM scrutins s WHERE ${SCRUTINS_PERIMETRE_LIE}) sub`,
  },
  amendement_dossier_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison amendements-dossiers (%)',
    min: 40,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE dossier_id IS NOT NULL) AS linked FROM amendements) sub`,
  },

  // ---- Commissions & Agenda ----
  commissions_count: {
    type: 'threshold',
    label: 'Nombre de commissions et organes',
    min: 2900,
    query: `SELECT COUNT(*)::int AS value FROM commissions`,
  },
  commissions_an_count: {
    type: 'threshold',
    label: 'Commissions AN',
    min: 2800,
    query: `SELECT COUNT(*)::int AS value FROM commissions WHERE chambre = 'assemblee'`,
  },
  commissions_senat_count: {
    type: 'threshold',
    label: 'Commissions Sénat',
    min: 35,
    query: `SELECT COUNT(*)::int AS value FROM commissions WHERE chambre = 'senat'`,
  },
  reunions_count: {
    type: 'threshold',
    label: 'Nombre de réunions',
    min: 6000,
    query: `SELECT COUNT(*)::int AS value FROM reunions`,
  },
  reunions_commission_link_rate: {
    type: 'threshold',
    label: 'Taux de liaison réunions-commissions AN (%)',
    min: 85,
    query: `SELECT CASE WHEN total = 0 THEN 0 ELSE (linked * 100 / total)::int END AS value FROM (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE commission_id IS NOT NULL) AS linked FROM reunions) sub`,
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
    if (match[1]) matches.push(match[1]);
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
      AND ${SCRUTINS_PERIMETRE_LIE}
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
    const stats = byChambre[row.chambre] ?? { total: 0, correct: 0, incorrect: 0 };
    stats.total++;
    byChambre[row.chambre] = stats;
  }
  for (const m of mismatches) {
    const stats = byChambre[m.chambre];
    if (stats) stats.incorrect++;
  }
  for (const stats of Object.values(byChambre)) {
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
// Liens sortants Sujets — rapport informatif (non bloquant)
//
// La couverture est volontairement partielle (Wikipédia haute précision,
// construction dépendante des actesLegislatifs disponibles) et la table peut
// être absente avant la migration : ce check est donc informatif, table-guardé,
// et ne participe pas au pass/fail.
// =============================================================================

const SUJET_LIENS_SAMPLE_SIZE = 10;
const DEAD_LINK_TIMEOUT_MS = 5000;

export async function runSujetLiensCheck(
  prisma: PrismaClient,
  opts: { checkDeadLinks?: boolean } = {},
): Promise<SujetLiensReport> {
  const empty: SujetLiensReport = {
    available: false,
    sujetsTotal: 0,
    construction: { totalLinks: 0, sujetsCovered: 0, coverageRate: 0 },
    contexte: { totalLinks: 0, sujetsCovered: 0, coverageRate: 0 },
    deadLinks: null,
  };

  // Table absente (migration non appliquée) → rapport "non disponible".
  const existsRows: Array<{ exists: boolean }> = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sujet_liens') AS exists`,
  );
  if (!existsRows[0]?.exists) return empty;

  const aggRows: Array<{
    sujets_total: number;
    c_links: number;
    c_sujets: number;
    x_links: number;
    x_sujets: number;
  }> = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*) FROM sujets WHERE actif = true)::int AS sujets_total,
      (SELECT COUNT(*) FROM sujet_liens WHERE famille = 'construction')::int AS c_links,
      (SELECT COUNT(DISTINCT sujet_id) FROM sujet_liens WHERE famille = 'construction')::int AS c_sujets,
      (SELECT COUNT(*) FROM sujet_liens WHERE famille = 'contexte')::int AS x_links,
      (SELECT COUNT(DISTINCT sujet_id) FROM sujet_liens WHERE famille = 'contexte')::int AS x_sujets
  `);

  const agg = aggRows[0];
  const sujetsTotal = Number(agg?.sujets_total ?? 0);
  const rate = (covered: number) =>
    sujetsTotal > 0 ? Math.round((covered / sujetsTotal) * 100) : 0;

  // Échantillon de liens non-morts (best-effort, jamais bloquant).
  // Une erreur réseau (timeout, offline) compte comme "non vérifié", pas "mort" :
  // seuls les statuts HTTP >= 400 sont considérés comme morts.
  let deadLinks: SujetLiensDeadLinkSample | null = null;
  if (opts.checkDeadLinks) {
    const sample: Array<{ url: string }> = await prisma.$queryRawUnsafe(
      `SELECT url FROM sujet_liens ORDER BY random() LIMIT ${SUJET_LIENS_SAMPLE_SIZE}`,
    );
    let checked = 0;
    let dead = 0;
    const deadUrls: string[] = [];

    await Promise.all(
      sample.map(async ({ url }) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DEAD_LINK_TIMEOUT_MS);
        try {
          const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
          });
          checked++;
          if (res.status >= 400) {
            dead++;
            deadUrls.push(url);
          }
        } catch {
          // réseau indisponible → non vérifié
        } finally {
          clearTimeout(timer);
        }
      }),
    );

    deadLinks = { sampled: sample.length, checked, dead, deadUrls };
  }

  return {
    available: true,
    sujetsTotal,
    construction: {
      totalLinks: Number(agg?.c_links ?? 0),
      sujetsCovered: Number(agg?.c_sujets ?? 0),
      coverageRate: rate(Number(agg?.c_sujets ?? 0)),
    },
    contexte: {
      totalLinks: Number(agg?.x_links ?? 0),
      sujetsCovered: Number(agg?.x_sujets ?? 0),
      coverageRate: rate(Number(agg?.x_sujets ?? 0)),
    },
    deadLinks,
  };
}

// =============================================================================
// Runner
// =============================================================================

export async function runDataQualityChecks(
  prisma: PrismaClient,
  opts: { checkSujetLinksHttp?: boolean } = {},
): Promise<QualityReport> {
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
  const sujetLiens = await runSujetLiensCheck(prisma, {
    checkDeadLinks: opts.checkSujetLinksHttp ?? false,
  });

  const invariantResults = results.filter((r) => r.type === 'invariant');
  const thresholdResults = results.filter((r) => r.type === 'threshold');

  const duration = `${((Date.now() - start) / 1000).toFixed(1)}s`;

  return {
    results,
    multiAmendment,
    sujetLiens,
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
    for (const m of ma.mismatches.slice(0, limit)) {
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

  // Liens sortants Sujets (informatif — ne bloque pas le pass/fail)
  const sl = report.sujetLiens;
  console.log('--- Liens sortants Sujets (informatif) ---\n');
  if (!sl.available) {
    console.log('  \x1b[33m⚠\x1b[0m  Table sujet_liens absente (migration non appliquée)\n');
  } else {
    const fam = (label: string, s: SujetLiensFamilleStats) => {
      const icon = s.totalLinks > 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[33m⚠\x1b[0m';
      console.log(
        `  ${icon}  ${label.padEnd(28)} ${String(s.totalLinks).padStart(5)} liens · ` +
          `${s.sujetsCovered}/${sl.sujetsTotal} sujets (${s.coverageRate}%)`,
      );
    };
    fam('Documents officiels', sl.construction);
    fam('Pour aller plus loin (contexte)', sl.contexte);

    if (sl.deadLinks) {
      const d = sl.deadLinks;
      const icon = d.dead === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log(
        `  ${icon}  ${'Échantillon liens HTTP'.padEnd(28)} ${d.dead} mort(s) sur ${d.checked} vérifié(s) (échantillon ${d.sampled})`,
      );
      for (const url of d.deadUrls.slice(0, 5)) {
        console.log(`       \x1b[31m✗\x1b[0m ${url}`);
      }
    }
    console.log();
  }

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
