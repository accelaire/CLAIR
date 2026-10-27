/**
 * Proxy same-origin vers l'API CLAIR, repris de apps/web (voir ses commentaires détaillés).
 *
 * Le navigateur appelle `/api/v1/…` ; ce handler, côté serveur, ajoute le secret interne
 * (`x-clair-internal`) et l'IP réelle du visiteur (`x-clair-client-ip`), sur laquelle l'API
 * applique sa limite de débit. Les en-têtes du client ne sont pas recopiés en bloc.
 * Réponses GET cachées à l'edge (dix minutes, puis 24 h périmées pendant la revalidation).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { API_URL } from "@/lib/env.ts";

export const dynamic = "force-dynamic";

const EDGE_MAX_AGE_SECONDS = 600;
const EDGE_STALE_SECONDS = 86_400;
const SAFE_METHODS = new Set(["GET", "HEAD"]);

/** Chemins réservés au trafic service-à-service, jamais relayés. */
const INTERNAL_ONLY_PATHS = new Set(["homepage/warm"]);

/** Seuls chemins acceptés en écriture (formulaire de retour). */
const WRITABLE_PATHS = new Set(["feedback"]);

/**
 * Segment de chemin sûr. Next décode `%2F` dans un segment : sans ce contrôle, `x%2F..%2Fdocs`
 * ferait sortir la requête de `/api/v1` (avec le secret interne) ou contourner
 * `INTERNAL_ONLY_PATHS`.
 */
const SEGMENT = /^[\w~-][\w.~-]*$/;

const STRIPPED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "cache-control",
  "expires",
  "pragma",
  "vary",
  "set-cookie",
  "x-powered-by",
]);

/**
 * IP du visiteur, posée par Vercel (`x-real-ip`, puis `x-forwarded-for` qu'il réécrit). Hypothèse :
 * le site est servi derrière Vercel ; derrière un autre frontal, ces en-têtes sont à fixer par lui.
 */
const clientIp = (request: NextRequest) =>
  request.headers.get("x-real-ip")?.trim() ||
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "127.0.0.1";

const notFound = () =>
  NextResponse.json(
    { error: "Not Found", code: "NOT_FOUND" },
    { status: 404, headers: { "Cache-Control": "private, no-store" } },
  );

const proxy = async (request: NextRequest, path: string[]) => {
  if (!path.every((segment) => SEGMENT.test(segment))) return notFound();
  const route = path.join("/").toLowerCase();
  if (INTERNAL_ONLY_PATHS.has(route)) return notFound();
  const hasBody = !SAFE_METHODS.has(request.method);
  if (hasBody && !WRITABLE_PATHS.has(route)) {
    return NextResponse.json(
      { error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" },
      { status: 405, headers: { "Cache-Control": "private, no-store", Allow: "GET, HEAD" } },
    );
  }
  const target = new URL(`${API_URL}/api/v1/${path.join("/")}${request.nextUrl.search}`);
  if (target.origin !== new URL(API_URL).origin || !target.pathname.startsWith("/api/v1/")) {
    return notFound();
  }

  const headers = new Headers({
    accept: request.headers.get("accept") ?? "application/json",
    "user-agent": "CLAIR-Site-Proxy/1.0",
    "x-clair-client-ip": clientIp(request),
  });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const secret = process.env.CLAIR_INTERNAL_SECRET?.trim();
  if (secret) headers.set("x-clair-internal", secret);
  else console.error("[api-proxy] CLAIR_INTERNAL_SECRET absent — trafic navigateur limité");

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: "half" as const } : {}),
      redirect: "manual",
    });
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
    });
    const cacheable =
      SAFE_METHODS.has(request.method) &&
      upstream.status === 200 &&
      !request.headers.has("authorization") &&
      !request.headers.has("cookie") &&
      !upstream.headers.has("set-cookie");
    if (cacheable) {
      responseHeaders.set(
        "Vercel-CDN-Cache-Control",
        `public, s-maxage=${EDGE_MAX_AGE_SECONDS}, stale-while-revalidate=${EDGE_STALE_SECONDS}`,
      );
      responseHeaders.set("Cache-Control", "public, max-age=0, must-revalidate");
    } else {
      responseHeaders.set("Cache-Control", "private, no-store");
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error("[api-proxy] API injoignable", error);
    return NextResponse.json(
      { error: "Bad Gateway", code: "UPSTREAM_UNAVAILABLE" },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }
};

type Context = { params: Promise<{ path: string[] }> };

export const GET = async (request: NextRequest, { params }: Context) =>
  proxy(request, (await params).path);
export const HEAD = GET;
export const POST = async (request: NextRequest, { params }: Context) =>
  proxy(request, (await params).path);
