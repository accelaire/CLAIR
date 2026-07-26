/**
 * Proxy same-origin vers l'API CLAIR.
 *
 * Le navigateur appelle `/api/v1/…` sur clair.vote au lieu de taper l'API en
 * direct. Ce détour est ce qui rend le frontend authentifiable : une page web ne
 * peut porter aucun secret (tout ce qu'elle envoie est lisible et reproductible),
 * mais ce handler s'exécute sur un serveur et peut, lui, présenter le secret
 * interne. C'est ce qui a permis de supprimer le tier fondé sur `Origin`.
 *
 * Deux en-têtes sont posés :
 *   - `x-clair-internal`  : le secret, qui identifie le trafic comme le nôtre
 *   - `x-clair-client-ip` : l'IP réelle du visiteur, sur laquelle l'API compte
 *
 * Sans le second, ce proxy serait un relais anonyme illimité : il suffirait
 * d'appeler clair.vote/api/v1/… en boucle pour contourner toute limite.
 *
 * Les en-têtes du client ne sont PAS recopiés en bloc : on repart d'un jeu
 * choisi. Recopier aveuglément laisserait un visiteur poser son propre
 * `x-clair-client-ip` et se fabriquer un compteur neuf à chaque requête.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Le proxy relaie des données qui changent, et l'API ne pose aucun Cache-Control
// aujourd'hui : on ne met donc rien en cache, pour coller au comportement actuel.
export const dynamic = 'force-dynamic';

/** En-têtes de réponse à ne jamais relayer tels quels. */
const STRIPPED_RESPONSE_HEADERS = new Set([
  // `fetch` décompresse déjà le corps : relayer `content-encoding: gzip` sur des
  // octets en clair casserait le décodage côté navigateur.
  'content-encoding',
  'content-length',
  // Hop-by-hop, sans signification au-delà d'un saut.
  'connection',
  'keep-alive',
  'transfer-encoding',
  // Inutile en same-origin, et trompeur puisque l'origine vue par l'API est Vercel.
  'access-control-allow-origin',
  'access-control-allow-credentials',
]);

/**
 * IP du visiteur. Sur Vercel `request.ip` est renseignée ; en local et en repli,
 * on prend la première entrée de `x-forwarded-for` (le client, avant les proxies).
 */
function clientIp(request: NextRequest): string {
  if (request.ip) return request.ip;
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || '127.0.0.1';
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const secret = process.env.CLAIR_INTERNAL_SECRET?.trim();
  const target = `${API_URL}/api/v1/${path.join('/')}${request.nextUrl.search}`;

  const headers = new Headers({
    accept: request.headers.get('accept') ?? 'application/json',
    'user-agent': 'CLAIR-Web-Proxy/1.0',
    'x-clair-client-ip': clientIp(request),
  });

  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  // Absent, le trafic retombe simplement dans le tier anonyme : le site
  // fonctionne encore, plus lentement. On le signale sans casser la requête.
  if (secret) headers.set('x-clair-internal', secret);
  else console.error('[api-proxy] CLAIR_INTERNAL_SECRET absent — trafic navigateur throttlé');

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      // `duplex` est exigé par le runtime dès qu'un corps est un flux.
      ...(request.method === 'GET' || request.method === 'HEAD'
        ? {}
        : { duplex: 'half' as const }),
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[api-proxy] ${request.method} ${target} failed`, error);
    return NextResponse.json(
      { error: 'Bad Gateway', code: 'UPSTREAM_UNREACHABLE', message: 'API injoignable' },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(request, ctx.params.path);
}

export async function POST(request: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(request, ctx.params.path);
}

export async function HEAD(request: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(request, ctx.params.path);
}
