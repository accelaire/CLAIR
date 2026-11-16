// Tests du proxy /api/v1, repris de apps/web/app/api/v1/[...path]/route.test.ts (master).
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { relayerVersApi } from "./api-proxy.ts";

const API_URL = "http://api.test";

type Appel = { target: string; init: RequestInit };
let appels: Appel[] = [];
let reponseAmont: () => Response | Promise<Response> = () => new Response("{}", { status: 200 });

beforeEach(() => {
  appels = [];
  reponseAmont = () => new Response("{}", { status: 200 });
  process.env.CLAIR_INTERNAL_SECRET = "secret-de-test";
  mock.method(globalThis, "fetch", async (target: URL | string, init: RequestInit) => {
    appels.push({ target: String(target), init });
    return reponseAmont();
  });
  mock.method(console, "error", () => {});
});

afterEach(() => {
  mock.restoreAll();
  delete process.env.CLAIR_INTERNAL_SECRET;
});

/**
 * `path` est ce que Next passe au handler : les segments de l'URL, chacun décodé une fois.
 * `%2F` arrive donc en `/`, `%252E` en `%2E`, `%09` en tabulation.
 */
const appeler = async (
  method: string,
  path: string[],
  { search = "", headers = {} as Record<string, string> } = {},
) => {
  const request = new Request(`http://clair.test/api/v1/proxy${search}`, {
    method,
    headers,
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  const response = await relayerVersApi(request, path, API_URL);
  return { response, relayed: appels.map((appel) => appel.target) };
};

const enTetesRelayes = (index = 0) => appels[index]?.init.headers as Headers;

describe("proxy /api/v1 : chemins relayés", () => {
  const cas: Array<[string[], string, string]> = [
    [["deputes"], "", `${API_URL}/api/v1/deputes`],
    [["deputes"], "?page=2", `${API_URL}/api/v1/deputes?page=2`],
    [["sujets", "mon-sujet.v2"], "", `${API_URL}/api/v1/sujets/mon-sujet.v2`],
    [
      ["senatoriales", "2026", "resultats", "2A"],
      "",
      `${API_URL}/api/v1/senatoriales/2026/resultats/2A`,
    ],
    [
      ["agenda", "RUANR5L17S2027IDS30958", "debat"],
      "",
      `${API_URL}/api/v1/agenda/RUANR5L17S2027IDS30958/debat`,
    ],
    [["gouvernements"], "", `${API_URL}/api/v1/gouvernements`],
    [
      ["gouvernements", "gouvernement-fictif"],
      "",
      `${API_URL}/api/v1/gouvernements/gouvernement-fictif`,
    ],
    [
      ["lobbying", "eb83e4a4-0eef-4782-b5c4-8d979e39383b"],
      "",
      `${API_URL}/api/v1/lobbying/eb83e4a4-0eef-4782-b5c4-8d979e39383b`,
    ],
  ];
  for (const [path, search, attendu] of cas) {
    it(`GET ${path.join("/")}${search}`, async () => {
      const { response, relayed } = await appeler("GET", path, { search });
      assert.equal(response.status, 200);
      assert.deepEqual(relayed, [attendu]);
    });
  }

  it("pose le secret interne et l'IP du visiteur, sans recopier les en-têtes du client", async () => {
    await appeler("GET", ["deputes"], {
      headers: { "x-real-ip": "203.0.113.7", "x-clair-client-ip": "1.1.1.1", cookie: "a=b" },
    });
    const headers = enTetesRelayes();
    assert.equal(headers.get("x-clair-internal"), "secret-de-test");
    assert.equal(headers.get("x-clair-client-ip"), "203.0.113.7");
    assert.equal(headers.get("cookie"), null);
  });

  it("prend la première adresse de x-forwarded-for à défaut de x-real-ip", async () => {
    await appeler("GET", ["deputes"], { headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" } });
    assert.equal(enTetesRelayes().get("x-clair-client-ip"), "198.51.100.2");
  });

  it("relaie sans secret quand il manque (trafic anonyme, journalisé)", async () => {
    delete process.env.CLAIR_INTERNAL_SECRET;
    const { response } = await appeler("GET", ["deputes"]);
    assert.equal(response.status, 200);
    assert.equal(enTetesRelayes().get("x-clair-internal"), null);
  });

  it("HEAD est relayé", async () => {
    const { response, relayed } = await appeler("HEAD", ["deputes"]);
    assert.equal(response.status, 200);
    assert.deepEqual(relayed, [`${API_URL}/api/v1/deputes`]);
  });

  it("POST /feedback est relayé", async () => {
    const { response, relayed } = await appeler("POST", ["feedback"], {
      headers: { "content-type": "application/json" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(relayed, [`${API_URL}/api/v1/feedback`]);
    assert.equal(enTetesRelayes().get("content-type"), "application/json");
  });
});

describe("proxy /api/v1 : cache et en-têtes de réponse", () => {
  it("met en cache edge une réponse 200 et retire les en-têtes de l'amont", async () => {
    reponseAmont = () =>
      new Response("{}", {
        status: 200,
        headers: { "cache-control": "no-cache", vary: "Origin", "x-powered-by": "Fastify" },
      });
    const { response } = await appeler("GET", ["deputes"]);
    assert.match(response.headers.get("vercel-cdn-cache-control") ?? "", /s-maxage=600/);
    assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
    assert.equal(response.headers.get("vary"), null);
    assert.equal(response.headers.get("x-powered-by"), null);
  });

  it("ne met pas en cache une réponse d'erreur ni une requête avec cookie", async () => {
    reponseAmont = () => new Response("{}", { status: 404 });
    const erreur = await appeler("GET", ["deputes", "inconnu"]);
    assert.equal(erreur.response.headers.get("cache-control"), "private, no-store");
    reponseAmont = () => new Response("{}", { status: 200 });
    const avecCookie = await appeler("GET", ["deputes"], { headers: { cookie: "a=b" } });
    assert.equal(avecCookie.response.headers.get("cache-control"), "private, no-store");
  });

  it("répond 502 non caché quand l'API est injoignable", async () => {
    reponseAmont = () => {
      throw new TypeError("fetch failed");
    };
    const { response } = await appeler("GET", ["deputes"]);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(((await response.json()) as { code: string }).code, "UPSTREAM_UNREACHABLE");
  });
});

describe("proxy /api/v1 : chemins refusés sans rien relayer", () => {
  const cas: Array<[string, string[]]> = [
    // Chemins réservés au trafic service-à-service
    ["réservé", ["homepage", "warm"]],
    ["réservé, casse", ["HomePage", "Warm"]],
    // %2F décodé par Next : sortie de /api/v1 ou détour vers un chemin réservé
    ["%2F..%2F vers /docs", ["deputes/../../../docs"]],
    ["%2F.%2F vers le réservé", ["homepage/./warm"]],
    ["%2F..%2F vers le réservé", ["x/../homepage/warm"]],
    // `..` envoyés tels quels (curl --path-as-is)
    ["segments ..", ["deputes", "..", "..", "health"]],
    // %3F décodé : injection d'une chaîne de requête
    ["%3F", ["deputes?evil=1"]],
    // Double encodage : %252E arrive en %2E, que l'analyseur d'URL lit comme un point
    ["%252E%252E", ["x", "%2E%2E", "homepage", "warm"]],
    ["%252e%252e hors de /api/v1", ["deputes", "%2e%2e", "%2e%2e", "%2e%2e", "docs"]],
    // Tabulations et retours à la ligne, supprimés par l'analyseur d'URL
    ["%09", ["x", ".\t.", "homepage", "warm"]],
    ["%0A", ["x", "\n..", "homepage", "warm"]],
    // Antislash, segment vide, point seul
    ["antislash", ["x", "..\\homepage"]],
    ["segment vide", ["deputes", ""]],
    ["point seul", ["deputes", "."]],
  ];
  for (const [libelle, path] of cas) {
    it(libelle, async () => {
      const { response, relayed } = await appeler("GET", path);
      assert.equal(response.status, 404);
      assert.deepEqual(relayed, []);
    });
  }

  it("POST hors de /feedback reçoit 405 avec Allow", async () => {
    const { response, relayed } = await appeler("POST", ["deputes"]);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
    assert.deepEqual(relayed, []);
  });

  it("POST sur un chemin réservé reçoit 404", async () => {
    const { response, relayed } = await appeler("POST", ["homepage", "warm"]);
    assert.equal(response.status, 404);
    assert.deepEqual(relayed, []);
  });
});
