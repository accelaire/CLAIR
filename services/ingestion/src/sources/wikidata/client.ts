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
import { getWikimedia, WikimediaIndisponible } from '../wikimedia-http.js';

const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
/** Nouvelles tentatives des lectures d'une fiche après un 429, un 5xx ou une coupure */
const REPRISES_FICHE = 3;
/** `wbgetentities` refuse plus de 50 identifiants par appel */
const IDS_PAR_APPEL = 50;

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

/**
 * Appel à l'API de Wikidata ; `null` si la réponse n'est pas un succès.
 *
 * `reprises` : nombre de nouvelles tentatives après un 429 ou un 5xx, en
 * respectant `Retry-After` (Wikidata freine une rafale de requêtes par un 429
 * de quelques secondes). Zéro par défaut, le comportement d'origine.
 */
export async function wikidataGet<T>(
  params: Record<string, string>,
  options: { reprises?: number } = {},
): Promise<T | null> {
  const r = await getWikimedia<T>(WIKIDATA_API_URL, { ...params, origin: '*' }, options);
  return r.ok ? r.json : null;
}

/**
 * Lecture pour une fiche : lève `WikimediaIndisponible` si Wikidata ne répond
 * pas, après les reprises, ou répond par une erreur de l'API (rendue en HTTP 200).
 */
async function lireWikidata<T>(params: Record<string, string>): Promise<T> {
  const r = await getWikimedia<T & { error?: { code?: string } }>(
    WIKIDATA_API_URL,
    { ...params, origin: '*' },
    { reprises: REPRISES_FICHE },
  );
  if (!r.ok) throw new WikimediaIndisponible(`Wikidata indisponible (${params.action}, ${r.raison})`);
  if (r.json.error) {
    throw new WikimediaIndisponible(`Wikidata : erreur ${r.json.error.code ?? 'inconnue'} (${params.action})`);
  }
  return r.json;
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
 * Lève `WikimediaIndisponible` si Wikidata ne répond pas : l'appelant ne doit
 * pas prendre une panne pour une absence, sinon la fiche s'écrit sans ses faits.
 */
export async function fetchWikidataFacts(
  prenom: string,
  nom: string,
): Promise<WikidataResult | null> {
  // 1) Recherche des entités candidates.
  const search = await lireWikidata<{ search?: WbSearchEntity[] }>({
    action: 'wbsearchentities',
    search: `${prenom} ${nom}`,
    language: 'fr',
    uselang: 'fr',
    type: 'item',
    limit: '5',
  });
  const candidates = search.search ?? [];
  if (candidates.length === 0) return null;

  // 2) Charge claims + descriptions des candidats en UN appel.
  const ids = candidates.map((c) => c.id).join('|');
  const { entities = {} } = await lireWikidata<{ entities?: Record<string, WbEntity> }>({
    action: 'wbgetentities',
    ids,
    props: 'labels|descriptions|claims',
    languages: 'fr|en',
  });

  // 3) Désambiguïsation : humain (P31=Q5) ET description à connotation politique.
  const chosen = candidates
    .map((c) => entities[c.id])
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
  // Un fait sans libellé français ni anglais n'est pas transmis : un QID brut
  // dans le prompt finirait tel quel dans la fiche.
  const faits = (claims: typeof partiClaims): WikidataFait[] =>
    claims.flatMap((c) => (labels[c.id] ? [{ label: labels[c.id]!, debut: c.debut, fin: c.fin }] : []));

  return {
    qid: chosen.id,
    label: chosen.labels?.fr?.value ?? chosen.labels?.en?.value ?? `${prenom} ${nom}`,
    description: chosen.descriptions?.fr?.value ?? chosen.descriptions?.en?.value,
    naissance: annee(timeClaim(chosen, 'P569')),
    partis: faits(partiClaims),
    fonctions: faits(fonctionClaims),
    pageUrl: `https://www.wikidata.org/wiki/${chosen.id}`,
    found: true,
  };
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

/** Résout des QID en libellés français (anglais à défaut), 50 par appel. */
async function resolveLabels(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += IDS_PAR_APPEL) {
    const { entities = {} } = await lireWikidata<{ entities?: Record<string, WbEntity> }>({
      action: 'wbgetentities',
      ids: ids.slice(i, i + IDS_PAR_APPEL).join('|'),
      props: 'labels',
      languages: 'fr|en',
    });
    for (const [id, e] of Object.entries(entities)) {
      const label = e.labels?.fr?.value ?? e.labels?.en?.value;
      if (label) out[id] = label;
    }
  }
  return out;
}
