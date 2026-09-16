// =============================================================================
// Client Sénat - Scraping des vidéos de séances publiques
// Source: https://videos.senat.fr/senat_videos_search.php
// =============================================================================
//
// videos.senat.fr expose un endpoint HTML non documenté utilisé par son moteur
// de recherche interne. Chaque page retourne ~9 entrées de type "card".
// Les slugs de vidéos contiennent la date et le moment (matin/après-midi/soir).
//
// URL finale: https://videos.senat.fr/video.{id}_{hash}.{slug}
// =============================================================================

import * as https from 'https';
import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';

const BASE_URL = 'https://videos.senat.fr';
const SEARCH_ENDPOINT = `${BASE_URL}/senat_videos_search.php`;
const REQUEST_DELAY_MS = 600;
const MAX_PAGES = 80;

const MONTHS_FR: Record<string, string> = {
  janvier: '01', fevrier: '02', mars: '03', avril: '04',
  mai: '05', juin: '06', juillet: '07', aout: '08',
  septembre: '09', octobre: '10', novembre: '11', decembre: '12',
};

export type VideoMoment = 'matin' | 'apres-midi' | 'soir';

/**
 * Le type de vidéo, tel que le moteur du Sénat le nomme.
 *
 * Mesuré sur un an : « Séance publique » rend 512 vidéos, « Travaux de
 * commission » 384, pour 917 au catalogue. Une valeur que le moteur ne connaît
 * pas ne filtre RIEN et rend les 917 — d'où l'intérêt de vérifier le compte
 * plutôt que de faire confiance au paramètre.
 */
const TYPE_SEANCE = 'Séance publique';
const TYPE_COMMISSION = 'Travaux de commission';

export interface SenatVideo {
  isoDate: string;      // 'YYYY-MM-DD'
  moment: VideoMoment;  // 'matin' | 'apres-midi' | 'soir'
  url: string;          // URL complète sans timecode
  slug: string;         // e.g. 'seance-publique-du-16-avril-2026-apres-midi'
}

/** Une vidéo de réunion de commission, telle que la fiche du moteur la décrit. */
export interface SenatVideoCommission {
  /** 'YYYY-MM-DD', lu sur la fiche — le slug d'une commission ne porte pas de date. */
  isoDate: string;
  /** Le nom de la commission, tel qu'il est imprimé : il correspond au nôtre. */
  commission: string;
  /** « Violences dans le périscolaire : audition d'Emmanuel Grégoire ». */
  titre: string;
  url: string;
  slug: string;
}

/** Les mois, sans accent : la fiche écrit « février », le slug « fevrier ». */
function moisEnNombre(mois: string): string | null {
  const nu = mois
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
  return MONTHS_FR[nu] ?? null;
}

/**
 * La date d'une fiche : « Mercredi 16 septembre 2026 » → '2026-09-16'.
 *
 * Contrairement à la séance publique, dont le slug porte la date et le moment,
 * une vidéo de commission n'a qu'un titre : « violences-dans-le-periscolaire--
 * audition-d-emmanuel-gregoire ». La date ne se lit que sur la fiche.
 */
export function dateDeLaFiche(texte: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/u.exec(texte);
  if (!m) return null;
  const mois = moisEnNombre(m[2]!);
  if (!mois) return null;
  return `${m[3]}-${mois}-${String(m[1]).padStart(2, '0')}`;
}

/** Retire les balises et rend les entités d'un fragment de fiche. */
function texteNu(html: string): string {
  return html
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&#39;|&apos;/gu, '’')
    .replace(/&quot;/gu, '"')
    .replace(/&amp;/gu, '&')
    .replace(/&nbsp;/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Les fiches de commission d'une page de résultats.
 *
 * On lit la fiche entière plutôt que le seul lien : c'est elle qui porte le nom
 * de la commission et la date, les deux seules prises pour rapprocher la vidéo
 * d'une réunion. Une fiche à laquelle il manque l'un ou l'autre est ignorée —
 * rapprocher sur la seule date attribuerait la vidéo d'une commission à une
 * autre réunie le même jour.
 */
export function fichesDeCommission(html: string): SenatVideoCommission[] {
  const fiches: SenatVideoCommission[] = [];
  const vus = new Set<string>();

  for (const bloc of html.split(/<div class="card card-/u).slice(1)) {
    const lien = /href="video\.([^".?]+)\.([^".?]+)/u.exec(bloc);
    if (!lien) continue;
    const idHash = lien[1]!;
    const slug = lien[2]!;
    if (slug.startsWith('seance-publique-du-')) continue;
    if (vus.has(idHash)) continue;

    const commission = texteNu(/<p class="card-subtitle">([\s\S]*?)<\/p>/u.exec(bloc)?.[1] ?? '');
    const isoDate = dateDeLaFiche(texteNu(/<time class="card-time">([\s\S]*?)<\/time>/u.exec(bloc)?.[1] ?? ''));
    if (commission.length === 0 || !isoDate) continue;

    vus.add(idHash);
    fiches.push({
      isoDate,
      commission,
      titre: texteNu(/<h3 class="card-title">([\s\S]*?)<\/h3>/u.exec(bloc)?.[1] ?? ''),
      url: `${BASE_URL}/video.${idHash}.${slug}`,
      slug,
    });
  }

  return fiches;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse a video slug into date and moment.
 * Format: seance-publique-du-{DD}-{mois}-{YYYY}-{moment}
 */
function parseVideoSlug(slug: string): { isoDate: string; moment: VideoMoment } | null {
  // Remove timecode suffix and clean
  const clean = slug.split('?')[0]!.trim();

  // Match: seance-publique-du-16-avril-2026-apres-midi
  const match = clean.match(/seance-publique-du-(\d{1,2})-([a-zà-ÿ]+)-(\d{4})-(matin|apres-midi|soir)$/);
  if (!match) return null;

  const [, day, monthStr, year, momentStr] = match;

  // Slugs from videos.senat.fr are already ASCII (accents stripped by the platform)
  const month = MONTHS_FR[monthStr!.toLowerCase()];
  if (!month) return null;

  const isoDate = `${year}-${month}-${String(day).padStart(2, '0')}`;
  return { isoDate, moment: momentStr as VideoMoment };
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: 20_000,
      headers: {
        'User-Agent': 'CLAIR-bot (transparence-politique, contact@clair.vote)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr,fr-FR;q=0.9',
        'Referer': BASE_URL,
        'X-Requested-With': 'XMLHttpRequest',
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
  });
}

export class SenatVideosClient {
  private async fetchPage(page: number): Promise<SenatVideo[]> {
    const params = new URLSearchParams({
      search: 'true',
      videotype: TYPE_SEANCE,
      page: String(page),
    });
    const html = await httpsGet(`${SEARCH_ENDPOINT}?${params}`);

    const videos: SenatVideo[] = [];
    const seen = new Set<string>();

    // Parse video hrefs via regex — avoids cheerio/undici dependency on Node 18
    const hrefRe = /href="(video\.[^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(html)) !== null) {
      const href = m[1]!;
      const slugWithTimecode = href.replace(/^video\./, '');
      const [idHash, ...slugParts] = slugWithTimecode.split('.');
      if (!idHash || slugParts.length === 0) continue;

      const slug = slugParts.join('.').split('?')[0]!;
      if (!slug.startsWith('seance-publique-du-')) continue;

      // Deduplicate by idHash (same video, different timecodes)
      if (seen.has(idHash)) continue;
      seen.add(idHash);

      const parsed = parseVideoSlug(slug);
      if (!parsed) continue;

      videos.push({
        ...parsed,
        url: `${BASE_URL}/video.${idHash}.${slug}`,
        slug,
      });
    }

    return videos;
  }

  /**
   * Fetch all séance publique videos, up to MAX_PAGES pages.
   * Returns a deduplicated list ordered by date desc.
   */
  async getAllVideos(maxPages: number = MAX_PAGES): Promise<SenatVideo[]> {
    const all: SenatVideo[] = [];
    const seenUrls = new Set<string>();

    logger.info('Starting Sénat videos scraping...');

    for (let page = 1; page <= maxPages; page++) {
      try {
        const videos = await this.fetchPage(page);

        if (videos.length === 0) {
          logger.info({ page }, 'Empty page — stopping pagination');
          break;
        }

        let newCount = 0;
        for (const v of videos) {
          if (!seenUrls.has(v.url)) {
            seenUrls.add(v.url);
            all.push(v);
            newCount++;
          }
        }

        logger.debug({ page, newCount, total: all.length }, 'Page scraped');

        if (page < maxPages) await sleep(REQUEST_DELAY_MS);
      } catch (err) {
        logger.warn({ page, error: errorMessage(err) }, 'Failed to fetch video page — stopping');
        break;
      }
    }

    logger.info({ total: all.length }, 'Sénat videos scraping done');
    return all;
  }

  /**
   * Les vidéos de réunion de commission, toutes pages confondues.
   *
   * Le catalogue en compte 384 sur un an, contre 512 pour la séance publique.
   * On s'arrête à la première page vide plutôt que d'aller au bout de
   * `maxPages` : le moteur rend neuf fiches par page.
   *
   * `maxPages` borne la moisson pour le passage intraday : le moteur classe du
   * plus récent au plus ancien, donc les premières pages suffisent à rattraper
   * la journée. Le passage nocturne, lui, balaie tout.
   */
  async getCommissionVideos(maxPages: number = MAX_PAGES): Promise<SenatVideoCommission[]> {
    const toutes: SenatVideoCommission[] = [];
    const vues = new Set<string>();

    logger.info('Vidéos de commission du Sénat : début de la moisson');

    for (let page = 1; page <= maxPages; page++) {
      try {
        const params = new URLSearchParams({
          search: 'true',
          videotype: TYPE_COMMISSION,
          page: String(page),
        });
        const fiches = fichesDeCommission(await httpsGet(`${SEARCH_ENDPOINT}?${params}`));

        if (fiches.length === 0) break;

        for (const f of fiches) {
          if (vues.has(f.url)) continue;
          vues.add(f.url);
          toutes.push(f);
        }

        if (page < maxPages) await sleep(REQUEST_DELAY_MS);
      } catch (err) {
        logger.warn({ page, error: errorMessage(err) }, 'Page de vidéos de commission illisible — arrêt');
        break;
      }
    }

    logger.info({ total: toutes.length }, 'Vidéos de commission du Sénat : moisson terminée');
    return toutes;
  }
}

export default SenatVideosClient;
