import { NextResponse } from 'next/server';
import type { DirectCommission, DirectSeance } from '@/lib/live-url';
import {
  AN_BASE,
  SENAT_BASE,
  directsCommissionsAn,
  directsSeancesAn,
  directsSenat,
  type RawAnVideo,
} from '@/lib/live-now-sources';

export const dynamic = 'force-dynamic';

const USER_AGENT = 'CLAIR-bot (transparence-politique, contact@clair.vote)';

/** Une source qui ne répond pas ne doit pas retenir les autres. */
const DELAI_SOURCE_MS = 8_000;

async function fetchAnType(typeVideo: string): Promise<RawAnVideo[]> {
  const params = new URLSearchParams({
    Date: '', Intervenant: '', Commission: '', Heure: '',
    TypeVideo: typeVideo, Rubrique: '', rnd: String(Date.now()),
  });
  const res = await fetch(`${AN_BASE}/php/eventsearch.php?${params}`, {
    headers: { 'User-Agent': USER_AGENT, Referer: AN_BASE },
    cache: 'no-store',
    signal: AbortSignal.timeout(DELAI_SOURCE_MS),
  });
  if (!res.ok) throw new Error(`AN ${typeVideo} : HTTP ${res.status}`);
  const text = await res.text();
  const json = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  return JSON.parse(json) as RawAnVideo[];
}

async function fetchSenatDirect(): Promise<string> {
  const res = await fetch(`${SENAT_BASE}/direct`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', Referer: SENAT_BASE },
    cache: 'no-store',
    signal: AbortSignal.timeout(DELAI_SOURCE_MS),
  });
  if (!res.ok) throw new Error(`Sénat : HTTP ${res.status}`);
  return res.text();
}

/**
 * Les directs en cours, AN et Sénat.
 *
 * Chaque source est lue à part : une panne de l'une (JSON illisible, délai
 * dépassé) laissait auparavant TOUTE la réponse vide, Sénat compris, sans trace.
 * Une réponse partielle se met en cache moins longtemps, pour revenir vite.
 */
export async function GET() {
  const now = Date.now();
  const [anSeances, anCommissions, senat] = await Promise.allSettled([
    fetchAnType('Séance publique'),
    fetchAnType('Commission'),
    fetchSenatDirect(),
  ]);

  const commissions: DirectCommission[] = [];
  const seances: DirectSeance[] = [];
  const pannes: string[] = [];

  if (anSeances.status === 'fulfilled') seances.push(...directsSeancesAn(anSeances.value, now));
  else pannes.push(`AN séances : ${String(anSeances.reason)}`);

  if (anCommissions.status === 'fulfilled') commissions.push(...directsCommissionsAn(anCommissions.value, now));
  else pannes.push(`AN commissions : ${String(anCommissions.reason)}`);

  if (senat.status === 'fulfilled') {
    const s = directsSenat(senat.value);
    commissions.push(...s.commissions);
    seances.push(...s.seances);
  } else pannes.push(`Sénat : ${String(senat.reason)}`);

  if (pannes.length > 0) console.error('[live-now] source indisponible', pannes);

  return NextResponse.json({ commissions, seances }, {
    headers: {
      'Cache-Control': pannes.length > 0
        ? 'public, s-maxage=60'
        : 'public, s-maxage=300, stale-while-revalidate=60',
    },
  });
}
