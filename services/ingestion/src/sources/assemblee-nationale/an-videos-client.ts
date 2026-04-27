// =============================================================================
// Client AN - Vidéos des séances publiques et commissions
// Source: https://videos.assemblee-nationale.fr/php/eventsearch.php
// =============================================================================
//
// L'endpoint retourne ~120 vidéos récentes sans pagination fiable.
// Format URL vidéo: https://videos.assemblee-nationale.fr/video.{mediaId}_{hash}
//
// Deux types de vidéos :
//   - Séance publique (video_type: "S") — matchées par date + ordre ("1ère"/"2ème"/"3ème")
//   - Commission (video_type: "C") — matchées par date + code commission → organe_ref
// =============================================================================

import * as https from 'https';
import { logger } from '../../utils/logger';

const BASE_URL = 'https://videos.assemblee-nationale.fr';
const SEARCH_ENDPOINT = `${BASE_URL}/php/eventsearch.php`;

// Mapping code vidéo → organe_ref en DB
// Couvre les commissions permanentes et délégations actives (L17)
export const AN_VIDEO_CODE_TO_ORGANE: Record<string, string> = {
  CION_DEF:    'PO59046',   // Commission de la défense
  CION_AFETR:  'PO59047',   // Commission des affaires étrangères
  CION_FIN:    'PO59048',   // Commission des finances
  CION_LOIS:   'PO59051',   // Commission des lois
  'CION-CEDU': 'PO419604',  // Commission des affaires culturelles et de l'éducation
  'CION-SOC':  'PO420120',  // Commission des affaires sociales
  'CION-ECO':  'PO419610',  // Commission des affaires économiques
  'CION-DVP':  'PO419865',  // Commission du développement durable
  AFFEUROP:    'PO415287',  // Commission des affaires européennes
  CEC:         'PO420375',  // Comité d'évaluation et de contrôle
  COLTER:      'PO744127',  // Délégation aux collectivités territoriales
  DDE:         'PO804431',  // Délégation aux droits des enfants
  OM:          'PO675659',  // Délégation aux outre-mer
  DUE:         'PO59054',   // Délégation pour l'UE (ancienne)
  OTS:         'PO273589',  // OPECST (Office parlementaire)
};

export type AnVideoType = 'seance' | 'commission';

export interface AnVideo {
  mediaId: string;
  isoDate: string;        // 'YYYY-MM-DD'
  title: string;
  videoType: AnVideoType;
  commissionCode: string | null;  // e.g. 'CION_DEF', 'CION_FIN'
  organeRef: string | null;       // mapped from commissionCode
  seanceOrder: number | null;     // 1 | 2 | 3 (for séances: "1ère" → 1)
  url: string;                    // https://videos.assemblee-nationale.fr/video.{id}_{hash}
}

interface RawAnVideo {
  nid: string;
  mediaId: string;
  date: string;       // Unix timestamp (séances) OR 'YYYY-MM-DD' (commissions)
  title: string;
  url: string;        // '/{mediaId}_{hash}'
  video_type: string; // 'S' | 'C'
  commission: string | null;
  published: boolean;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: 20_000,
      headers: {
        'User-Agent': 'CLAIR-bot (transparence-politique, contact@clair.vote)',
        'Accept': 'application/json, text/plain',
        'Referer': BASE_URL,
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

function parseIsoDate(raw: RawAnVideo): string {
  // Both séances and commissions use Unix timestamp (seconds) in `date`
  const ts = parseInt(raw.date, 10);
  if (isNaN(ts)) return raw.date;
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function parseSeanceOrder(title: string): number | null {
  const m = title.match(/^(\d+)[eè]me?\s+s[eé]ance/i) ?? title.match(/^(1)[eè]re?\s+s[eé]ance/i);
  if (m) return parseInt(m[1]!, 10);
  // "1ère séance" edge-case
  if (/^1[eè]re?\s+s[eé]ance/i.test(title)) return 1;
  return null;
}

async function fetchVideos(typeVideo: string): Promise<AnVideo[]> {
  const params = new URLSearchParams({
    Date: '',
    Intervenant: '',
    Commission: '',
    Heure: '',
    TypeVideo: typeVideo,
    Rubrique: '',
    rnd: String(Date.now()),
  });

  const raw = await httpsGet(`${SEARCH_ENDPOINT}?${params}`);
  // Strip UTF-8 BOM (U+FEFF) if present
  const json = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  let items: RawAnVideo[];
  try {
    items = JSON.parse(json);
  } catch (e) {
    logger.error({ typeVideo, error: String(e) }, 'Failed to parse AN videos JSON');
    return [];
  }

  return items
    .filter((item) => item.published !== false)
    .map((item) => {
      const isoDate = parseIsoDate(item);
      const idHash = item.url.replace(/^\//, ''); // remove leading '/'
      const videoUrl = `${BASE_URL}/video.${idHash}`;

      // Split multi-commission codes (e.g. 'CION-ECO;CION_FIN') → take first
      const rawCode = item.commission?.split(';')[0]?.trim() ?? null;
      const organeRef = rawCode ? (AN_VIDEO_CODE_TO_ORGANE[rawCode] ?? null) : null;

      return {
        mediaId: item.mediaId,
        isoDate,
        title: item.title,
        videoType: item.video_type === 'S' ? 'seance' : 'commission',
        commissionCode: rawCode,
        organeRef,
        seanceOrder: item.video_type === 'S' ? parseSeanceOrder(item.title) : null,
        url: videoUrl,
      } as AnVideo;
    });
}

export class AnVideosClient {
  async getAllVideos(): Promise<AnVideo[]> {
    logger.info('Starting AN videos fetch...');

    const [seances, commissions] = await Promise.all([
      fetchVideos('Séance publique'),
      fetchVideos('Commission'),
    ]);

    const all = [...seances, ...commissions];
    logger.info({ seances: seances.length, commissions: commissions.length, total: all.length }, 'AN videos fetched');
    return all;
  }
}

export default AnVideosClient;
