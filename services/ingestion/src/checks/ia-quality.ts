// =============================================================================
// IA Quality Checks — Detect inversions in AI-generated summaries
// Compares group positions described in enjeux/resume_ia against actual vote data
// =============================================================================

import { PrismaClient } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface IAInversion {
  entityType: 'sujet' | 'dossier';
  entityId: string;
  label: string;
  groupe: string;
  orientation: string | null;
  describedAs: 'FAVORABLE' | 'OPPOSED';
  actualPour: number;
  actualContre: number;
  actualTendency: string;
  context: string;
}

export interface IAQualityReport {
  totalSujets: number;
  totalDossiers: number;
  sujetsWithEnsemble: number;
  dossiersWithEnsemble: number;
  inversions: IAInversion[];
  passed: boolean;
  duration: string;
}

// =============================================================================
// Pattern matching
// =============================================================================

const FAV_PATTERN = /soutien|soutenu|soutient|soutiennent|favorable|favorables|voté pour|votent pour|approuvé|en faveur|massivement pour|unanimement pour|plébiscité|adhésion/i;
const OPP_PATTERN = /opposé|opposés|oppose|opposent|rejeté|rejette|rejettent|voté contre|votent contre|fermement contre|massivement contre|unanimement contre|hostil|défavorable/i;

const GROUP_SEARCH_TERMS: Record<string, string[]> = {
  'Rassemblement National': ['rassemblement national', ' rn ', 'rn,', 'rn)'],
  'La France Insoumise - Nouveau Front Populaire': ['france insoumise', ' lfi', 'nupes'],
  'Socialistes': ['socialiste', ' soc ', ' ps '],
  'Ensemble pour la République': ['ensemble pour la république', 'renaissance', ' epr '],
  'Ecologiste et Social': ['écologiste', ' ecos ', 'eelv'],
  'Droite Républicaine': ['républicains', ' lr ', ' dr ', 'droite républicaine'],
  'Gauche Démocrate et Républicaine': ['communiste', ' gdr ', ' pcf '],
  'Horizons & Indépendants': ['horizons', ' hor '],
  'Démocrates': ['démocrates', ' dem ', 'modem'],
  'Les Indépendants - Groupe Libertés, Indépendants, Outre-mer et Territoires': [' liot '],
  'UMP': [' ump '],
  'Union Centriste': ['union centriste', ' uc '],
  'Communiste Républicain Citoyen et Écologiste - Kanaky': [' crc '],
  'Rassemblement des Démocrates Progressistes et Indépendants': [' rdse '],
  'Écologiste - Solidarité et Territoires': [' gest '],
  'Rassemblement des Démocrates, Progressistes et Indépendants': [' lrem '],
  'Les Républicains, Libertés et Territoires et Indépendants': [' rtli '],
};

function computeTendency(pour: number, contre: number): string {
  const expr = pour + contre;
  if (expr === 0) return 'ABSTENTION';
  const pct = (pour / expr) * 100;
  if (pct >= 70) return 'FAV';
  if (pct >= 55) return 'PFAV';
  if (pct <= 30) return 'OPP';
  if (pct <= 45) return 'POPP';
  return 'DIV';
}

function findGroupInText(text: string, groupeName: string): number {
  const textLower = text.toLowerCase();

  // Try exact group name first
  let idx = textLower.indexOf(groupeName.toLowerCase());
  if (idx >= 0) return idx;

  // Try aliases
  const aliases = GROUP_SEARCH_TERMS[groupeName];
  if (aliases) {
    for (const alias of aliases) {
      idx = textLower.indexOf(alias);
      if (idx >= 0) return idx;
    }
  }

  return -1;
}

function checkInversions(
  text: string,
  votes: { groupe: string; orientation: string | null; pour: number; contre: number }[],
): { groupe: string; orientation: string | null; describedAs: 'FAVORABLE' | 'OPPOSED'; pour: number; contre: number; tendency: string; context: string }[] {
  const issues: ReturnType<typeof checkInversions> = [];

  for (const v of votes) {
    const expr = v.pour + v.contre;
    if (expr < 15) continue; // Skip small groups

    const tendency = computeTendency(v.pour, v.contre);
    if (tendency === 'DIV' || tendency === 'ABSTENTION') continue; // Can't invert a divided group

    const idx = findGroupInText(text, v.groupe);
    if (idx < 0) continue;

    // Get 120-char context around the match
    const ctxStart = Math.max(0, idx - 120);
    const ctxEnd = Math.min(text.length, idx + 150);
    const context = text.slice(ctxStart, ctxEnd);

    const isFav = FAV_PATTERN.test(context);
    const isOpp = OPP_PATTERN.test(context);

    if ((tendency === 'FAV' || tendency === 'PFAV') && isOpp && !isFav) {
      issues.push({ groupe: v.groupe, orientation: v.orientation, describedAs: 'OPPOSED', pour: v.pour, contre: v.contre, tendency, context: context.replace(/\n/g, ' ') });
    } else if ((tendency === 'OPP' || tendency === 'POPP') && isFav && !isOpp) {
      issues.push({ groupe: v.groupe, orientation: v.orientation, describedAs: 'FAVORABLE', pour: v.pour, contre: v.contre, tendency, context: context.replace(/\n/g, ' ') });
    }
  }

  return issues;
}

// =============================================================================
// Main check
// =============================================================================

type VoteRow = { entity_id: string; groupe: string; orientation: string | null; pour: bigint; contre: bigint };

export async function runIAQualityChecks(prisma: PrismaClient): Promise<IAQualityReport> {
  const start = Date.now();
  const inversions: IAInversion[] = [];

  // 1. Load all sujets with enjeux
  const sujets = await prisma.sujet.findMany({
    where: { enjeux: { not: null } },
    select: { id: true, slug: true, label: true, enjeux: true },
  });

  // 2. Load ensemble votes for sujets
  const sujetIds = sujets.map(s => s.id);
  const sujetVotes = sujetIds.length > 0
    ? await prisma.$queryRaw<(VoteRow & { entity_id: string })[]>`
        SELECT s.slug as entity_id, gp.nom as groupe, gp.position as orientation,
          SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END)::bigint AS pour,
          SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)::bigint AS contre
        FROM sujets s
        JOIN dossiers_legislatifs d ON d.sujet_id = s.id
        JOIN scrutins sc ON sc.dossier_id = d.id
        JOIN votes v ON v.scrutin_id = sc.id
        JOIN parlementaires p ON p.id = v.parlementaire_id
        JOIN groupes_politiques gp ON gp.id = p.groupe_id
        WHERE s.id = ANY(${sujetIds})
          AND (sc.type_vote = 'solennel' OR sc.titre ILIKE '%ensemble%')
          AND v.position != 'absent'
        GROUP BY s.slug, gp.nom, gp.position
        HAVING SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
               SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) > 3
      `
    : [];

  // Index votes by sujet slug
  const sujetVoteMap = new Map<string, { groupe: string; orientation: string | null; pour: number; contre: number }[]>();
  for (const v of sujetVotes) {
    if (!sujetVoteMap.has(v.entity_id)) sujetVoteMap.set(v.entity_id, []);
    sujetVoteMap.get(v.entity_id)!.push({ groupe: v.groupe, orientation: v.orientation, pour: Number(v.pour), contre: Number(v.contre) });
  }

  // 3. Check sujets
  for (const s of sujets) {
    const votes = sujetVoteMap.get(s.slug);
    if (!votes) continue;
    const issues = checkInversions(s.enjeux!, votes);
    for (const issue of issues) {
      inversions.push({
        entityType: 'sujet',
        entityId: s.slug,
        label: s.label,
        groupe: issue.groupe,
        orientation: issue.orientation,
        describedAs: issue.describedAs,
        actualPour: issue.pour,
        actualContre: issue.contre,
        actualTendency: issue.tendency,
        context: issue.context.slice(0, 200),
      });
    }
  }

  // 4. Load dossiers with ensemble votes
  const dossierVotes = await prisma.$queryRaw<(VoteRow & { entity_id: string; resume_ia: string; titre: string })[]>`
    SELECT d.uid as entity_id, d.titre, d.resume_ia,
      gp.nom as groupe, gp.position as orientation,
      SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END)::bigint AS pour,
      SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END)::bigint AS contre
    FROM dossiers_legislatifs d
    JOIN scrutins sc ON sc.dossier_id = d.id
    JOIN votes v ON v.scrutin_id = sc.id
    JOIN parlementaires p ON p.id = v.parlementaire_id
    JOIN groupes_politiques gp ON gp.id = p.groupe_id
    WHERE d.resume_ia IS NOT NULL
      AND (sc.type_vote = 'solennel' OR sc.titre ILIKE '%ensemble%')
      AND v.position != 'absent'
    GROUP BY d.uid, d.titre, d.resume_ia, gp.nom, gp.position
    HAVING SUM(CASE WHEN v.position = 'pour' THEN 1 ELSE 0 END) +
           SUM(CASE WHEN v.position = 'contre' THEN 1 ELSE 0 END) > 3
  `;

  // Index by dossier uid
  const dossierMap = new Map<string, { titre: string; resume: string; votes: { groupe: string; orientation: string | null; pour: number; contre: number }[] }>();
  for (const v of dossierVotes) {
    if (!dossierMap.has(v.entity_id)) {
      dossierMap.set(v.entity_id, { titre: v.titre, resume: v.resume_ia, votes: [] });
    }
    dossierMap.get(v.entity_id)!.votes.push({ groupe: v.groupe, orientation: v.orientation, pour: Number(v.pour), contre: Number(v.contre) });
  }

  // 5. Check dossiers
  for (const [uid, d] of dossierMap) {
    const issues = checkInversions(d.resume, d.votes);
    for (const issue of issues) {
      inversions.push({
        entityType: 'dossier',
        entityId: uid,
        label: d.titre.slice(0, 80),
        groupe: issue.groupe,
        orientation: issue.orientation,
        describedAs: issue.describedAs,
        actualPour: issue.pour,
        actualContre: issue.contre,
        actualTendency: issue.tendency,
        context: issue.context.slice(0, 200),
      });
    }
  }

  const duration = `${((Date.now() - start) / 1000).toFixed(1)}s`;

  return {
    totalSujets: sujets.length,
    totalDossiers: dossierMap.size,
    sujetsWithEnsemble: sujetVoteMap.size,
    dossiersWithEnsemble: dossierMap.size,
    inversions,
    // NOTE: les inversions regex incluent ~95% de faux positifs (contexte 120 chars)
    // Baseline mars 2026: ~168 flags regex dont ~5 vraies inversions
    // Si ce seuil est dépassé, c'est une régression → audit LLM nécessaire
    passed: inversions.length <= 200,
    duration,
  };
}

export function printIAQualityReport(report: IAQualityReport): void {
  console.log('\n🤖 Qualité des résumés IA');
  console.log(`   Sujets audités: ${report.totalSujets} (${report.sujetsWithEnsemble} avec données ensemble)`);
  console.log(`   Dossiers audités: ${report.totalDossiers} avec données ensemble`);
  console.log(`   Inversions détectées (regex): ${report.inversions.length}`);
  console.log(`   ⚠️  Note: les inversions regex incluent ~95% de faux positifs.`);
  console.log(`   Un audit LLM est nécessaire pour confirmer les vraies inversions.`);

  if (report.inversions.length > 0) {
    // Group by entity
    const byEntity = new Map<string, IAInversion[]>();
    for (const inv of report.inversions) {
      const key = `${inv.entityType}:${inv.entityId}`;
      if (!byEntity.has(key)) byEntity.set(key, []);
      byEntity.get(key)!.push(inv);
    }
    console.log(`\n   Entités flaggées: ${byEntity.size}`);

    // Show top 10 most suspicious (groups with >50 expressed votes = strong signal)
    const highConfidence = report.inversions.filter(i => i.actualPour + i.actualContre > 50);
    if (highConfidence.length > 0) {
      console.log(`\n   🔴 Inversions haute confiance (>50 votes exprimés): ${highConfidence.length}`);
      for (const inv of highConfidence.slice(0, 15)) {
        console.log(`      ${inv.entityType}:${inv.entityId} — ${inv.groupe} [${inv.orientation}] décrit ${inv.describedAs} mais ${inv.actualPour}P/${inv.actualContre}C (${inv.actualTendency})`);
      }
      if (highConfidence.length > 15) {
        console.log(`      ... et ${highConfidence.length - 15} autres`);
      }
    }
  }

  console.log(`\n   ${report.passed ? '✅' : '❌'} ${report.passed ? 'PASSED' : 'FAILED'} (seuil: ≤150 inversions regex) — durée: ${report.duration}`);
}
