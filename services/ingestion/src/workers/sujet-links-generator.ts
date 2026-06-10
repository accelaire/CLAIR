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
import { tavilySearch } from '../sources/tavily/client';
import { embedTexts, cosineSim } from '../sources/mistral/embeddings';

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
  if (!m || !m[1]) return null;
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
      const url = urls[i++]!;
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
// Famille "contexte" — sources analytiques neutres (re-ranking par embeddings)
//
// Sur une plateforme de transparence, un mauvais lien coûte plus cher que
// l'absence de lien. Deux sources, deux garde-fous adaptés :
//   • vie-publique.fr (primaire) : une page dossier par loi. Retrieval via Tavily
//     restreint au domaine, filtre par type d'URL (loi/eclairage/rapport), puis
//     re-ranking par embeddings (mistral-embed) pour départager les dossiers.
//   • Wikipédia FR (secondaire) : pour les grands thèmes. Gardé en HAUTE confiance
//     seulement (containment du titre + ancrage ≥2 tokens + garde-fou année), car
//     son titre porte l'année du sujet (ex. "Budget de l'État français en 2025").
// Le cosine n'est PAS discriminant sur des intitulés courts : il sert au
// re-ranking, pas de seuil d'acceptation ; la précision vient des filtres.
// =============================================================================

const WIKI_API = 'https://fr.wikipedia.org/w/api.php';
const WIKI_UA = 'CLAIR/1.0 (+https://clair.vote)';
const CONTEXT_MIN_CONTAINMENT = 0.6;
const CONTEXT_TOPK = 5;

// vie-publique : seuls les types de page analytiques/législatifs sont surfacés
// (on écarte discours, mots-clés, pages de catégorie, fiches génériques…).
const VP_DOMAIN = 'vie-publique.fr';
const VP_ALLOWED_PATHS = ['/loi/', '/eclairage/', '/rapport/'];

// Mots génériques ignorés dans le scoring (procédure, ordinaux). Les années NE
// sont PAS dans cette liste : elles sont retirées des tokens via un filtre dédié
// et servent au garde-fou année (cf. ctxYears).
const CONTEXT_STOPWORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'pour', 'dans',
  'au', 'aux', 'sur', 'par', 'a', 'l', 'd',
  'projet', 'loi', 'proposition', 'resolution', 'texte', 'relatif', 'relative',
  'relatifs', 'portant', 'visant', 'tendant',
  '15e', '16e', '17e',
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
    ctxNorm(s)
      .split(' ')
      .filter(w => w.length > 2 && !CONTEXT_STOPWORDS.has(w) && !/^\d{4}$/.test(w)),
  );
}

/** Années (19xx/20xx) présentes dans une chaîne. */
function ctxYears(s: string): Set<string> {
  return new Set(s.match(/\b(?:19|20)\d{2}\b/g) ?? []);
}

function wikiUrl(title: string): string {
  return 'https://fr.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
}

interface ContextCandidate { titre: string; url: string; }
export interface ContextLink { source: string; sourceLabel: string; titre: string; url: string; ordre: number; }

// ---- vie-publique (primaire) -------------------------------------------------

function vpPathAllowed(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return VP_ALLOWED_PATHS.some(p => path.startsWith(p));
  } catch {
    return false;
  }
}

function cleanVpTitle(title: string): string {
  return title.replace(/\s*[|–-]\s*vie[- ]publique(\.fr)?\s*$/i, '').trim();
}

// `ok: false` = source indisponible (clé absente, erreur réseau/API) : le résultat
// ne fait pas foi et ne doit ni marquer le sujet résolu ni supprimer ses liens.
interface ResolveOutcome { cand: ContextCandidate | null; ok: boolean; }

async function resolveViePublique(label: string): Promise<ResolveOutcome> {
  const results = await tavilySearch(label, { includeDomains: [VP_DOMAIN], maxResults: CONTEXT_TOPK });
  if (results === null) return { cand: null, ok: false };
  if (results.length === 0) return { cand: null, ok: true };

  const labelTokens = ctxTokens(label);
  // Whitelist type d'URL + ancrage lexical (≥1 token significatif partagé).
  const cands = results
    .filter(r => vpPathAllowed(r.url))
    .map(r => {
      const titre = cleanVpTitle(r.title);
      const tt = ctxTokens(titre);
      let overlap = 0;
      for (const t of labelTokens) if (tt.has(t)) overlap++;
      return { titre, url: r.url, content: (r.content ?? '').slice(0, 400), overlap };
    })
    .filter(c => c.overlap >= 1);

  if (cands.length === 0) return { cand: null, ok: true };
  if (cands.length === 1) return { cand: { titre: cands[0]!.titre, url: cands[0]!.url }, ok: true };

  // Re-ranking sémantique entre dossiers candidats (sinon ordre Tavily).
  const embs = await embedTexts([label, ...cands.map(c => `${c.titre}. ${c.content}`)]);
  let best = cands[0]!;
  if (embs && embs.length === cands.length + 1) {
    const le = embs[0]!;
    let bestScore = -Infinity;
    for (let i = 0; i < cands.length; i++) {
      const score = cosineSim(le, embs[i + 1]!);
      if (score > bestScore) { bestScore = score; best = cands[i]!; }
    }
  }
  return { cand: { titre: best.titre, url: best.url }, ok: true };
}

// ---- Wikipédia (secondaire, haute confiance) --------------------------------

/** Retourne null si l'API Wikipédia est indisponible (réseau, non-OK). */
async function searchWikipediaTitles(query: string): Promise<string[] | null> {
  try {
    const url = `${WIKI_API}?action=query&list=search&format=json&srlimit=${CONTEXT_TOPK}&srsearch=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_UA }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = (await res.json()) as { query?: { search?: Array<{ title: string }> } };
    return (json?.query?.search ?? []).map(s => s.title);
  } catch {
    return null;
  }
}

/** Résout (ou non) un article Wikipédia FR fiable pour le label d'un sujet. */
async function resolveWikipedia(label: string): Promise<ResolveOutcome> {
  // Labels manifestement non-pertinents (UID bruts)
  if (/^DLR\d/i.test(label) || /^SENAT-/i.test(label)) return { cand: null, ok: true };

  const labelTokens = ctxTokens(label);
  if (labelTokens.size < 2) return { cand: null, ok: true };
  const labelYears = ctxYears(label);

  const titles = await searchWikipediaTitles(label);
  if (titles === null) return { cand: null, ok: false };
  let best: string | null = null;
  let bestOverlap = 0;
  for (const title of titles) {
    const titleTokens = ctxTokens(title);
    if (titleTokens.size < 1) continue;
    // Garde-fou année : si le label ET le titre portent une année, elles doivent
    // coïncider (évite "budget 2023" → "Budget de l'État français en 2025").
    const titleYears = ctxYears(title);
    if (labelYears.size > 0 && titleYears.size > 0 && ![...labelYears].some(y => titleYears.has(y))) continue;
    let overlap = 0;
    for (const t of labelTokens) if (titleTokens.has(t)) overlap++;
    if (overlap < 2) continue;
    // Containment du TITRE : ses tokens significatifs sont majoritairement dans
    // le label → l'article est bien sur le sujet (pas plus large/à côté).
    if (overlap / titleTokens.size < CONTEXT_MIN_CONTAINMENT) continue;
    if (overlap > bestOverlap) { bestOverlap = overlap; best = title; }
  }
  return { cand: best ? { titre: best, url: wikiUrl(best) } : null, ok: true };
}

// ---- Combinaison -------------------------------------------------------------

/** Liens de contexte d'un sujet : vie-publique (ordre 0) + Wikipédia (ordre 1).
 *  `ok: false` si au moins une source était indisponible : les liens trouvés
 *  restent insérables, mais le résultat est incomplet. */
async function resolveContextLinks(label: string): Promise<{ links: ContextLink[]; ok: boolean }> {
  const [vp, wiki] = await Promise.all([resolveViePublique(label), resolveWikipedia(label)]);
  const links: ContextLink[] = [];
  if (vp.cand) links.push({ source: 'vie-publique', sourceLabel: 'Vie-publique', titre: vp.cand.titre, url: vp.cand.url, ordre: 0 });
  if (wiki.cand) links.push({ source: 'wikipedia', sourceLabel: 'Wikipédia', titre: wiki.cand.titre, url: wiki.cand.url, ordre: 1 });
  return { links, ok: vp.ok && wiki.ok };
}

/** Hash d'entrée pour la résolution incrémentale (change si label/statut change). */
function contextHash(label: string, status: string): string {
  return crypto.createHash('md5').update(`${label}|${status}`).digest('hex');
}

export interface GenerateSujetContextResult {
  sujetsProcessed: number;
  resolved: number;
  created: number;
  deleted: number;
  viePublique: number;
  wikipedia: number;
}

export async function generateSujetContextLinks(
  options: { dryRun?: boolean; concurrency?: number; limit?: number; incremental?: boolean } = {},
): Promise<GenerateSujetContextResult> {
  const prisma = new PrismaClient();
  const { dryRun = false, concurrency = 3, limit, incremental = false } = options;
  const STALE_MS = 30 * 24 * 60 * 60 * 1000; // retry du long-tail sans lien après 30j

  try {
    logger.info({ dryRun, concurrency, limit, incremental }, 'Starting sujet context links generation (vie-publique + Wikipédia)...');

    // ORDER BY scrutin_count : un éventuel --limit cible les sujets importants.
    const allSujets = await prisma.$queryRaw<Array<{
      id: string;
      label: string;
      status: string;
      contextResolvedAt: Date | null;
      contextInputHash: string | null;
    }>>`
      SELECT id, label, status,
             context_resolved_at AS "contextResolvedAt",
             context_input_hash AS "contextInputHash"
      FROM sujets WHERE actif = true
      ORDER BY scrutin_count DESC NULLS LAST
    `;

    // Liens contexte/auto existants, toutes sources (peut y en avoir >1 par sujet)
    const existingRows = await prisma.$queryRaw<ExistingRow[]>`
      SELECT sujet_id as "sujetId", url, id
      FROM sujet_liens
      WHERE famille = 'contexte' AND provenance = 'auto'
    `;
    const existingBySujet = new Map<string, Array<{ url: string; id: string }>>();
    for (const r of existingRows) {
      if (!existingBySujet.has(r.sujetId)) existingBySujet.set(r.sujetId, []);
      existingBySujet.get(r.sujetId)!.push({ url: r.url, id: r.id });
    }

    // Mode incrémental : ne traiter que les sujets nouveaux, dont le hash
    // (label|status) a changé, ou sans lien depuis >30j. Sinon : tous.
    const candidates = typeof limit === 'number' ? allSujets.slice(0, limit) : allSujets;
    const now = Date.now();
    const sujets = incremental
      ? candidates.filter(s => {
          if (s.contextResolvedAt == null) return true;
          if (s.contextInputHash !== contextHash(s.label, s.status)) return true;
          const hasLink = (existingBySujet.get(s.id)?.length ?? 0) > 0;
          return !hasLink && now - new Date(s.contextResolvedAt).getTime() > STALE_MS;
        })
      : candidates;

    // Résolution multi-sources (concurrence bornée — appels Tavily + embeddings).
    // okIds = sujets dont toutes les sources ont répondu : eux seuls peuvent être
    // marqués résolus ou voir leurs liens supprimés (un échec transitoire ne doit
    // ni geler le sujet 30j ni effacer des liens valides).
    const desired = new Map<string, ContextLink[]>();
    const okIds = new Set<string>();
    let idx = 0;
    const worker = async (): Promise<void> => {
      while (idx < sujets.length) {
        const s = sujets[idx++]!;
        const { links, ok } = await resolveContextLinks(s.label);
        if (links.length > 0) desired.set(s.id, links);
        if (ok) okIds.add(s.id);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, sujets.length) }, worker));

    // Diff par URL : insère les liens désirés absents, supprime les liens auto
    // qui ne sont plus désirés (idempotent ; provenance='manual' préservée).
    const inserts: ContextLink[] = [];
    const insertSujetIds: string[] = [];
    const deleteIds: string[] = [];
    let countViePublique = 0;
    let countWikipedia = 0;
    for (const s of sujets) {
      const want = desired.get(s.id) ?? [];
      const have = existingBySujet.get(s.id) ?? [];
      const wantUrls = new Set(want.map(l => l.url));
      if (okIds.has(s.id)) {
        for (const h of have) if (!wantUrls.has(h.url)) deleteIds.push(h.id);
      }
      const haveUrls = new Set(have.map(h => h.url));
      for (const link of want) {
        if (link.source === 'vie-publique') countViePublique++;
        else if (link.source === 'wikipedia') countWikipedia++;
        if (!haveUrls.has(link.url)) { inserts.push(link); insertSujetIds.push(s.id); }
      }
    }

    logger.info(
      {
        resolved: desired.size,
        toInsert: inserts.length,
        toDelete: deleteIds.length,
        viePublique: countViePublique,
        wikipedia: countWikipedia,
      },
      'Sujet context links diff computed',
    );

    if (!dryRun) {
      if (deleteIds.length > 0) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM sujet_liens WHERE id = ANY($1::text[])`,
          deleteIds,
        );
      }
      for (let i = 0; i < inserts.length; i++) {
        const link = inserts[i]!;
        await prisma.$executeRawUnsafe(
          `INSERT INTO sujet_liens
             (id, sujet_id, famille, titre, url, source, source_label, provenance, ordre, created_at, updated_at)
           VALUES ($1, $2, 'contexte', $3, $4, $5, $6, 'auto', $7, NOW(), NOW())
           ON CONFLICT (sujet_id, url) DO NOTHING`,
          crypto.randomUUID(), insertSujetIds[i], link.titre, link.url, link.source, link.sourceLabel, link.ordre,
        );
      }

      // Marque comme résolus les seuls sujets dont les sources ont répondu
      // (même sans lien trouvé). Les autres seront retentés au prochain sync.
      const resolvedSujets = sujets.filter(s => okIds.has(s.id));
      if (resolvedSujets.length > 0) {
        const ids = resolvedSujets.map(s => s.id);
        const hashes = resolvedSujets.map(s => contextHash(s.label, s.status));
        await prisma.$executeRawUnsafe(
          `UPDATE sujets s SET context_resolved_at = NOW(), context_input_hash = d.h
           FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS h) d
           WHERE s.id = d.id`,
          ids, hashes,
        );
      }
    }

    const result: GenerateSujetContextResult = {
      sujetsProcessed: sujets.length,
      resolved: desired.size,
      created: inserts.length,
      deleted: deleteIds.length,
      viePublique: countViePublique,
      wikipedia: countWikipedia,
    };
    logger.info(result, 'Sujet context links generation completed');
    return result;
  } finally {
    await prisma.$disconnect();
  }
}
