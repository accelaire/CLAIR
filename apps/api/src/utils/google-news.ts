// =============================================================================
// Google Actualités — récupération live d'articles de presse pour un Sujet
// Liens-only (titre + média + date + URL) → droit voisin respecté.
// La sélection vient de l'agrégateur Google Actualités, affichée comme telle.
// =============================================================================

export interface PressArticle {
  titre: string;
  media: string | null;
  url: string;
  date: string | null; // ISO 8601
}

const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};

/** Décode les entités HTML/XML courantes présentes dans les flux RSS. */
function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => NAMED_ENTITIES[m] ?? m)
    .trim();
}

/** Retire un éventuel wrapper CDATA et les balises HTML résiduelles. */
function stripMarkup(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extractTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m?.[1] ?? null;
}

/** Construit l'URL du flux RSS Google Actualités pour une requête donnée (FR). */
export function buildGoogleNewsUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=fr&gl=FR&ceid=FR:fr`;
}

/** Parse un flux RSS Google Actualités en liste d'articles (max `limit`). */
export function parseGoogleNewsRss(xml: string, limit = 12): PressArticle[] {
  const articles: PressArticle[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null && articles.length < limit) {
    const block = match[1] ?? '';

    const rawTitle = extractTag(block, 'title');
    const rawLink = extractTag(block, 'link');
    if (!rawTitle || !rawLink) continue;

    const url = decodeEntities(stripMarkup(rawLink));
    if (!url.startsWith('http')) continue;

    const media = (() => {
      const s = extractTag(block, 'source');
      return s ? decodeEntities(stripMarkup(s)) || null : null;
    })();

    let titre = decodeEntities(stripMarkup(rawTitle));
    // Google suffixe le titre par " - <Média>" : on l'enlève pour l'affichage.
    if (media && titre.endsWith(` - ${media}`)) {
      titre = titre.slice(0, -(media.length + 3)).trim();
    }
    if (!titre) continue;

    const date = (() => {
      const raw = extractTag(block, 'pubDate');
      if (!raw) return null;
      const d = new Date(decodeEntities(stripMarkup(raw)));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    })();

    articles.push({ titre, media, url, date });
  }

  return articles;
}

/**
 * Récupère les articles de presse Google Actualités pour une requête.
 * Renvoie [] en cas d'erreur réseau/parse (échec silencieux, non bloquant).
 */
export async function fetchGoogleNews(
  query: string,
  opts: { limit?: number; timeoutMs?: number } = {},
): Promise<PressArticle[]> {
  const { limit = 12, timeoutMs = 6000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(buildGoogleNewsUrl(query), {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CLAIR/1.0; +https://clair.vote)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseGoogleNewsRss(xml, limit);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
