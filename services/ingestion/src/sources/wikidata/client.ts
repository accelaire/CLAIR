// =============================================================================
// Client Wikidata — Faits structurés & sourcés sur les parlementaires
//
// Pourquoi Wikidata plutôt qu'une recherche web ouverte (Tavily) : les données
// sont STRUCTURÉES (fonctions, parti, dates), FRAÎCHES (communauté), GRATUITES,
// sans quota, et surtout TRAÇABLES — chaque fait pointe vers une entité citable
// (wikidata.org/wiki/Q…). C'est aligné avec le mandat de transparence : on ne
// résume plus du bruit web non vérifiable, on synthétise des faits sourcés.
//
// Garde-fou fraîcheur : nos données ingérées (quotidiennes) restent la vérité sur
// le mandat EN COURS et le groupe. Wikidata sert au contexte biographique/historique.
//
// Aucune clé API. API stable wbsearchentities + wbgetentities (pas de SPARQL, dont
// l'endpoint public est régulièrement throttlé/indisponible).
// =============================================================================

import { logger } from '../../utils/logger.js';
import { errorMessage } from '../../utils/errors.js';

const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = 'CLAIRBot/1.0 (transparence parlementaire; contact@clair.fr)';

// Entités Wikidata de référence pour la désambiguïsation.
const Q_HUMAN = 'Q5';

/** Un fait structuré prêt pour le prompt, avec sa période si connue. */
export interface WikidataFait {
  label: string;
  debut?: string; // année ISO
  fin?: string;
}

export interface WikidataResult {
  qid: string;
  label: string;
  description?: string;
  /** Naissance (année) si connue. */
  naissance?: string;
  /** Partis politiques (P102) avec période. */
  partis: WikidataFait[];
  /** Fonctions occupées (P39) avec période. */
  fonctions: WikidataFait[];
  /** URL de provenance citable. */
  pageUrl: string;
  found: true;
}

interface WbSearchEntity {
  id: string;
  label?: string;
  description?: string;
}

interface WbClaimValue {
  mainsnak?: {
    datavalue?: { value?: { id?: string; time?: string } | string };
  };
  qualifiers?: Record<string, Array<{ datavalue?: { value?: { time?: string } } }>>;
}

interface WbEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, WbClaimValue[]>;
}

async function wikidataGet<T>(params: Record<string, string>): Promise<T | null> {
  const search = new URLSearchParams({ ...params, format: 'json', origin: '*' });
  const res = await fetch(`${WIKIDATA_API_URL}?${search}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Année (YYYY) extraite d'un timestamp Wikidata (+2022-06-22T00:00:00Z). */
function annee(time?: string): string | undefined {
  if (!time) return undefined;
  const m = /^[+-]?(\d{4})/.exec(time);
  return m ? m[1] : undefined;
}

/**
 * Récupère les faits structurés Wikidata pour un parlementaire.
 * Retourne null si aucune entité fiable (humain + description politique) n'est trouvée.
 */
export async function fetchWikidataFacts(
  prenom: string,
  nom: string,
): Promise<WikidataResult | null> {
  try {
    // 1) Recherche des entités candidates.
    const search = await wikidataGet<{ search?: WbSearchEntity[] }>({
      action: 'wbsearchentities',
      search: `${prenom} ${nom}`,
      language: 'fr',
      uselang: 'fr',
      type: 'item',
      limit: '5',
    });
    const candidates = search?.search ?? [];
    if (candidates.length === 0) return null;

    // 2) Charge claims + descriptions des candidats en UN appel.
    const ids = candidates.map((c) => c.id).join('|');
    const entities = await wikidataGet<{ entities?: Record<string, WbEntity> }>({
      action: 'wbgetentities',
      ids,
      props: 'labels|descriptions|claims',
      languages: 'fr|en',
    });
    if (!entities?.entities) return null;

    // 3) Désambiguïsation : humain (P31=Q5) ET description à connotation politique.
    const chosen = candidates
      .map((c) => entities.entities![c.id])
      .find((e) => e && isHumanPolitician(e));
    if (!chosen) {
      logger.debug({ prenom, nom, candidats: candidates.map((c) => c.id) },
        'Wikidata : aucun candidat humain/politique fiable');
      return null;
    }

    // 4) Extraction des faits + résolution des labels des QID référencés.
    const partiClaims = valueClaims(chosen, 'P102'); // membre de parti politique
    const fonctionClaims = valueClaims(chosen, 'P39'); // fonction occupée
    const refIds = [...new Set([...partiClaims, ...fonctionClaims].map((c) => c.id))];
    const labels = await resolveLabels(refIds);

    const naissance = annee(timeClaim(chosen, 'P569'));

    return {
      qid: chosen.id,
      label: chosen.labels?.fr?.value ?? chosen.labels?.en?.value ?? `${prenom} ${nom}`,
      description: chosen.descriptions?.fr?.value ?? chosen.descriptions?.en?.value,
      naissance,
      partis: partiClaims.map((c) => ({ label: labels[c.id] ?? c.id, debut: c.debut, fin: c.fin })),
      fonctions: fonctionClaims.map((c) => ({ label: labels[c.id] ?? c.id, debut: c.debut, fin: c.fin })),
      pageUrl: `https://www.wikidata.org/wiki/${chosen.id}`,
      found: true,
    };
  } catch (error) {
    logger.debug({ prenom, nom, error: errorMessage(error) }, 'Wikidata fetch failed');
    return null;
  }
}

/** Vrai si l'entité est un humain (P31=Q5) avec une description à connotation politique. */
function isHumanPolitician(e: WbEntity): boolean {
  const p31 = (e.claims?.P31 ?? []).some(
    (c) => (c.mainsnak?.datavalue?.value as { id?: string })?.id === Q_HUMAN,
  );
  if (!p31) return false;
  const desc = `${e.descriptions?.fr?.value ?? ''} ${e.descriptions?.en?.value ?? ''}`.toLowerCase();
  return /politiqu|politician|député|deputy|sénat|senator|ministre|minister|élu/.test(desc);
}

/** Extrait les QID-valeurs d'une propriété + leurs qualificateurs de période (P580/P582). */
function valueClaims(e: WbEntity, prop: string): Array<{ id: string; debut?: string; fin?: string }> {
  const out: Array<{ id: string; debut?: string; fin?: string }> = [];
  for (const c of e.claims?.[prop] ?? []) {
    const id = (c.mainsnak?.datavalue?.value as { id?: string })?.id;
    if (!id) continue;
    out.push({
      id,
      debut: annee(c.qualifiers?.P580?.[0]?.datavalue?.value?.time),
      fin: annee(c.qualifiers?.P582?.[0]?.datavalue?.value?.time),
    });
  }
  return out;
}

/** Première valeur temporelle d'une propriété (ex. P569 date de naissance). */
function timeClaim(e: WbEntity, prop: string): string | undefined {
  const v = (e.claims?.[prop] ?? [])[0]?.mainsnak?.datavalue?.value;
  return typeof v === 'object' ? v?.time : undefined;
}

/** Résout un lot de QID en labels FR (un seul appel wbgetentities). */
async function resolveLabels(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const data = await wikidataGet<{ entities?: Record<string, WbEntity> }>({
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'labels',
    languages: 'fr|en',
  });
  const out: Record<string, string> = {};
  for (const [id, e] of Object.entries(data?.entities ?? {})) {
    const label = e.labels?.fr?.value ?? e.labels?.en?.value;
    if (label) out[id] = label;
  }
  return out;
}
