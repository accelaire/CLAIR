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
 *
 * ── Pourquoi ce proxy DOIT cacher ────────────────────────────────────────────
 *
 * Router le navigateur par ici a un prix qui n'existait pas quand il tapait
 * l'API en direct : chaque octet renvoyé par cette fonction vers l'edge Vercel
 * est facturé en « Fast Origin Transfer ». Et il est facturé en clair — `fetch`
 * décompresse le corps reçu de l'API (voir `content-encoding` plus bas), si
 * bien qu'une liste de 92 Ko sur le réseau en pèse 391 au compteur. Sans cache,
 * chaque visiteur repayait ce plein tarif : le quota mensuel partait en trois
 * jours.
 *
 * Le TTL edge ci-dessous est donc structurel, pas une optimisation : sur un HIT
 * la fonction n'est pas invoquée du tout, et le transfert facturé est nul.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// La réponse dépend de l'URL et de l'IP appelante : elle ne peut pas être
// pré-rendue au build. Le cache est posé par en-tête, à l'exécution, ce qui
// n'entre pas en conflit avec ce réglage.
export const dynamic = 'force-dynamic';

/**
 * Durée de vie du cache edge.
 *
 * La base n'est réécrite qu'une fois par jour (cron d'ingestion à 5 h) : dix
 * minutes de fraîcheur restent très en deçà de ce que les données exigent.
 * `stale-while-revalidate` couvre les 24 h suivantes — passé le TTL, l'edge
 * sert la copie périmée et rafraîchit en arrière-plan, ce qui évite qu'une
 * entrée expirée sous trafic déclenche une rafale de requêtes vers l'API.
 */
const EDGE_MAX_AGE_SECONDS = 600;
const EDGE_STALE_SECONDS = 86_400;

/** Méthodes sans effet de bord, seules candidates au cache partagé. */
const SAFE_METHODS = new Set(['GET', 'HEAD']);

/**
 * Chemins réservés au trafic service-à-service, que ce proxy ne doit jamais
 * relayer.
 *
 * Ce handler pose le secret interne sur TOUT ce qu'il transmet — c'est sa raison
 * d'être. Un endpoint qui se contente de vérifier ce secret devient donc, sans
 * cette liste, appelable depuis n'importe quelle page web. L'API refait le
 * contrôle de son côté (`isStrictlyInternalRequest`) et c'est elle qui fait
 * autorité ; cette liste évite simplement qu'une requête forgée serve à sonder
 * un chemin interne depuis clair.vote.
 *
 * Le seul appelant légitime de ces chemins est le scheduler d'ingestion, qui
 * joint l'API par le réseau privé Railway et ne passe donc jamais par ici.
 *
 * ⚠️ On ne peut PAS généraliser en refusant simplement le secret sur les
 * méthodes mutantes : sans lui, l'API ne voit plus `x-clair-client-ip` et compte
 * tous les visiteurs sur l'IP de cette fonction. Un futur POST navigateur
 * (connexion) partagerait un seul quota et pourrait faire bannir l'IP Vercel.
 */
const INTERNAL_ONLY_PATHS = new Set(['homepage/warm']);

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
  // La politique de cache est décidée ici, en connaissance du contexte Vercel.
  // Les directives de l'amont ne doivent pas s'y superposer.
  'cache-control',
  'expires',
  'pragma',
  // L'API répond `vary: Origin` pour son CORS. Relayé tel quel, il ferait varier
  // la clé de cache edge sur un en-tête dont la réponse ne dépend pas : autant
  // de copies distinctes du même corps, donc autant de MISS facturés. Le proxy
  // est same-origin, cette variation n'a plus d'objet.
  'vary',
]);

/**
 * Une réponse ne rejoint le cache partagé que si rien ne la rend propre à un
 * visiteur. L'API n'expose aujourd'hui aucune route authentifiée, mais le jour
 * où elle en exposera, ce garde-fou évite qu'une réponse personnelle soit
 * resservie au visiteur suivant.
 *
 * Contrepartie assumée : sur un HIT l'API ne voit pas la requête, donc
 * `x-clair-client-ip` ne compte que les MISS. Le rate-limit protège toujours la
 * base — c'est son rôle — mais il ne borne plus la lecture de données déjà
 * cachées. Ces octets-là sortent de l'edge, pas de la base.
 */
function isCacheable(request: NextRequest, upstream: Response): boolean {
  if (!SAFE_METHODS.has(request.method)) return false;
  if (upstream.status !== 200) return false;
  if (request.headers.has('authorization') || request.headers.has('cookie')) return false;
  return true;
}

/**
 * IP du visiteur. Sur Vercel `request.ip` est renseignée ; en local et en repli,
 * on prend la première entrée de `x-forwarded-for` (le client, avant les proxies).
 */
function clientIp(request: NextRequest): string {
  if (request.ip) return request.ip;
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || '127.0.0.1';
}

/**
 * Normalise avant comparaison : Next décode déjà les segments, on retire les
 * segments vides (`homepage//warm`) et la casse pour qu'aucune de ces variantes
 * ne passe à côté de la liste.
 */
function isInternalOnly(path: string[]): boolean {
  return INTERNAL_ONLY_PATHS.has(path.filter(Boolean).join('/').toLowerCase());
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  // 404 plutôt que 403 : depuis l'extérieur ce chemin n'existe pas, et une
  // réponse distincte confirmerait qu'il y a quelque chose à trouver.
  if (isInternalOnly(path)) {
    return NextResponse.json(
      { error: 'Not Found', code: 'NOT_FOUND' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

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

    if (isCacheable(request, upstream)) {
      // `Vercel-CDN-Cache-Control` ne s'adresse qu'au CDN Vercel, qui le
      // consomme sans le retransmettre. C'est lui qui porte le TTL : le mettre
      // dans `Cache-Control` imposerait la même durée au navigateur.
      responseHeaders.set(
        'Vercel-CDN-Cache-Control',
        `public, s-maxage=${EDGE_MAX_AGE_SECONDS}, stale-while-revalidate=${EDGE_STALE_SECONDS}`,
      );
      // Le navigateur, lui, revalide à chaque fois. Il interroge l'edge et non
      // la fonction : côté facture c'est un HIT, et l'utilisateur ne se retrouve
      // pas avec un onglet figé dix minutes après une mise à jour.
      responseHeaders.set('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      responseHeaders.set('Cache-Control', 'private, no-store');
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[api-proxy] ${request.method} ${target} failed`, error);
    // Explicitement non caché : une panne de l'API ne doit pas être figée dix
    // minutes à l'edge, sinon elle survit à son propre rétablissement.
    return NextResponse.json(
      { error: 'Bad Gateway', code: 'UPSTREAM_UNREACHABLE', message: 'API injoignable' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
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
