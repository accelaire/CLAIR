// =============================================================================
// Sujet Links Generator — Famille "construction" (documents officiels)
//
// Pour chaque sujet, extrait les documents officiels de l'Assemblée nationale
// référencés dans les dossiers (actesLegislatifs.texteAssocie), construit l'URL
// canonique du PDF et stocke un SujetLien (famille='construction').
//
// L'open data AN ne contient AUCUNE URL cliquable : seulement des UID de
// documents (ex. PRJLANR5L17B0529). L'URL est reconstruite via le point
// d'entrée stable https://www.assemblee-nationale.fr/dyn/docs/<UID>.pdf qui
// redirige vers le PDF réel (vérifié 200 pour tous les types de documents).
//
// Diff idempotent : seuls les liens nouveaux sont validés (HEAD) puis insérés ;
// les liens disparus sont supprimés. Conçu pour tourner dans smart-sync.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

// -----------------------------------------------------------------------------
// Types de documents AN (préfixe 4 lettres de l'UID → libellé + ordre d'affichage)
// Seuls les préfixes connus et fiables sont surfacés.
// -----------------------------------------------------------------------------

const AN_DOC_BASE = 'https://www.assemblee-nationale.fr/dyn/docs';

const AN_DOC_TYPES: Record<string, { label: string; ordre: number; withNumber?: boolean }> = {
  PRJL: { label: 'Projet de loi', ordre: 1 },
  PION: { label: 'Proposition de loi', ordre: 1 },
  PNRE: { label: 'Proposition de résolution', ordre: 2 },
  ACIN: { label: 'Accord international', ordre: 2 },
  ETDI: { label: "Étude d'impact", ordre: 3 },
  RAPP: { label: 'Rapport', ordre: 4, withNumber: true },
  RINF: { label: "Rapport d'information", ordre: 5, withNumber: true },
};

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RefRow {
  sujetId: string;
  refs: unknown; // jsonb array de texteAssocie (string | { refTexteAssocie })
}

interface ExistingRow {
  sujetId: string;
  url: string;
  id: string;
}

interface DocLink {
  url: string;
  titre: string;
  ordre: number;
}

export interface GenerateSujetLinksResult {
  sujetsProcessed: number;
  created: number;
  deleted: number;
  validated: number;
  dropped: number; // liens candidats écartés car URL morte (404)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Normalise le tableau jsonb de texteAssocie en liste d'UID (string). */
function normalizeRefs(refs: unknown): string[] {
  if (!Array.isArray(refs)) return [];
  const out: string[] = [];
  for (const r of refs) {
    if (typeof r === 'string') {
      out.push(r);
    } else if (r && typeof r === 'object') {
      const v = (r as Record<string, unknown>).refTexteAssocie ?? (r as Record<string, unknown>).texteAssocie;
      if (typeof v === 'string') out.push(v);
    }
  }
  return out;
}

/** Extrait le numéro de document depuis un UID (ex. PRJLANR5L17B0529 → "529"). */
function uidNumber(uid: string): string | null {
  const m = uid.match(/B(\d+)\D*$/);
  if (!m) return null;
  return String(parseInt(m[1], 10));
}

/** Construit la liste de liens (dédupliquée, ordonnée) pour un ensemble d'UID. */
function buildLinksForUids(uids: Set<string>): DocLink[] {
  const links: DocLink[] = [];
  const seenUrls = new Set<string>();

  for (const uid of uids) {
    // UID attendu : 4 lettres de type + chambre/legislature + B<num>
    if (!/^[A-Z]{4}AN/.test(uid)) continue; // documents AN uniquement (v1)
    const prefix = uid.slice(0, 4);
    const type = AN_DOC_TYPES[prefix];
    if (!type) continue;

    const url = `${AN_DOC_BASE}/${uid}.pdf`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    let titre = type.label;
    if (type.withNumber) {
      const n = uidNumber(uid);
      if (n) titre = `${type.label} n°${n}`;
    }

    links.push({ url, titre, ordre: type.ordre });
  }

  links.sort((a, b) => a.ordre - b.ordre || a.titre.localeCompare(b.titre, 'fr'));
  return links;
}

/** Vérifie qu'une URL résout (HEAD, redirections suivies).
 *  En cas d'erreur réseau on garde le lien (le pattern est déterministe et
 *  vérifié) ; seul un 4xx/5xx explicite écarte le lien. */
async function urlResolves(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'CLAIR/1.0 (+https://clair.vote)' },
    });
    clearTimeout(timeout);
    return res.status >= 200 && res.status < 400;
  } catch {
    return true; // erreur réseau : on ne supprime pas un lien au pattern fiable
  }
}

/** Valide une liste d'URLs en parallèle borné. Retourne le set des URLs vivantes. */
async function validateUrls(urls: string[], concurrency = 8): Promise<Set<string>> {
  const alive = new Set<string>();
  let i = 0;
  async function worker(): Promise<void> {
    while (i < urls.length) {
      const url = urls[i++];
      if (await urlResolves(url)) alive.add(url);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return alive;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

export async function generateSujetLinks(
  options: { validate?: boolean; dryRun?: boolean } = {},
): Promise<GenerateSujetLinksResult> {
  const prisma = new PrismaClient();
  const { validate = true, dryRun = false } = options;

  try {
    logger.info({ validate, dryRun }, 'Starting sujet links generation (construction)...');

    // -------------------------------------------------------------------------
    // 1. Extraction des refs de documents côté SQL (mémoire-safe : pas de gros
    //    JSON rapatrié en Node, seulement les tableaux de texteAssocie).
    // -------------------------------------------------------------------------
    const rows = await prisma.$queryRaw<RefRow[]>`
      SELECT d.sujet_id as "sujetId",
             jsonb_path_query_array(d.source_data, '$.**.texteAssocie') as refs
      FROM dossiers_legislatifs d
      WHERE d.uid LIKE 'DLR%'
        AND d.sujet_id IS NOT NULL
        AND d.source_data ? 'actesLegislatifs'
    `;

    const uidsBySujet = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!uidsBySujet.has(row.sujetId)) uidsBySujet.set(row.sujetId, new Set());
      const set = uidsBySujet.get(row.sujetId)!;
      for (const uid of normalizeRefs(row.refs)) set.add(uid);
    }

    // -------------------------------------------------------------------------
    // 2. Liens construction/auto existants (pour diff idempotent)
    // -------------------------------------------------------------------------
    const existingRows = await prisma.$queryRaw<ExistingRow[]>`
      SELECT sujet_id as "sujetId", url, id
      FROM sujet_liens
      WHERE famille = 'construction' AND provenance = 'auto'
    `;
    const existingBySujet = new Map<string, Map<string, string>>(); // sujetId → url → id
    for (const r of existingRows) {
      if (!existingBySujet.has(r.sujetId)) existingBySujet.set(r.sujetId, new Map());
      existingBySujet.get(r.sujetId)!.set(r.url, r.id);
    }

    // -------------------------------------------------------------------------
    // 3. Diff par sujet : calcul des inserts / deletes
    // -------------------------------------------------------------------------
    const inserts: Array<{ sujetId: string; link: DocLink }> = [];
    const deleteIds: string[] = [];

    // Sujets ayant des documents AN
    for (const [sujetId, uids] of uidsBySujet) {
      const desired = buildLinksForUids(uids);
      const existing = existingBySujet.get(sujetId) ?? new Map<string, string>();
      const desiredUrls = new Set(desired.map(d => d.url));

      for (const link of desired) {
        if (!existing.has(link.url)) inserts.push({ sujetId, link });
      }
      for (const [url, id] of existing) {
        if (!desiredUrls.has(url)) deleteIds.push(id);
      }
    }

    // Nettoyage : sujets qui avaient des liens construction mais n'ont plus de docs AN
    for (const [sujetId, existing] of existingBySujet) {
      if (!uidsBySujet.has(sujetId)) {
        for (const id of existing.values()) deleteIds.push(id);
      }
    }

    // -------------------------------------------------------------------------
    // 4. Validation HEAD des seules URLs nouvelles
    // -------------------------------------------------------------------------
    let validated = 0;
    let dropped = 0;
    let kept = inserts;

    if (validate && inserts.length > 0 && !dryRun) {
      const urls = [...new Set(inserts.map(i => i.link.url))];
      const alive = await validateUrls(urls);
      validated = urls.length;
      kept = inserts.filter(i => alive.has(i.link.url));
      dropped = inserts.length - kept.length;
    }

    logger.info(
      { toInsert: kept.length, toDelete: deleteIds.length, validated, dropped },
      'Sujet links diff computed',
    );

    // -------------------------------------------------------------------------
    // 5. Application
    // -------------------------------------------------------------------------
    if (!dryRun) {
      if (deleteIds.length > 0) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM sujet_liens WHERE id = ANY($1::text[])`,
          deleteIds,
        );
      }
      for (const { sujetId, link } of kept) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO sujet_liens
             (id, sujet_id, famille, titre, url, source, source_label, provenance, ordre, created_at, updated_at)
           VALUES ($1, $2, 'construction', $3, $4, 'an', 'Assemblée nationale', 'auto', $5, NOW(), NOW())
           ON CONFLICT (sujet_id, url) DO NOTHING`,
          crypto.randomUUID(), sujetId, link.titre, link.url, link.ordre,
        );
      }
    }

    const result: GenerateSujetLinksResult = {
      sujetsProcessed: uidsBySujet.size,
      created: kept.length,
      deleted: deleteIds.length,
      validated,
      dropped,
    };

    logger.info(result, 'Sujet links generation completed');
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

// =============================================================================
// Famille "contexte" — Wikipédia FR (résolution avec seuil de confiance)
//
// Sur une plateforme de transparence, un mauvais lien coûte plus cher que
// l'absence de lien. On ne garde donc un article que si les tokens significatifs
// du label du sujet sont majoritairement couverts par le titre de l'article
// (containment >= seuil), ce qui élimine le bruit (articles génériques, hors
// sujet). vie-publique.fr reste un TODO (pas d'API/URL dérivable fiable).
// =============================================================================

const WIKI_API = 'https://fr.wikipedia.org/w/api.php';
const WIKI_UA = 'CLAIR/1.0 (+https://clair.vote)';
const CONTEXT_MIN_CONTAINMENT = 0.6;

// Mots génériques ignorés dans le scoring (procédure, années, ordinaux).
const CONTEXT_STOPWORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'pour', 'dans',
  'au', 'aux', 'sur', 'par',
  'projet', 'loi', 'proposition', 'resolution', 'texte', 'relatif', 'relative',
  'relatifs', 'portant', 'visant', 'tendant',
  '15e', '16e', '17e', '2022', '2023', '2024', '2025', '2026', '2027',
]);

function ctxNorm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function ctxTokens(s: string): Set<string> {
  return new Set(
    ctxNorm(s).split(' ').filter(w => w.length > 2 && !CONTEXT_STOPWORDS.has(w)),
  );
}

function wikiUrl(title: string): string {
  return 'https://fr.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
}

async function searchWikipedia(query: string): Promise<string | null> {
  try {
    const url = `${WIKI_API}?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = (await res.json()) as { query?: { search?: Array<{ title: string }> } };
    return json?.query?.search?.[0]?.title ?? null;
  } catch {
    return null;
  }
}

/** Résout (ou non) un article Wikipédia FR fiable pour le label d'un sujet. */
async function resolveWikipedia(label: string): Promise<{ titre: string; url: string } | null> {
  // Labels manifestement non-pertinents (UID bruts)
  if (/^DLR\d/i.test(label) || /^SENAT-/i.test(label)) return null;

  const labelTokens = ctxTokens(label);
  if (labelTokens.size < 2) return null;

  const title = await searchWikipedia(label);
  if (!title) return null;

  const titleTokens = ctxTokens(title);
  if (titleTokens.size < 2) return null;

  let overlap = 0;
  for (const t of labelTokens) if (titleTokens.has(t)) overlap++;
  if (overlap < 2) return null;
  if (overlap / labelTokens.size < CONTEXT_MIN_CONTAINMENT) return null;

  return { titre: title, url: wikiUrl(title) };
}

export interface GenerateSujetContextResult {
  sujetsProcessed: number;
  resolved: number;
  created: number;
  deleted: number;
}

export async function generateSujetContextLinks(
  options: { dryRun?: boolean; concurrency?: number } = {},
): Promise<GenerateSujetContextResult> {
  const prisma = new PrismaClient();
  const { dryRun = false, concurrency = 4 } = options;

  try {
    logger.info({ dryRun, concurrency }, 'Starting sujet context links generation (Wikipédia)...');

    const sujets = await prisma.$queryRaw<Array<{ id: string; label: string }>>`
      SELECT id, label FROM sujets WHERE actif = true
    `;

    // Liens contexte/wikipedia/auto existants (peut y en avoir >1 par sujet)
    const existingRows = await prisma.$queryRaw<ExistingRow[]>`
      SELECT sujet_id as "sujetId", url, id
      FROM sujet_liens
      WHERE famille = 'contexte' AND source = 'wikipedia' AND provenance = 'auto'
    `;
    const existingBySujet = new Map<string, Array<{ url: string; id: string }>>();
    for (const r of existingRows) {
      if (!existingBySujet.has(r.sujetId)) existingBySujet.set(r.sujetId, []);
      existingBySujet.get(r.sujetId)!.push({ url: r.url, id: r.id });
    }

    // Résolution Wikipédia (concurrence bornée)
    const desired = new Map<string, { titre: string; url: string }>();
    let idx = 0;
    async function worker(): Promise<void> {
      while (idx < sujets.length) {
        const s = sujets[idx++];
        const r = await resolveWikipedia(s.label);
        if (r) desired.set(s.id, r);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, sujets.length) }, worker));

    // Diff : au plus 1 lien wiki par sujet
    const inserts: Array<{ sujetId: string; titre: string; url: string }> = [];
    const deleteIds: string[] = [];
    for (const s of sujets) {
      const want = desired.get(s.id);
      const have = existingBySujet.get(s.id) ?? [];
      if (want) {
        const match = have.find(h => h.url === want.url);
        // supprime les anciens liens wiki qui ne correspondent plus
        for (const h of have) if (h.url !== want.url) deleteIds.push(h.id);
        if (!match) inserts.push({ sujetId: s.id, titre: want.titre, url: want.url });
      } else {
        for (const h of have) deleteIds.push(h.id);
      }
    }

    logger.info(
      { resolved: desired.size, toInsert: inserts.length, toDelete: deleteIds.length },
      'Sujet context links diff computed',
    );

    if (!dryRun) {
      if (deleteIds.length > 0) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM sujet_liens WHERE id = ANY($1::text[])`,
          deleteIds,
        );
      }
      for (const { sujetId, titre, url } of inserts) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO sujet_liens
             (id, sujet_id, famille, titre, url, source, source_label, provenance, ordre, created_at, updated_at)
           VALUES ($1, $2, 'contexte', $3, $4, 'wikipedia', 'Wikipédia', 'auto', 0, NOW(), NOW())
           ON CONFLICT (sujet_id, url) DO NOTHING`,
          crypto.randomUUID(), sujetId, titre, url,
        );
      }
    }

    const result: GenerateSujetContextResult = {
      sujetsProcessed: sujets.length,
      resolved: desired.size,
      created: inserts.length,
      deleted: deleteIds.length,
    };
    logger.info(result, 'Sujet context links generation completed');
    return result;
  } finally {
    await prisma.$disconnect();
  }
}
