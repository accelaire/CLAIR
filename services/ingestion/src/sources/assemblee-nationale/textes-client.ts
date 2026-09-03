// =============================================================================
// Client AN — Texte des articles d'un texte législatif
// Source: https://www.assemblee-nationale.fr/dyn/opendata/{texteRef}.html
// =============================================================================
//
// POURQUOI CETTE SOURCE
//
// Jusqu'ici le contenu des articles n'était nulle part : on stockait les
// amendements (dispositif + exposé sommaire) mais jamais le texte qu'ils
// modifient. Conséquence, un scrutin « l'article 15 de la PPL … » n'avait pour
// toute matière que son propre titre — d'où des résumés IA inventés de bout en
// bout (retour utilisateur sur le scrutin 2076 : le résumé décrivait les
// critères d'accès à l'aide à mourir alors que l'article 15 crée la commission
// de contrôle et d'évaluation).
//
// L'AN expose chaque texte en HTML sous une URL indexée par le `texteRef` que
// l'on stocke DÉJÀ sur les amendements (`amendements.texte_ref`), sans aucune
// transformation à faire : PIONANR5L17BTC1364 → /dyn/opendata/PIONANR5L17BTC1364.html
// Vérifié sur les trois familles de textes AN : proposition de loi (PION…),
// projet de loi (PRJL…) et proposition de résolution européenne (PNRE…).
//
// Le Sénat n'est PAS couvert : ses `texteRef` suivent un autre schéma
// (`SENAT-TXT-105426`) et cette URL répond 500. Source dédiée à prévoir.
//
// STRUCTURE DU HTML
//
// Chaque article est introduit par `<p class="assnat9ArticleNum">Article 15</p>`
// suivi des paragraphes `<p class="assnatLoiTexte">`. Trois pièges :
//   - la feuille de style en tête déclare `.assnat9ArticleNum0 { … }` : il faut
//     ignorer le `<style>` sinon on compte des articles fantômes ;
//   - le libellé est sur plusieurs lignes (`>\n\t\tArticle 15\n\t</p>`), donc
//     tout parsing ligne à ligne le rate ;
//   - le corps embarque des images base64 (`<img src="data:image/png;…">`) de
//     plusieurs Ko qu'il faut retirer avant de stocker quoi que ce soit.
//
// Le texte est extrait paragraphe par paragraphe : concaténer le contenu d'un
// bloc d'un seul tenant coupe les mots, les références légales étant enrobées
// de `<span>` (« L. 1111‑12‑13 » ressort « L. 1111 ‑ 12 ‑ 13 »).
// =============================================================================

import * as https from 'https';
// `cheerio/slim` et non `cheerio` : l'entrée par défaut tire `undici` pour son
// helper `fromURL`, qui exige Node >= 20 et casse les tests en Node 18. On ne
// parse que des chaînes, ce helper ne sert à rien ici.
import * as cheerio from 'cheerio/slim';
import { logger } from '../../utils/logger';

const BASE_URL = 'https://www.assemblee-nationale.fr/dyn/opendata';

export interface TexteArticle {
  /** Clé normalisée, alignée sur `amendements.article_vise` : "PREMIER", "15", "UNIQUE", "4 BIS". */
  numero: string;
  /** Libellé tel qu'il apparaît dans le texte : "Article 1er", "Article 1er A (nouveau)". */
  libelle: string;
  /** Rang dans le texte, à partir de 1. */
  ordre: number;
  contenu: string;
}

function httpsGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout: 30_000,
        headers: {
          'User-Agent': 'CLAIR-bot (transparence-politique, contact@clair.vote)',
          Accept: 'text/html',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') })
        );
        res.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.on('error', reject);
  });
}

/** Normalise un fragment de texte : espaces compactés, lignes vides supprimées. */
function normalizeLine(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ');
}

/**
 * Clé de rapprochement entre un libellé d'article et `amendements.article_vise`.
 *
 * L'AN écrit « Article 1er » dans le texte mais « ART. PREMIER » sur les
 * amendements : sans cette normalisation, l'article le plus amendé de chaque
 * texte ne se rattacherait à rien.
 */
export function articleKeyFromLibelle(libelle: string): string | null {
  const withoutPrefix = libelle.replace(/^\s*article\s+/i, '').trim();
  if (!withoutPrefix) return null;
  const withoutParenthetical = withoutPrefix.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const upper = withoutParenthetical.toUpperCase();
  return upper.replace(/^1ER\b/, 'PREMIER').replace(/\s+/g, ' ') || null;
}

/** Même clé, depuis un `article_vise` d'amendement ("ART. 15", "APRÈS ART. 15"). */
export function articleKeyFromArticleVise(articleVise: string): { key: string; apres: boolean } | null {
  const trimmed = articleVise.trim().toUpperCase();
  const apres = /^APR[ÈE]S\s+/.test(trimmed);
  const withoutApres = trimmed.replace(/^APR[ÈE]S\s+/, '');
  const match = withoutApres.match(/^ART\.?\s+(.+)$/);
  if (!match) return null;
  const key = match[1]!.replace(/\s+/g, ' ').trim();
  return key ? { key, apres } : null;
}

/**
 * Marqueur de début d'article. Le suffixe est libre (`assnat9ArticleNum0`) et
 * d'autres attributs peuvent suivre la classe, d'où le préfixe plutôt qu'une
 * égalité stricte.
 */
const MARKER_SELECTOR = 'p[class^="assnat9ArticleNum"]';

/**
 * Extrait les articles d'une page texte de l'AN.
 *
 * Le document est plat : les paragraphes sont frères, un article court donc du
 * marqueur `p.assnat9ArticleNum` jusqu'au marqueur suivant.
 */
export function parseArticles(html: string): TexteArticle[] {
  const $ = cheerio.load(html);
  // La feuille de style déclare `.assnat9ArticleNum` : si on la laissait, son
  // texte serait lu comme un libellé d'article.
  $('style, script, img').remove();

  const articles: TexteArticle[] = [];
  const seen = new Set<string>();

  $(MARKER_SELECTOR).each((_, el) => {
    const libelle = normalizeLine($(el).text());
    const numero = articleKeyFromLibelle(libelle);
    if (!numero) return;
    // Un même numéro peut réapparaître (texte annexé, tableau comparatif) : on
    // garde la première occurrence, celle du dispositif.
    if (seen.has(numero)) return;
    seen.add(numero);

    const lines: string[] = [];
    for (const sibling of $(el).nextAll().toArray()) {
      if ($(sibling).is(MARKER_SELECTOR)) break;
      const line = normalizeLine($(sibling).text());
      if (line) lines.push(line);
    }
    const contenu = lines.join('\n');
    if (!contenu) return;

    articles.push({ numero, libelle, ordre: articles.length + 1, contenu });
  });

  return articles;
}

export function texteUrl(texteRef: string): string {
  return `${BASE_URL}/${texteRef}.html`;
}

/**
 * Récupère les articles d'un texte AN. Retourne `null` si le texte n'est pas
 * exposé (404/500) — c'est le cas de tous les `texteRef` du Sénat.
 */
export async function fetchTexteArticles(
  texteRef: string
): Promise<{ articles: TexteArticle[]; sourceUrl: string } | null> {
  const url = texteUrl(texteRef);
  try {
    const { status, body } = await httpsGet(url);
    if (status !== 200) {
      logger.debug({ texteRef, status }, 'Texte AN indisponible');
      return null;
    }
    const articles = parseArticles(body);
    if (articles.length === 0) {
      logger.debug({ texteRef }, 'Aucun article extrait du texte AN');
      return null;
    }
    return { articles, sourceUrl: url };
  } catch (error) {
    logger.warn({ texteRef, error: (error as Error).message }, 'Échec de récupération du texte AN');
    return null;
  }
}
