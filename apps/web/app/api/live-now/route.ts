import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Assemblée nationale — JSON endpoint
// ---------------------------------------------------------------------------
const AN_BASE = 'https://videos.assemblee-nationale.fr';
const AN_SEARCH_URL = `${AN_BASE}/php/eventsearch.php`;

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

function parseAnSeanceOrder(title: string): number | null {
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

async function fetchAnType(typeVideo: string): Promise<RawAnVideo[]> {
  const params = new URLSearchParams({
    Date: '', Intervenant: '', Commission: '', Heure: '',
    TypeVideo: typeVideo, Rubrique: '', rnd: String(Date.now()),
  });
  const res = await fetch(`${AN_SEARCH_URL}?${params}`, {
    headers: {
      'User-Agent': 'CLAIR-bot (transparence-politique, contact@clair.vote)',
      Referer: AN_BASE,
    },
  });
  const text = await res.text();
  const json = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  return JSON.parse(json) as RawAnVideo[];
}

// ---------------------------------------------------------------------------
// Sénat — HTML scraping of videos.senat.fr/direct
// ---------------------------------------------------------------------------
const SENAT_BASE = 'https://videos.senat.fr';

const SENAT_MONTHS: Record<string, string> = {
  janvier: '01', fevrier: '02', mars: '03', avril: '04',
  mai: '05', juin: '06', juillet: '07', aout: '08',
  septembre: '09', octobre: '10', novembre: '11', decembre: '12',
};

const SENAT_MOMENT_ORDER: Record<string, number> = {
  matin: 1, 'apres-midi': 2, soir: 3,
};

function parseSenatSeanceSlug(slug: string): { isoDate: string; order: number } | null {
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

async function fetchSenatDirect(): Promise<{ href: string; subtitle: string }[]> {
  const res = await fetch(`${SENAT_BASE}/direct`, {
    headers: {
      'User-Agent': 'CLAIR-bot (transparence-politique, contact@clair.vote)',
      Accept: 'text/html',
      Referer: SENAT_BASE,
    },
  });
  if (!res.ok) return [];
  const html = await res.text();

  const results: { href: string; subtitle: string }[] = [];
  const parts = html.split('card-live');
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i]!;
    const hrefMatch = block.match(/href="(video\.[^"]+)"/);
    const subtitleMatch = block.match(/card-subtitle[^>]*>([^<]+)/);
    if (hrefMatch) {
      results.push({
        href: hrefMatch[1]!,
        subtitle: subtitleMatch?.[1]?.trim() ?? '',
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------
type Chambre = 'assemblee' | 'senat';

interface LiveCommission {
  organeRef: string;
  directUrl: string;
  chambre: Chambre;
}

interface LiveSeance {
  isoDate: string;
  order: number;
  directUrl: string;
  chambre: Chambre;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [rawAnSeances, rawAnCommissions, rawSenatLive] = await Promise.all([
      fetchAnType('Séance publique'),
      fetchAnType('Commission'),
      fetchSenatDirect(),
    ]);

    const commissions: LiveCommission[] = [];
    const seances: LiveSeance[] = [];

    // --- AN commissions ---
    for (const item of rawAnCommissions) {
      if (item.published === false) continue;
      const ts = parseInt(item.date, 10);
      if (isNaN(ts)) continue;
      const isoDate = new Date(ts * 1000).toISOString().slice(0, 10);
      if (isoDate !== today) continue;

      const rawCode = item.commission?.split(';')[0]?.trim() ?? null;
      const organeRef = rawCode ? (AN_VIDEO_CODE_TO_ORGANE[rawCode] ?? null) : null;
      if (!organeRef) continue;

      const idHash = item.url.replace(/^\//, '');
      commissions.push({ organeRef, directUrl: `${AN_BASE}/direct.${idHash}`, chambre: 'assemblee' });
    }

    // --- AN séances ---
    for (const item of rawAnSeances) {
      if (item.published === false) continue;
      const ts = parseInt(item.date, 10);
      if (isNaN(ts)) continue;
      const isoDate = new Date(ts * 1000).toISOString().slice(0, 10);
      if (isoDate !== today) continue;

      const order = parseAnSeanceOrder(item.title);
      if (order === null) continue;

      const idHash = item.url.replace(/^\//, '');
      seances.push({ isoDate, order, directUrl: `${AN_BASE}/direct.${idHash}`, chambre: 'assemblee' });
    }

    // --- Sénat live ---
    for (const item of rawSenatLive) {
      if (/s[ée]ance publique/i.test(item.subtitle)) {
        const parsed = parseSenatSeanceSlug(item.href.replace(/^video\.\d+_[a-f0-9]+\./, ''));
        if (!parsed) continue;
        seances.push({
          isoDate: parsed.isoDate,
          order: parsed.order,
          directUrl: `${SENAT_BASE}/${item.href}`,
          chambre: 'senat',
        });
      }
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
