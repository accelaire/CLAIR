// =============================================================================
// Client Wikipedia FR — Récupère les bios des parlementaires via l'API publique
// Aucune clé API requise. Rate-limit friendly (1 req/parlementaire).
// =============================================================================

import { logger } from '../../utils/logger.js';

const WIKIPEDIA_API_URL = 'https://fr.wikipedia.org/w/api.php';
const MAX_EXTRACT_CHARS = 4000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface WikipediaResult {
  title: string;
  extract: string;
  pageUrl: string;
  found: boolean;
}

/**
 * Recherche et extrait le contenu Wikipedia FR pour un parlementaire.
 * Utilise l'API opensearch + extracts pour obtenir le texte brut.
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
    try {
      const result = await searchAndExtract(query, prenom, nom);
      if (result) return result;
    } catch (error: any) {
      logger.debug({ query, error: error.message }, 'Wikipedia search failed for query');
    }
  }

  return null;
}

async function searchAndExtract(
  query: string,
  prenom: string,
  nom: string,
): Promise<WikipediaResult | null> {
  // Étape 1 : Recherche via opensearch
  const searchParams = new URLSearchParams({
    action: 'opensearch',
    search: query,
    limit: '5',
    namespace: '0',
    format: 'json',
  });

  const searchRes = await fetch(`${WIKIPEDIA_API_URL}?${searchParams}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'User-Agent': 'CLAIRBot/1.0 (transparence parlementaire; contact@clair.fr)' },
  });

  if (!searchRes.ok) return null;

  const [, titles] = await searchRes.json() as [string, string[]];
  if (!titles || titles.length === 0) return null;

  // Filtrer les résultats : le titre doit contenir le nom de famille
  const nomLower = nom.toLowerCase();
  const matchingTitle = titles.find(t => t.toLowerCase().includes(nomLower));
  if (!matchingTitle) return null;

  // Étape 2 : Extraire le contenu de la page
  const extractParams = new URLSearchParams({
    action: 'query',
    titles: matchingTitle,
    prop: 'extracts',
    exintro: '0',           // Article complet, pas juste l'intro
    explaintext: '1',       // Texte brut (pas HTML)
    exchars: String(MAX_EXTRACT_CHARS),
    format: 'json',
  });

  const extractRes = await fetch(`${WIKIPEDIA_API_URL}?${extractParams}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'User-Agent': 'CLAIRBot/1.0 (transparence parlementaire; contact@clair.fr)' },
  });

  if (!extractRes.ok) return null;

  const data = await extractRes.json() as {
    query: { pages: Record<string, { title: string; extract?: string; missing?: boolean }> };
  };

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
