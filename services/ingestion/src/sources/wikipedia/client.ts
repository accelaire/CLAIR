// =============================================================================
// Client Wikipedia FR — Récupère les bios des parlementaires via l'API publique
// Aucune clé API requise. Rate-limit friendly (1 req/parlementaire).
// =============================================================================

import { logger } from '../../utils/logger.js';
import { getWikimedia, WikimediaIndisponible } from '../wikimedia-http.js';

const WIKIPEDIA_API_URL = 'https://fr.wikipedia.org/w/api.php';
const MAX_EXTRACT_CHARS = 4000;
/** Nouvelles tentatives après un 429, un 5xx ou une coupure réseau */
const REPRISES = 3;

/** Lecture de l'API ; lève `WikimediaIndisponible` si Wikipédia ne répond pas. */
async function lireWikipedia<T>(params: Record<string, string>): Promise<T> {
  const r = await getWikimedia<T>(WIKIPEDIA_API_URL, params, { reprises: REPRISES });
  if (!r.ok) throw new WikimediaIndisponible(`Wikipédia indisponible (${params.action}, ${r.raison})`);
  // Une erreur de l'API arrive en HTTP 200, dans un objet `error`.
  const erreur = (r.json as { error?: { code?: string } } | null)?.error;
  if (erreur) throw new WikimediaIndisponible(`Wikipédia : erreur ${erreur.code ?? 'inconnue'} (${params.action})`);
  return r.json;
}

export interface WikipediaResult {
  title: string;
  extract: string;
  pageUrl: string;
  found: boolean;
}

/**
 * Recherche et extrait le contenu Wikipedia FR pour un parlementaire.
 * Utilise l'API opensearch + extracts pour obtenir le texte brut.
 * Lève `WikimediaIndisponible` si Wikipédia ne répond pas : une panne n'est
 * pas une absence d'article.
 */
export async function fetchWikipediaBio(
  prenom: string,
  nom: string,
  options?: { role?: string }
): Promise<WikipediaResult | null> {
  const role = options?.role ?? 'homme politique';

  // Stratégie de recherche : nom complet d'abord, puis avec contexte politique
  const queries = [
    `${prenom} ${nom}`,
    `${prenom} ${nom} ${role}`,
  ];

  for (const query of queries) {
    const result = await searchAndExtract(query, nom);
    if (result) return result;
  }

  return null;
}

async function searchAndExtract(
  query: string,
  nom: string,
): Promise<WikipediaResult | null> {
  // Étape 1 : Recherche via opensearch
  const [, titles] = await lireWikipedia<[string, string[]]>({
    action: 'opensearch',
    search: query,
    limit: '5',
    namespace: '0',
  });
  if (!titles || titles.length === 0) return null;

  // Filtrer les résultats : le titre doit contenir le nom de famille
  const nomLower = nom.toLowerCase();
  const matchingTitle = titles.find(t => t.toLowerCase().includes(nomLower));
  if (!matchingTitle) return null;

  // Étape 2 : Extraire le contenu de la page
  const data = await lireWikipedia<{
    query?: { pages?: Record<string, { title: string; extract?: string; missing?: boolean }> };
  }>({
    action: 'query',
    titles: matchingTitle,
    prop: 'extracts',
    exintro: '0',           // Article complet, pas juste l'intro
    explaintext: '1',       // Texte brut (pas HTML)
    exchars: String(MAX_EXTRACT_CHARS),
  });

  const pages = data.query?.pages;
  if (!pages) return null;

  const page = Object.values(pages)[0];
  if (!page || page.missing || !page.extract) return null;

  // Vérifier que l'article parle bien d'un politique (heuristique simple)
  const extractLower = page.extract.toLowerCase();
  const politicalTerms = [
    'député', 'sénateur', 'sénatrice', 'politique', 'parlementaire',
    'assemblée nationale', 'sénat', 'ministre', 'élu', 'élue',
    'législature', 'parti', 'groupe politique', 'mandat',
  ];
  const isPolitical = politicalTerms.some(term => extractLower.includes(term));

  if (!isPolitical) {
    logger.debug({ title: page.title }, 'Wikipedia article found but not political, skipping');
    return null;
  }

  const encodedTitle = encodeURIComponent(page.title.replace(/ /g, '_'));

  return {
    title: page.title,
    extract: page.extract,
    pageUrl: `https://fr.wikipedia.org/wiki/${encodedTitle}`,
    found: true,
  };
}
