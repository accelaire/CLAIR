import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE = 'https://videos.assemblee-nationale.fr';
const SEARCH_URL = `${BASE}/php/eventsearch.php`;

// Mapping code vidéo AN → organeRef en DB (identique à an-videos-client.ts dans ingestion)
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

function parseSeanceOrder(title: string): number | null {
  const m = title.match(/^(\d+)[eè]me?\s+s[eé]ance/i);
  if (m) return parseInt(m[1]!, 10);
  if (/^1[eè]re?\s+s[eé]ance/i.test(title)) return 1;
  return null;
}

interface RawAnVideo {
  date: string;
  url: string;
  video_type: string;
  commission: string | null;
  title: string;
  published: boolean;
}

async function fetchType(typeVideo: string): Promise<RawAnVideo[]> {
  const params = new URLSearchParams({
    Date: '', Intervenant: '', Commission: '', Heure: '',
    TypeVideo: typeVideo, Rubrique: '', rnd: String(Date.now()),
  });
  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: {
      'User-Agent': 'CLAIR-bot (transparence-politique, contact@clair.vote)',
      Referer: BASE,
    },
  });
  const text = await res.text();
  // Strip UTF-8 BOM if present
  const json = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  return JSON.parse(json) as RawAnVideo[];
}

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [rawSeances, rawCommissions] = await Promise.all([
      fetchType('Séance publique'),
      fetchType('Commission'),
    ]);

    const commissions: { organeRef: string; directUrl: string }[] = [];
    const seances: { isoDate: string; order: number; directUrl: string }[] = [];

    for (const item of rawCommissions) {
      if (item.published === false) continue;
      const ts = parseInt(item.date, 10);
      if (isNaN(ts)) continue;
      const isoDate = new Date(ts * 1000).toISOString().slice(0, 10);
      if (isoDate !== today) continue;

      const rawCode = item.commission?.split(';')[0]?.trim() ?? null;
      const organeRef = rawCode ? (AN_VIDEO_CODE_TO_ORGANE[rawCode] ?? null) : null;
      if (!organeRef) continue;

      const idHash = item.url.replace(/^\//, '');
      commissions.push({ organeRef, directUrl: `${BASE}/direct.${idHash}` });
    }

    for (const item of rawSeances) {
      if (item.published === false) continue;
      const ts = parseInt(item.date, 10);
      if (isNaN(ts)) continue;
      const isoDate = new Date(ts * 1000).toISOString().slice(0, 10);
      if (isoDate !== today) continue;

      const order = parseSeanceOrder(item.title);
      if (order === null) continue;

      const idHash = item.url.replace(/^\//, '');
      seances.push({ isoDate, order, directUrl: `${BASE}/direct.${idHash}` });
    }

    return NextResponse.json({ commissions, seances }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({ commissions: [], seances: [] }, {
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    });
  }
}
