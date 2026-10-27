/** Paramètres de requête ; les valeurs vides sont omises. */
export type Query = Record<string, string | number | boolean | string[] | null | undefined>;

/** Accès à l'API, en HTTP ou depuis des fixtures. Les écrans ne connaissent que cette interface. */
export type ApiClient = {
  get: <T>(path: string, query?: Query) => Promise<T>;
};

/** Erreur d'API avec son statut HTTP (404 : la ressource n'existe pas). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`API ${status} — ${path}`);
    this.name = "ApiError";
  }
}

/** `/deputes` + `{ page: 2, groupe: ["RN"] }` → `/deputes?page=2&groupe=RN`. */
export const withQuery = (path: string, query: Query = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === null || item === undefined || item === "" || item === false) continue;
      search.append(key, String(item));
    }
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
};

type HttpOptions = {
  /** Base des routes, par exemple `/api/v1` (navigateur, via le proxy) ou `http://api:3001/api/v1`. */
  baseUrl: string;
  headers?: Record<string, string>;
  /** Options passées à chaque `fetch` (par exemple `{ next: { revalidate: 3600 } }` côté serveur). */
  init?: RequestInit & Record<string, unknown>;
  fetch?: typeof fetch;
};

/** Client HTTP JSON. 404 → `ApiError` de statut 404 ; toute autre erreur → `ApiError`. */
export const createHttpClient = ({
  baseUrl,
  headers = {},
  init = {},
  fetch: doFetch,
}: HttpOptions): ApiClient => ({
  get: async <T>(path: string, query?: Query) => {
    const target = withQuery(`${baseUrl}${path}`, query);
    const response = await (doFetch ?? fetch)(target, {
      ...init,
      headers: { accept: "application/json", ...headers },
    });
    if (!response.ok) throw new ApiError(response.status, withQuery(path, query));
    return (await response.json()) as T;
  },
});

export type FixtureRoutes = Record<string, unknown | ((query: Query) => unknown)>;

/**
 * Client de fixtures : la réponse d'un chemin (sans paramètres) est lue dans `routes`.
 * Un chemin inconnu répond 404. Pour les tests, les stories et le mode FIXTURES.
 */
export const createFixtureClient = (routes: FixtureRoutes, { latencyMs = 0 } = {}): ApiClient => ({
  get: async <T>(path: string, query: Query = {}) => {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    if (!(path in routes)) throw new ApiError(404, withQuery(path, query));
    const route = routes[path];
    return (typeof route === "function" ? (route as (q: Query) => unknown)(query) : route) as T;
  },
});
