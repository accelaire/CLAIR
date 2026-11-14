import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// `API_URL` est lu au chargement du module : l'environnement est posé avant l'import.
const API_URL = 'http://api.test';
let route: typeof import('./route');

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_URL);
  vi.stubEnv('CLAIR_INTERNAL_SECRET', 'secret-de-test');
  route = await import('./route');
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * `path` est ce que Next passe au handler : les segments de l'URL, chacun décodé
 * une fois. `%2F` arrive donc en `/`, `%252E` en `%2E`, `%09` en tabulation.
 */
async function call(method: string, path: string[], search = '') {
  const request = new NextRequest(`http://clair.test/api/v1/proxy${search}`, {
    method,
    ...(method === 'POST' ? { body: '{}', headers: { 'content-type': 'application/json' } } : {}),
  });
  const handler = { GET: route.GET, HEAD: route.HEAD, POST: route.POST }[method]!;
  const response = await handler(request, { params: { path } });
  const relayed = fetchMock.mock.calls.map(([target]) => String(target));
  return { status: response.status, relayed };
}

describe('proxy /api/v1 : chemins relayés', () => {
  it.each([
    [['deputes'], '', `${API_URL}/api/v1/deputes`],
    [['deputes'], '?page=2', `${API_URL}/api/v1/deputes?page=2`],
    [['sujets', 'mon-sujet.v2'], '', `${API_URL}/api/v1/sujets/mon-sujet.v2`],
    [['senatoriales', '2026', 'resultats', '2A'], '', `${API_URL}/api/v1/senatoriales/2026/resultats/2A`],
    [['agenda', 'RUANR5L17S2027IDS30958', 'debat'], '', `${API_URL}/api/v1/agenda/RUANR5L17S2027IDS30958/debat`],
  ])('GET %j%s', async (path, search, expected) => {
    const { status, relayed } = await call('GET', path, search);
    expect(status).toBe(200);
    expect(relayed).toEqual([expected]);
  });

  it('pose le secret interne et l’IP du visiteur', async () => {
    await call('GET', ['deputes']);
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('x-clair-internal')).toBe('secret-de-test');
    expect(headers.get('x-clair-client-ip')).toBeTruthy();
  });

  it('HEAD est relayé', async () => {
    const { status, relayed } = await call('HEAD', ['deputes']);
    expect(status).toBe(200);
    expect(relayed).toEqual([`${API_URL}/api/v1/deputes`]);
  });

  it('POST /feedback est relayé', async () => {
    const { status, relayed } = await call('POST', ['feedback']);
    expect(status).toBe(200);
    expect(relayed).toEqual([`${API_URL}/api/v1/feedback`]);
  });
});

describe('proxy /api/v1 : chemins refusés sans rien relayer', () => {
  it.each([
    // Chemins réservés au trafic service-à-service
    ['réservé', ['homepage', 'warm']],
    ['réservé, casse', ['HomePage', 'Warm']],
    // %2F décodé par Next : sortie de /api/v1 ou détour vers un chemin réservé
    ['%2F..%2F vers /docs', ['deputes/../../../docs']],
    ['%2F.%2F vers le réservé', ['homepage/./warm']],
    ['%2F..%2F vers le réservé', ['x/../homepage/warm']],
    // `..` envoyés tels quels (curl --path-as-is)
    ['segments ..', ['deputes', '..', '..', 'health']],
    // %3F décodé : injection d'une chaîne de requête
    ['%3F', ['deputes?evil=1']],
    // Double encodage : %252E arrive en %2E, que l'analyseur d'URL lit comme un point
    ['%252E%252E', ['x', '%2E%2E', 'homepage', 'warm']],
    ['%252e%252e hors de /api/v1', ['deputes', '%2e%2e', '%2e%2e', '%2e%2e', 'docs']],
    // Tabulations et retours à la ligne, supprimés par l'analyseur d'URL
    ['%09', ['x', '.\t.', 'homepage', 'warm']],
    ['%0A', ['x', '\n..', 'homepage', 'warm']],
    // Antislash, segment vide, point seul
    ['antislash', ['x', '..\\homepage']],
    ['segment vide', ['deputes', '']],
    ['point seul', ['deputes', '.']],
  ])('%s', async (_label, path) => {
    const { status, relayed } = await call('GET', path);
    expect(status).toBe(404);
    expect(relayed).toEqual([]);
  });

  it('POST hors de /feedback reçoit 405', async () => {
    const { status, relayed } = await call('POST', ['deputes']);
    expect(status).toBe(405);
    expect(relayed).toEqual([]);
  });

  it('POST sur un chemin réservé reçoit 404', async () => {
    const { status, relayed } = await call('POST', ['homepage', 'warm']);
    expect(status).toBe(404);
    expect(relayed).toEqual([]);
  });
});
