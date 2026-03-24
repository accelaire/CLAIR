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
import { Prisma, PrismaClient } from '@prisma/client';
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
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extrait l'UID AN depuis une URL assemblee-nationale.fr
 * Ex: "https://www.assemblee-nationale.fr/dyn/17/dossiers/DLR5L17N12345" → "DLR5L17N12345"
 * Aussi : "/dyn/17/dossiers/alt/DLR5L17N12345" ou d'autres variantes
 */
function extractANUidFromUrl(url: string): string | null {
  const match = url.match(/(DLR5L\d+N\d+)/);
  return match ? match[1] : null;
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
        (SELECT COUNT(*)::int FROM scrutins s WHERE s.dossier_id = d.id) as "scrutinCount"
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
    for (const [loiNumero, group] of dossiersByLoiNumero) {
      if (group.length < 2) continue;

      // Only merge if the group spans both chambers
      const hasAN = group.some(d => d.uid.startsWith('DLR'));
      const hasSenat = group.some(d => d.uid.startsWith('SENAT'));
      if (!hasAN || !hasSenat) continue;

      for (let i = 1; i < group.length; i++) {
        uf.union(group[0].id, group[i].id);
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
    // Step 4: Create/update Sujets
    // =========================================================================
    let created = 0;
    let updated = 0;
    let soloCount = 0;

    // Track used slugs for collision handling
    const usedSlugs = new Set<string>();

    if (dryRun) {
      // Dry run — just report stats
      for (const members of validComponents) {
        const isMultiChambre = new Set(members.map(d =>
          d.uid.startsWith('SENAT') ? 'senat' : 'assemblee'
        )).size > 1;

        if (isMultiChambre) {
          crossRefCount; // already counted
        } else {
          soloCount++;
        }
      }

      const totalScrutins = validComponents.reduce(
        (sum, members) => sum + members.reduce((s, d) => s + d.scrutinCount, 0),
        0
      );

      logger.info({
        wouldCreate: validComponents.length,
        crossRef: validComponents.filter(m =>
          new Set(m.map(d => d.uid.startsWith('SENAT') ? 'senat' : 'assemblee')).size > 1
        ).length,
        solo: validComponents.filter(m =>
          new Set(m.map(d => d.uid.startsWith('SENAT') ? 'senat' : 'assemblee')).size === 1
        ).length,
        totalDossiers: validComponents.reduce((sum, m) => sum + m.length, 0),
        totalScrutins,
      }, 'DRY RUN — would create sujets');

      return {
        created: 0,
        updated: 0,
        crossRef: validComponents.filter(m =>
          new Set(m.map(d => d.uid.startsWith('SENAT') ? 'senat' : 'assemblee')).size > 1
        ).length,
        loiNumero: loiNumeroCount,
        solo: validComponents.filter(m =>
          new Set(m.map(d => d.uid.startsWith('SENAT') ? 'senat' : 'assemblee')).size === 1
        ).length,
        totalDossiers: validComponents.reduce((sum, m) => sum + m.length, 0),
        totalScrutins,
      };
    }

    // Real run — create sujets
    for (const members of validComponents) {
      const chambres = new Set(members.map(d =>
        d.uid.startsWith('SENAT') ? 'senat' : 'assemblee'
      ));
      const isMultiChambre = chambres.size > 1;
      const matchMethod = isMultiChambre ? 'cross_ref' : 'solo';

      if (!isMultiChambre) soloCount++;

      // Pick best label: shortest titreCourt, or shortest titre
      const label = pickBestLabel(members);
      let baseSlug = slugify(label);
      if (!baseSlug) baseSlug = `sujet-${members[0].uid.toLowerCase()}`;

      // Handle slug collisions
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

      // Use raw SQL for all DB operations to avoid schema drift issues
      const sujetId = crypto.randomUUID();

      await prisma.$executeRawUnsafe(
        `INSERT INTO sujets (id, slug, label, dossier_count, scrutin_count, match_method, status, date_debut, date_fin, actif, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
         ON CONFLICT (slug) DO UPDATE SET
           label = EXCLUDED.label,
           dossier_count = EXCLUDED.dossier_count,
           scrutin_count = EXCLUDED.scrutin_count,
           match_method = EXCLUDED.match_method,
           status = EXCLUDED.status,
           date_debut = EXCLUDED.date_debut,
           date_fin = EXCLUDED.date_fin,
           updated_at = NOW()`,
        sujetId, slug, label, members.length, totalScrutins, matchMethod, status, dateDebut, dateFin,
      );
      created++;

      // Link dossiers to sujet
      for (const d of members) {
        await prisma.$executeRawUnsafe(
          `UPDATE dossiers_legislatifs SET sujet_id = $1 WHERE id = $2`,
          sujetId, d.id,
        );
      }
    }

    const totalDossiers = validComponents.reduce((sum, m) => sum + m.length, 0);
    const totalScrutins = validComponents.reduce(
      (sum, members) => sum + members.reduce((s, d) => s + d.scrutinCount, 0),
      0
    );

    // Update dossierCount / scrutinCount / dateDernierVote for all sujets (recalc from reality)
    await prisma.$executeRaw`
      UPDATE sujets s SET
        dossier_count = (SELECT COUNT(*) FROM dossiers_legislatifs d WHERE d.sujet_id = s.id),
        scrutin_count = (
          SELECT COUNT(*)
          FROM scrutins sc
          JOIN dossiers_legislatifs d ON sc.dossier_id = d.id
          WHERE d.sujet_id = s.id
        ),
        date_dernier_vote = (
          SELECT MAX(sc.date)
          FROM scrutins sc
          JOIN dossiers_legislatifs d ON sc.dossier_id = d.id
          WHERE d.sujet_id = s.id
        )
    `;

    logger.info({
      created,
      updated,
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
  if (etats.includes('adopte')) return 'adopte';
  if (etats.includes('en_cours')) return 'en_cours';
  if (etats.every(e => e === 'rejete')) return 'rejete';
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

  const dateDebut = allDates.length > 0
    ? allDates.sort((a, b) => a.getTime() - b.getTime())[0]
    : null;

  const dateFin = endDates.length > 0
    ? endDates.sort((a, b) => b.getTime() - a.getTime())[0]
    : null;

  return { dateDebut, dateFin };
}

// =============================================================================
// LABEL PICKER
// =============================================================================

function pickBestLabel(members: DossierRow[]): string {
  // Prefer titreCourt if available, pick the shortest non-null one
  const titresCourts = members
    .map(d => d.titreCourt)
    .filter((t): t is string => t !== null && t.length > 0);

  if (titresCourts.length > 0) {
    return cleanLabel(titresCourts.sort((a, b) => a.length - b.length)[0]);
  }

  // Fallback to shortest titre
  const titres = members
    .map(d => d.titre)
    .filter((t): t is string => t !== null && t.length > 0);

  if (titres.length > 0) {
    return cleanLabel(titres.sort((a, b) => a.length - b.length)[0]);
  }

  return members[0].uid;
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
