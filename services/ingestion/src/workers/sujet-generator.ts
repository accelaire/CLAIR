// =============================================================================
// Sujet Generator — Cross-références déterministes AN ↔ Sénat
//
// Regroupe les dossiers législatifs des deux chambres sur un même texte
// en utilisant 3 signaux :
//   1. AN → Sénat : urlSenat sur les dossiers AN
//   2. Sénat → AN : urlAN sur les dossiers Sénat
//   3. loiNumero identique entre AN et Sénat (lois promulguées)
//
// Algorithme : Union-Find pour gérer la transitivité des liens.
// =============================================================================

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

interface DossierRow {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  loiNumero: string | null;
  etat: string | null;
  dateDepot: Date | null;
  dateAdoption: Date | null;
  loiDateJO: Date | null;
  scrutinCount: number;
  sujetId: string | null;
}

interface GenerateSujetsResult {
  created: number;
  updated: number;
  crossRef: number;
  loiNumero: number;
  solo: number;
  totalDossiers: number;
  totalScrutins: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extrait la ref SENAT depuis une URL senat.fr
 * Ex: "https://www.senat.fr/dossier-legislatif/pjl24-400.html" → "pjl24-400"
 */
function extractRefFromSenatUrl(url: string): string | null {
  const match = url.match(/dossier-legislatif\/(.+?)\.html/);
  return match?.[1] ? match[1].toLowerCase() : null;
}

/**
 * Extrait l'UID AN depuis une URL assemblee-nationale.fr
 * Ex: "https://www.assemblee-nationale.fr/dyn/17/dossiers/DLR5L17N12345" → "DLR5L17N12345"
 * Aussi : "/dyn/17/dossiers/alt/DLR5L17N12345" ou d'autres variantes
 */
function extractANUidFromUrl(url: string): string | null {
  const match = url.match(/(DLR5L\d+N\d+)/);
  return match?.[1] ?? null;
}

/**
 * Génère un slug URL-safe depuis un label.
 * Supprime les accents, remplace les espaces/ponctuation par des tirets,
 * tronque à 80 caractères.
 */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/['']/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

// =============================================================================
// UNION-FIND
// =============================================================================

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX)!;
    const rankY = this.rank.get(rootY)!;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getComponents(): Map<string, string[]> {
    const components = new Map<string, string[]>();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!components.has(root)) {
        components.set(root, []);
      }
      components.get(root)!.push(key);
    }
    return components;
  }
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

export async function generateSujets(options: {
  reset?: boolean;
  dryRun?: boolean;
} = {}): Promise<GenerateSujetsResult> {
  const prisma = new PrismaClient();

  try {
    const { reset = false, dryRun = false } = options;

    logger.info({ reset, dryRun }, 'Starting sujet generation...');

    // =========================================================================
    // Step 0: Reset if requested
    // =========================================================================
    if (reset && !dryRun) {
      logger.info('Resetting existing sujets...');
      await prisma.$executeRaw`UPDATE dossiers_legislatifs SET sujet_id = NULL WHERE sujet_id IS NOT NULL`;
      await prisma.$executeRaw`DELETE FROM sujets`;
      logger.info('All sujets cleared');
    }

    // =========================================================================
    // Step 1: Load all dossiers with scrutin counts
    // =========================================================================
    const dossiers = await prisma.$queryRaw<DossierRow[]>`
      SELECT
        d.id,
        d.uid,
        d.titre,
        d.titre_court as "titreCourt",
        d.url_an as "urlAN",
        d.url_senat as "urlSenat",
        d.loi_numero as "loiNumero",
        d.etat,
        d.date_depot as "dateDepot",
        d.date_adoption as "dateAdoption",
        d.loi_date_jo as "loiDateJO",
        (SELECT COUNT(*)::int FROM scrutins s WHERE s.dossier_id = d.id) as "scrutinCount",
        d.sujet_id as "sujetId"
      FROM dossiers_legislatifs d
    `;

    logger.info({ totalDossiers: dossiers.length }, 'Dossiers loaded');

    // Build lookup maps
    const dossierById = new Map<string, DossierRow>();
    const dossierByUid = new Map<string, DossierRow>();
    const dossiersByLoiNumero = new Map<string, DossierRow[]>();

    for (const d of dossiers) {
      dossierById.set(d.id, d);
      dossierByUid.set(d.uid, d);
      if (d.loiNumero) {
        if (!dossiersByLoiNumero.has(d.loiNumero)) {
          dossiersByLoiNumero.set(d.loiNumero, []);
        }
        dossiersByLoiNumero.get(d.loiNumero)!.push(d);
      }
    }

    // =========================================================================
    // Step 2: Build cross-references with Union-Find
    // =========================================================================
    const uf = new UnionFind();
    let crossRefCount = 0;
    let loiNumeroCount = 0;

    // Initialize all dossiers in UF
    for (const d of dossiers) {
      uf.find(d.id);
    }

    // Signal 1: AN → Sénat via urlSenat
    for (const d of dossiers) {
      if (!d.urlSenat || !d.uid.startsWith('DLR')) continue; // AN dossiers only

      const senatRef = extractRefFromSenatUrl(d.urlSenat);
      if (!senatRef) continue;

      const senatUid = `SENAT-${senatRef}`;
      const senatDossier = dossierByUid.get(senatUid);
      if (senatDossier) {
        uf.union(d.id, senatDossier.id);
        crossRefCount++;
      }
    }

    // Signal 2: Sénat → AN via urlAN
    for (const d of dossiers) {
      if (!d.urlAN || !d.uid.startsWith('SENAT')) continue; // Sénat dossiers only

      const anUid = extractANUidFromUrl(d.urlAN);
      if (!anUid) continue;

      const anDossier = dossierByUid.get(anUid);
      if (anDossier) {
        uf.union(d.id, anDossier.id);
        crossRefCount++;
      }
    }

    // Signal 3: loiNumero identique
    for (const group of dossiersByLoiNumero.values()) {
      const first = group[0];
      if (group.length < 2 || !first) continue;

      // Only merge if the group spans both chambers
      const hasAN = group.some(d => d.uid.startsWith('DLR'));
      const hasSenat = group.some(d => d.uid.startsWith('SENAT'));
      if (!hasAN || !hasSenat) continue;

      for (const member of group.slice(1)) {
        uf.union(first.id, member.id);
        loiNumeroCount++;
      }
    }

    logger.info({ crossRefCount, loiNumeroCount }, 'Cross-references built');

    // =========================================================================
    // Step 3: Filter components — keep only those with ≥1 scrutin
    // =========================================================================
    const components = uf.getComponents();
    const validComponents: DossierRow[][] = [];

    for (const [, memberIds] of components) {
      const members = memberIds.map(id => dossierById.get(id)!).filter(Boolean);
      const totalScrutins = members.reduce((sum, d) => sum + d.scrutinCount, 0);

      if (totalScrutins > 0) {
        validComponents.push(members);
      }
    }

    logger.info({
      totalComponents: components.size,
      validComponents: validComponents.length,
    }, 'Components filtered');

    // =========================================================================
    // Step 4: Idempotent diff — compare Union-Find components vs existing state
    // =========================================================================
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let soloCount = 0;
    const affectedSujetIds = new Set<string>();

    // Track used slugs (pre-load existing ones to avoid collisions)
    const existingSlugs = await prisma.$queryRaw<{ slug: string }[]>`SELECT slug FROM sujets`;
    const usedSlugs = new Set<string>(existingSlugs.map(s => s.slug));

    for (const members of validComponents) {
      const existingSujetIds = new Set(
        members.map(d => d.sujetId).filter((id): id is string => id !== null)
      );
      const orphans = members.filter(d => d.sujetId === null);

      const chambres = new Set(members.map(d =>
        d.uid.startsWith('SENAT') ? 'senat' : 'assemblee'
      ));
      const isMultiChambre = chambres.size > 1;
      if (!isMultiChambre) soloCount++;

      if (existingSujetIds.size === 1 && orphans.length === 0) {
        // All members already share the same sujet — nothing to do
        skipped++;
        continue;
      }

      if (existingSujetIds.size > 1) {
        // Multiple sujets in one component — should not happen, log and skip
        logger.warn({
          sujetIds: [...existingSujetIds],
          dossierUids: members.map(d => d.uid),
        }, 'Component has dossiers from multiple sujets — skipping (manual merge needed)');
        skipped++;
        continue;
      }

      if (existingSujetIds.size === 1) {
        // One existing sujet + orphan dossiers → attach orphans
        const sujetId = [...existingSujetIds][0]!;
        if (!dryRun) {
          for (const d of orphans) {
            await prisma.$executeRawUnsafe(
              `UPDATE dossiers_legislatifs SET sujet_id = $1 WHERE id = $2`,
              sujetId, d.id,
            );
          }
          affectedSujetIds.add(sujetId);
          logger.info({
            sujetId,
            attached: orphans.map(d => d.uid),
          }, 'Attached orphan dossiers to existing sujet');
        }
        updated++;
        continue;
      }

      // No existing sujet → create new one
      if (dryRun) {
        created++;
        continue;
      }

      const matchMethod = isMultiChambre ? 'cross_ref' : 'solo';
      const label = pickBestLabel(members);
      let baseSlug = slugify(label);
      if (!baseSlug) baseSlug = `sujet-${members[0]?.uid.toLowerCase() ?? 'inconnu'}`;

      let slug = baseSlug;
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix}`;
        suffix++;
      }
      usedSlugs.add(slug);

      const totalScrutins = members.reduce((sum, d) => sum + d.scrutinCount, 0);
      const status = computeStatus(members);
      const { dateDebut, dateFin } = computeDates(members);

      const sujetId = crypto.randomUUID();

      await prisma.$executeRawUnsafe(
        `INSERT INTO sujets (id, slug, label, dossier_count, scrutin_count, match_method, status, date_debut, date_fin, actif, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())`,
        sujetId, slug, label, members.length, totalScrutins, matchMethod, status, dateDebut, dateFin,
      );

      for (const d of members) {
        await prisma.$executeRawUnsafe(
          `UPDATE dossiers_legislatifs SET sujet_id = $1 WHERE id = $2`,
          sujetId, d.id,
        );
      }
      affectedSujetIds.add(sujetId);
      created++;
    }

    const totalDossiers = validComponents.reduce((sum, m) => sum + m.length, 0);
    const totalScrutins = validComponents.reduce(
      (sum, members) => sum + members.reduce((s, d) => s + d.scrutinCount, 0),
      0
    );

    // match_method ne dépend que de la composition en dossiers : seuls les sujets
    // touchés ici peuvent avoir changé de chambres.
    if (affectedSujetIds.size > 0) {
      const ids = [...affectedSujetIds];
      await prisma.$executeRawUnsafe(
        `UPDATE sujets s SET
          match_method = CASE
            WHEN (SELECT COUNT(DISTINCT CASE WHEN d.uid LIKE 'SENAT-%' THEN 'senat' ELSE 'an' END) FROM dossiers_legislatifs d WHERE d.sujet_id = s.id) > 1
            THEN 'cross_ref' ELSE 'solo'
          END
        WHERE s.id = ANY($1::text[])`,
        ids,
      );
    }

    // Compteurs + activation sur TOUS les sujets : un sujet peut avoir perdu ses
    // scrutins sans qu'aucun dossier ne bouge (dé-liaison en amont).
    if (!dryRun) {
      await refreshSujetStats();
    }

    logger.info({
      created,
      updated,
      skipped,
      crossRef: validComponents.length - soloCount,
      solo: soloCount,
      totalDossiers,
      totalScrutins,
    }, 'Sujet generation completed');

    return {
      created,
      updated,
      crossRef: validComponents.length - soloCount,
      loiNumero: loiNumeroCount,
      solo: soloCount,
      totalDossiers,
      totalScrutins,
    };
  } finally {
    await prisma.$disconnect();
  }
}

// =============================================================================
// RÉPARATION DES LABELS TECHNIQUES
// =============================================================================

/**
 * Recalcule le label des sujets dont l'intitulé est resté un UID technique.
 *
 * `generateSujets()` ne pose le label qu'à la création : les sujets déjà en base
 * gardent celui qu'un `pickBestLabel()` antérieur leur a donné. Cette fonction
 * les repasse avec la règle corrigée (cf. `isUsableLabel`).
 *
 * Le **slug n'est pas touché** : il est dans les URLs publiques et dans les
 * sitemaps. Un sujet peut donc afficher un intitulé correct sous une URL encore
 * technique — c'est volontaire, la réécriture des slugs est une décision à part.
 */
export async function relabelTechnicalSujets(options: { dryRun?: boolean } = {}): Promise<{
  examined: number;
  relabeled: number;
  stillTechnical: number;
  changes: { slug: string; before: string; after: string }[];
}> {
  const { dryRun = false } = options;
  const prisma = new PrismaClient();

  try {
    const sujets = await prisma.$queryRaw<{ id: string; slug: string; label: string }[]>`
      SELECT id, slug, label FROM sujets WHERE label ~ '^DLR5L[0-9]+N[0-9]+$'
    `;

    const changes: { slug: string; before: string; after: string }[] = [];
    let stillTechnical = 0;

    for (const sujet of sujets) {
      const members = await prisma.$queryRaw<DossierRow[]>`
        SELECT
          d.id, d.uid, d.titre, d.titre_court as "titreCourt",
          d.url_an as "urlAN", d.url_senat as "urlSenat", d.loi_numero as "loiNumero",
          d.etat, d.date_depot as "dateDepot", d.date_adoption as "dateAdoption",
          d.loi_date_jo as "loiDateJO", 0 as "scrutinCount", d.sujet_id as "sujetId"
        FROM dossiers_legislatifs d WHERE d.sujet_id = ${sujet.id}
      `;

      if (members.length === 0) continue;

      const label = pickBestLabel(members);
      // Aucun dossier du groupe ne porte d'intitulé lisible : laisser en l'état
      // plutôt que réécrire un UID par un autre.
      if (!label || UID_AN_RE.test(label)) {
        stillTechnical++;
        continue;
      }
      if (label === sujet.label) continue;

      changes.push({ slug: sujet.slug, before: sujet.label, after: label });

      if (!dryRun) {
        await prisma.$executeRawUnsafe(
          `UPDATE sujets SET label = $1, updated_at = NOW() WHERE id = $2`,
          label, sujet.id,
        );
      }
    }

    logger.info(
      { examined: sujets.length, relabeled: changes.length, stillTechnical, dryRun },
      'Technical sujet labels repaired',
    );

    return { examined: sujets.length, relabeled: changes.length, stillTechnical, changes };
  } finally {
    await prisma.$disconnect();
  }
}

// =============================================================================
// RESYNC GLOBAL DES COMPTEURS + DÉSACTIVATION DES SUJETS VIDES
// =============================================================================

/**
 * Recalcule les compteurs de TOUS les sujets et désactive ceux qui n'ont plus
 * aucun scrutin.
 *
 * `generateSujets()` ne rafraîchit que les sujets qu'il a touchés : un sujet qui
 * perd ses scrutins en amont (dé-liaison d'un mauvais appariement, par exemple)
 * garde donc un `scrutin_count` périmé et reste `actif`, donnant une page vide
 * mais crédible. L'API filtre sur `actif = true`, la désactivation suffit à la
 * retirer du site sans casser d'URL ni supprimer d'historique.
 */
export async function refreshSujetStats(): Promise<{ deactivated: number; reactivated: number }> {
  const prisma = new PrismaClient();

  try {
    await prisma.$executeRawUnsafe(`
      UPDATE sujets s SET
        dossier_count = (SELECT COUNT(*) FROM dossiers_legislatifs d WHERE d.sujet_id = s.id),
        scrutin_count = (
          SELECT COUNT(*) FROM scrutins sc
          JOIN dossiers_legislatifs d ON sc.dossier_id = d.id
          WHERE d.sujet_id = s.id
        ),
        date_dernier_vote = (
          SELECT MAX(sc.date) FROM scrutins sc
          JOIN dossiers_legislatifs d ON sc.dossier_id = d.id
          WHERE d.sujet_id = s.id
        ),
        updated_at = NOW()
    `);

    const deactivated = await prisma.$executeRawUnsafe(
      `UPDATE sujets SET actif = false, updated_at = NOW() WHERE actif = true AND scrutin_count = 0`,
    );
    const reactivated = await prisma.$executeRawUnsafe(
      `UPDATE sujets SET actif = true, updated_at = NOW() WHERE actif = false AND scrutin_count > 0`,
    );

    logger.info({ deactivated, reactivated }, 'Sujet stats refreshed');
    return { deactivated, reactivated };
  } finally {
    await prisma.$disconnect();
  }
}

// =============================================================================
// STATUS COMPUTATION
// =============================================================================

/**
 * Compute the global status of a sujet from its dossiers' etats.
 * Priority: promulgue > adopte > en_cours > rejete > caduc > retire
 */
function computeStatus(members: DossierRow[]): string {
  const etats = members.map(d => d.etat).filter(Boolean) as string[];
  if (etats.length === 0) return 'en_cours';

  if (etats.includes('promulgue')) return 'promulgue';
  // Un rejet définitif par n'importe quelle chambre prime sur adopté/en_cours
  if (etats.includes('rejete')) return 'rejete';
  if (etats.includes('adopte')) return 'adopte';
  if (etats.includes('en_cours')) return 'en_cours';
  if (etats.every(e => e === 'caduc')) return 'caduc';
  if (etats.every(e => e === 'retire')) return 'retire';

  return 'en_cours';
}

/**
 * Compute dateDebut (earliest date) and dateFin (latest date) from dossiers.
 */
function computeDates(members: DossierRow[]): { dateDebut: Date | null; dateFin: Date | null } {
  const allDates: Date[] = [];

  for (const d of members) {
    if (d.dateDepot) allDates.push(new Date(d.dateDepot));
  }

  const endDates: Date[] = [];
  for (const d of members) {
    if (d.loiDateJO) endDates.push(new Date(d.loiDateJO));
    else if (d.dateAdoption) endDates.push(new Date(d.dateAdoption));
  }

  const dateDebut = allDates.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const dateFin = endDates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return { dateDebut, dateFin };
}

// =============================================================================
// LABEL PICKER
// =============================================================================

function pickBestLabel(members: DossierRow[]): string {
  // Prefer titreCourt if available, pick the shortest non-null one
  const titresCourts = members
    .filter(d => isUsableLabel(d.titreCourt, d.uid))
    .map(d => d.titreCourt as string);

  const shortestTitreCourt = titresCourts.sort((a, b) => a.length - b.length)[0];
  if (shortestTitreCourt) {
    return cleanLabel(shortestTitreCourt);
  }

  // Fallback to shortest titre
  const titres = members
    .filter(d => isUsableLabel(d.titre, d.uid))
    .map(d => d.titre as string);

  const shortestTitre = titres.sort((a, b) => a.length - b.length)[0];
  if (shortestTitre) {
    return cleanLabel(shortestTitre);
  }

  return members[0]?.uid ?? '';
}

/** Un UID AN : « DLR5L16N45914 ». */
const UID_AN_RE = /^DLR5L\d+N\d+$/i;

/**
 * Écarte les titres qui n'en sont pas.
 *
 * 1935 dossiers AN ont un `titre_court` égal à leur propre UID. Comme le label
 * est choisi sur le critère du PLUS COURT, cet UID (13 caractères) battait
 * systématiquement un vrai intitulé, et le sujet héritait d'un label technique
 * du type « DLR5L15N45830 » — repris tel quel dans le slug, donc dans l'URL.
 */
function isUsableLabel(candidate: string | null, uid: string): boolean {
  if (!candidate) return false;
  const trimmed = candidate.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.toUpperCase() === uid.toUpperCase()) return false;
  // Un UID d'un AUTRE dossier du même sujet est tout aussi illisible.
  if (UID_AN_RE.test(trimmed)) return false;
  return true;
}

/**
 * Clean up labels: replace underscores with spaces, normalize whitespace.
 */
function cleanLabel(label: string): string {
  return label
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
