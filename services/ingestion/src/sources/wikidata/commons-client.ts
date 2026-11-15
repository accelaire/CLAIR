// =============================================================================
// Client Wikimedia Commons — vignette et crédit d'une image
//
// L'image principale d'une personne sur Wikidata (P18) est un nom de fichier de
// Commons. L'API de Commons donne, pour une liste de fichiers, l'adresse d'une
// vignette et les métadonnées de licence (`extmetadata`) : auteur, licence,
// adresse de la licence. Aucune clé, 50 fichiers par requête.
// =============================================================================

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = 'CLAIR/1.0 (+https://clair.vote)';
const PAR_REQUETE = 50;

/** Largeur des vignettes : le plus grand portrait du site fait 192 px, 384 en écran dense. */
export const LARGEUR_VIGNETTE = 500;

export interface ImageCommons {
  /** Nom du fichier tel que Wikidata le donne (« Michèle Alliot-Marie.JPG ») */
  fichier: string;
  /** Vignette, sans les paramètres de suivi ajoutés par l'API */
  vignette: string;
  /** Page du fichier sur Commons */
  page: string;
  auteur: string | null;
  licence: string | null;
  licenceUrl: string | null;
}

/**
 * Résultat par fichier : l'image, `null` si Commons ne connaît pas le fichier.
 * Un fichier absent du résultat n'a pas pu être lu (réponse incomplète).
 */
export type ImagesCommons = Map<string, ImageCommons | null>;

interface PageCommons {
  title: string;
  missing?: boolean;
  imageinfo?: Array<{
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

interface ReponseCommons {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    pages?: PageCommons[];
  };
}

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Texte d'un champ HTML de Commons : balises retirées, entités décodées, espaces resserrés. */
export function texteDepuisHtml(html: string | undefined | null): string | null {
  if (!html) return null;
  const texte = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, nom: string) => ENTITES[nom.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
  return texte.length > 0 ? texte.slice(0, 300) : null;
}

/** Adresse sans paramètres de requête (`?utm_source=…`). */
function sansRequete(url: string): string {
  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}

/** Lit l'image d'une page de l'API, `null` si elle n'est pas exploitable. */
export function imageDepuisPage(fichier: string, page: PageCommons): ImageCommons | null {
  if (page.missing) return null;
  const info = page.imageinfo?.[0];
  if (!info?.thumburl || !info.descriptionurl || !(info.mime ?? '').startsWith('image/')) return null;
  const meta = info.extmetadata ?? {};
  return {
    fichier,
    vignette: sansRequete(info.thumburl),
    page: info.descriptionurl,
    // `Attribution` est le crédit demandé par l'auteur, quand il le précise ;
    // `Artist` contient parfois toutes ses consignes de réutilisation.
    auteur: texteDepuisHtml(meta.Attribution?.value) ?? texteDepuisHtml(meta.Artist?.value),
    licence: texteDepuisHtml(meta.LicenseShortName?.value),
    licenceUrl: meta.LicenseUrl?.value ? meta.LicenseUrl.value.replace(/^\/\//, 'https://') : null,
  };
}

/** Nouvelles tentatives après un 429 ou un 5xx, en respectant `Retry-After` */
const REPRISES = 3;
const ATTENTE_MAX_MS = 30_000;

async function appelerCommons(params: URLSearchParams): Promise<ReponseCommons> {
  for (let tentative = 0; ; tentative++) {
    const res = await fetch(`${COMMONS_API_URL}?${params}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.ok) return (await res.json()) as ReponseCommons;
    if (!(res.status === 429 || res.status >= 500) || tentative >= REPRISES) {
      throw new Error(`Commons : HTTP ${res.status}`);
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    const attente = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** tentative;
    await new Promise((r) => setTimeout(r, Math.min(attente, ATTENTE_MAX_MS)));
  }
}

/**
 * Vignettes et crédits d'une liste de fichiers de Commons. Lève une erreur si
 * une requête échoue : l'appelant ne doit rien effacer sur une lecture ratée.
 */
export async function lireImagesCommons(fichiers: readonly string[]): Promise<ImagesCommons> {
  const resultat: ImagesCommons = new Map();
  const uniques = [...new Set(fichiers)];
  for (let i = 0; i < uniques.length; i += PAR_REQUETE) {
    const lot = uniques.slice(i, i + PAR_REQUETE);
    const params = new URLSearchParams({
      action: 'query',
      titles: lot.map((f) => `File:${f}`).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime',
      iiurlwidth: String(LARGEUR_VIGNETTE),
      iiextmetadatafilter: 'Artist|Attribution|LicenseShortName|LicenseUrl',
      format: 'json',
      formatversion: '2',
    });
    const json = await appelerCommons(params);

    // L'API normalise les titres (« File:A_b.jpg » → « File:A b.jpg ») : on
    // retrouve le fichier demandé à partir du titre rendu.
    const titreRendu = new Map<string, string>();
    for (const f of lot) titreRendu.set(`File:${f}`, f);
    for (const n of json.query?.normalized ?? []) {
      const f = titreRendu.get(n.from);
      if (f !== undefined) titreRendu.set(n.to, f);
    }
    for (const page of json.query?.pages ?? []) {
      const f = titreRendu.get(page.title);
      if (f !== undefined) resultat.set(f, imageDepuisPage(f, page));
    }
  }
  return resultat;
}
