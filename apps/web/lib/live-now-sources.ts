import type { DirectCommission, DirectSeance } from './live-url';
import { jourAParis } from './live-url';

// ---------------------------------------------------------------------------
// Assemblée nationale — catalogue JSON de videos.assemblee-nationale.fr
// ---------------------------------------------------------------------------
export const AN_BASE = 'https://videos.assemblee-nationale.fr';

/** Code vidéo de l'AN → organe. Les codes inconnus gardent leur vidéo (`videoId`). */
const AN_VIDEO_CODE_TO_ORGANE: Record<string, string> = {
  CION_DEF:    'PO59046',
  CION_AFETR:  'PO59047',
  CION_FIN:    'PO59048',
  CION_LOIS:   'PO59051',
  'CION-CEDU': 'PO419604',
  'CION-SOC':  'PO420120',
  'CION-ECO':  'PO419610',
  'CION-DVP':  'PO419865',
  AFFEUROP:    'PO415287',
  CEC:         'PO420375',
  COLTER:      'PO744127',
  DDE:         'PO804431',
  OM:          'PO675659',
  DUE:         'PO59054',
  OTS:         'PO273589',
};

export interface RawAnVideo {
  date: string;
  url: string;
  video_type: string;
  commission: string | null;
  title: string;
  published: boolean;
}

/**
 * Le catalogue de l'AN liste aussi les vidéos closes, sur plusieurs semaines.
 * On garde la journée en cours au sens large : une séance de 21 h 30 finit
 * souvent après minuit, et le badge ne doit pas tomber avec le jour UTC.
 */
const AN_FENETRE_MS = 18 * 60 * 60 * 1000;

export function parseAnSeanceOrder(title: string): number | null {
  const m = title.match(/^(\d+)[eè]me?\s+s[eé]ance/i);
  if (m) return parseInt(m[1]!, 10);
  if (/^1[eè]re?\s+s[eé]ance/i.test(title)) return 1;
  return null;
}

function anRecentes(items: RawAnVideo[], now: number) {
  const out: Array<{ item: RawAnVideo; ts: number; videoId: string }> = [];
  for (const item of items) {
    if (item.published === false) continue;
    const ts = parseInt(item.date, 10) * 1000;
    if (isNaN(ts) || ts > now + 60 * 60 * 1000 || now - ts > AN_FENETRE_MS) continue;
    const videoId = item.url.replace(/^\//, '');
    if (!/^\d+_[0-9a-f]+$/.test(videoId)) continue;
    out.push({ item, ts, videoId });
  }
  return out;
}

export function directsCommissionsAn(items: RawAnVideo[], now: number): DirectCommission[] {
  const directs: DirectCommission[] = [];
  for (const { item, videoId } of anRecentes(items, now)) {
    const directUrl = `${AN_BASE}/direct.${videoId}`;
    // Une réunion conjointe porte « CION_AFETR;DUE » : un direct par organe.
    const organes = (item.commission ?? '')
      .split(';')
      .map((code) => AN_VIDEO_CODE_TO_ORGANE[code.trim()])
      .filter((o): o is string => !!o);
    if (organes.length === 0) {
      directs.push({ chambre: 'assemblee', directUrl, videoId, organeRef: null, enCours: false });
    }
    for (const organeRef of organes) {
      directs.push({ chambre: 'assemblee', directUrl, videoId, organeRef, enCours: false });
    }
  }
  return directs;
}

export function directsSeancesAn(items: RawAnVideo[], now: number): DirectSeance[] {
  const directs: DirectSeance[] = [];
  for (const { item, ts, videoId } of anRecentes(items, now)) {
    const order = parseAnSeanceOrder(item.title);
    if (order === null) continue;
    directs.push({
      chambre: 'assemblee',
      isoDate: jourAParis(ts),
      order,
      directUrl: `${AN_BASE}/direct.${videoId}`,
      videoId,
      enCours: false,
    });
  }
  return directs;
}

// ---------------------------------------------------------------------------
// Sénat — page HTML videos.senat.fr/direct
// ---------------------------------------------------------------------------
export const SENAT_BASE = 'https://videos.senat.fr';

const SENAT_MONTHS: Record<string, string> = {
  janvier: '01', fevrier: '02', mars: '03', avril: '04',
  mai: '05', juin: '06', juillet: '07', aout: '08',
  septembre: '09', octobre: '10', novembre: '11', decembre: '12',
};

const SENAT_MOMENT_ORDER: Record<string, number> = {
  matin: 1, 'apres-midi': 2, soir: 3,
};

export function parseSenatSeanceSlug(slug: string): { isoDate: string; order: number } | null {
  const m = slug.match(/seance-publique-du-(\d{1,2})-([a-z]+)-(\d{4})-(matin|apres-midi|soir)$/);
  if (!m) return null;
  const month = SENAT_MONTHS[m[2]!];
  if (!month) return null;
  const order = SENAT_MOMENT_ORDER[m[4]!];
  if (!order) return null;
  return {
    isoDate: `${m[3]}-${month}-${String(m[1]).padStart(2, '0')}`,
    order,
  };
}

function texteNu(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Les cartes `card-live` de la page des directs : seules les retransmissions en
 * cours y figurent (« Aucune retransmission en cours » sinon). Séance publique
 * ou organe, chacune est un direct confirmé.
 */
export function directsSenat(html: string): { commissions: DirectCommission[]; seances: DirectSeance[] } {
  const commissions: DirectCommission[] = [];
  const seances: DirectSeance[] = [];

  const blocs = html.split('card-live');
  for (let i = 1; i < blocs.length; i++) {
    const bloc = blocs[i]!;
    const lien = bloc.match(/href="video\.(\d+_[0-9a-f]+)\.([^"?]+)/);
    if (!lien) continue;
    const videoId = lien[1]!;
    const slug = lien[2]!;
    const directUrl = `${SENAT_BASE}/video.${videoId}.${slug}`;
    const libelle = texteNu(bloc.match(/card-subtitle[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '');

    const seance = parseSenatSeanceSlug(slug);
    if (seance) {
      seances.push({ chambre: 'senat', ...seance, directUrl, videoId, enCours: true });
    } else if (libelle) {
      commissions.push({ chambre: 'senat', directUrl, videoId, organeRef: null, libelle, enCours: true });
    }
  }

  return { commissions, seances };
}
