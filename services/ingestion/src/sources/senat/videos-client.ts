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

export interface SenatVideo {
  isoDate: string;      // 'YYYY-MM-DD'
  moment: VideoMoment;  // 'matin' | 'apres-midi' | 'soir'
  url: string;          // URL complète sans timecode
  slug: string;         // e.g. 'seance-publique-du-16-avril-2026-apres-midi'
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
      videotype: 'Séance publique',
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
  async getAllVideos(): Promise<SenatVideo[]> {
    const all: SenatVideo[] = [];
    const seenUrls = new Set<string>();

    logger.info('Starting Sénat videos scraping...');

    for (let page = 1; page <= MAX_PAGES; page++) {
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

        if (page < MAX_PAGES) await sleep(REQUEST_DELAY_MS);
      } catch (err: any) {
        logger.warn({ page, error: err.message }, 'Failed to fetch video page — stopping');
        break;
      }
    }

    logger.info({ total: all.length }, 'Sénat videos scraping done');
    return all;
  }
}

export default SenatVideosClient;
