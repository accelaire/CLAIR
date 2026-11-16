/**
 * Proxy same-origin vers l'API CLAIR, repris de apps/web (voir ses commentaires détaillés,
 * `apps/web/app/api/v1/[...path]/route.ts`). La route `app/api/v1/[...path]/route.ts` ne fait
 * qu'appeler `relayerVersApi` : la logique vit ici, en Request/Response standard, pour être
 * testée sans Next (`node --test`).
 *
 * Le navigateur appelle `/api/v1/…` ; ce code, côté serveur, ajoute le secret interne
 * (`x-clair-internal`) et l'IP réelle du visiteur (`x-clair-client-ip`), sur laquelle l'API
 * applique sa limite de débit. Les en-têtes du client ne sont pas recopiés en bloc.
 * Réponses GET cachées à l'edge (dix minutes, puis 24 h périmées pendant la revalidation) : sur
 * un HIT, la fonction n'est pas invoquée et le transfert facturé par Vercel est nul.
 */
import { API_URL } from "./env.ts";

const EDGE_MAX_AGE_SECONDS = 600;
const EDGE_STALE_SECONDS = 86_400;
const SAFE_METHODS = new Set(["GET", "HEAD"]);

/** Chemins réservés au trafic service-à-service, jamais relayés. */
const INTERNAL_ONLY_PATHS = new Set(["homepage/warm"]);

/** Seuls chemins acceptés en écriture (formulaire de retour). */
const WRITABLE_PATHS = new Set(["feedback"]);

/**
 * Segment relayable (liste blanche, pas liste noire) : lettres et chiffres ASCII, `_`, `-`, `~`
 * et `.`, sans commencer par un point (ni `.`, ni `..`). Tous les identifiants de l'API (slugs,
 * uids, codes de département) tiennent dans cet alphabet. Next décode chaque segment (`%2F`
 * devient `/`, `%3F` devient `?`), puis l'analyseur d'URL en réinterprète d'autres (`%2E%2E` lu
 * comme `..`, tabulations supprimées) : n'accepter que des caractères qu'il ne transforme pas
 * ferme toutes ces formes.
 */
const SAFE_SEGMENT = /^[\w~-][\w.~-]*$/;

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

const NO_STORE = "private, no-store";

/**
 * IP du visiteur, posée par Vercel (`x-real-ip`, puis `x-forwarded-for` qu'il réécrit). Hypothèse :
 * le site est servi derrière Vercel ; derrière un autre frontal, ces en-têtes sont à fixer par lui.
 */
const clientIp = (request: Request) =>
  request.headers.get("x-real-ip")?.trim() ||
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "127.0.0.1";

/** 404 plutôt que 403 : depuis l'extérieur ces chemins n'existent pas. */
const notFound = () =>
  Response.json(
    { error: "Not Found", code: "NOT_FOUND" },
    { status: 404, headers: { "Cache-Control": NO_STORE } },
  );

/**
 * Relaie `request` vers `<apiUrl>/api/v1/<path>`. `path` est ce que Next passe à la route : les
 * segments de l'URL, chacun décodé une fois.
 */
export const relayerVersApi = async (
  request: Request,
  path: string[],
  apiUrl: string = API_URL,
): Promise<Response> => {
  if (!path.every((segment) => SAFE_SEGMENT.test(segment))) return notFound();
  const route = path.join("/").toLowerCase();
  if (INTERNAL_ONLY_PATHS.has(route)) return notFound();
  const hasBody = !SAFE_METHODS.has(request.method);
  if (hasBody && !WRITABLE_PATHS.has(route)) {
    return Response.json(
      { error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" },
      { status: 405, headers: { "Cache-Control": NO_STORE, Allow: "GET, HEAD" } },
    );
  }

  // Dernier garde-fou, après normalisation par l'analyseur d'URL (master, ac04516) : la requête
  // qui porte le secret part vers l'hôte de l'API et vers le chemin exact contrôlé ci-dessus. Si
  // l'analyseur l'a réécrit, les listes ont été comparées à un autre chemin que celui relayé.
  const chemin = `/api/v1/${path.join("/")}`;
  const target = new URL(`${apiUrl}${chemin}${new URL(request.url).search}`);
  if (target.origin !== new URL(apiUrl).origin || target.pathname !== chemin) return notFound();

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
      responseHeaders.set("Cache-Control", NO_STORE);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error("[api-proxy] API injoignable", error);
    // Même code d'erreur que apps/web.
    return Response.json(
      { error: "Bad Gateway", code: "UPSTREAM_UNREACHABLE" },
      { status: 502, headers: { "Cache-Control": NO_STORE } },
    );
  }
};
