import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { usageAnalyticsPlugin, clientName } from './usage-analytics';
import { INTERNAL_HEADER, CLIENT_IP_HEADER } from '../utils/internal-auth';

const ENDPOINT = 'https://stats.example.test/api/event';
const SECRET = 'secret-interne';

let fetchMock: ReturnType<typeof vi.fn>;

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(usageAnalyticsPlugin);
  app.get('/api/v1/deputes/:slug', async () => ({ ok: true }));
  app.get('/health', async () => ({ status: 'ok' }));
  await app.ready();
  return app;
}

/** Corps et en-têtes du n-ième envoi à Plausible. */
function sent(n = 0) {
  const [url, init] = fetchMock.mock.calls[n] as [string, RequestInit];
  return {
    url,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string),
  };
}

/** L'envoi part dans le hook onResponse, après la fin de `inject`. */
async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('PLAUSIBLE_EVENTS_URL', ENDPOINT);
  vi.stubEnv('PLAUSIBLE_API_DOMAIN', '');
  vi.stubEnv('CLAIR_INTERNAL_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usageAnalyticsPlugin', () => {
  it("n'envoie rien sans PLAUSIBLE_EVENTS_URL", async () => {
    vi.stubEnv('PLAUSIBLE_EVENTS_URL', '');
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/api/v1/deputes/x' });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envoie le motif de route, pas le chemin réel ni la query", async () => {
    const app = await buildApp();
    await app.inject({
      method: 'GET',
      url: '/api/v1/deputes/jean-dupont?include=stats',
      remoteAddress: '203.0.113.5',
      headers: { 'user-agent': 'GuzzleHttp/7.8.1 curl/8.5.0 PHP/8.3' },
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, headers, body } = sent();
    expect(url).toBe(ENDPOINT);
    expect(body).toEqual({
      name: 'pageview',
      url: 'https://api.clair.vote/api/v1/deputes/:slug',
      domain: 'api.clair.vote',
      props: { canal: 'direct', statut: '200', client: 'GuzzleHttp/7.8.1' },
    });
    // Le vrai User-Agent ne part pas : Plausible écarterait les robots.
    expect(headers['User-Agent']).toBe('CLAIR-API-Usage/1.0');
    expect(headers['X-Forwarded-For']).toBe('203.0.113.5');
  });

  it('respecte PLAUSIBLE_API_DOMAIN', async () => {
    vi.stubEnv('PLAUSIBLE_API_DOMAIN', 'api.staging.test');
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/api/v1/deputes/x' });
    await flush();
    expect(sent().body.domain).toBe('api.staging.test');
    expect(sent().body.url).toBe('https://api.staging.test/api/v1/deputes/:slug');
  });

  it("classe le trafic relayé par le site sur l'IP du visiteur", async () => {
    const app = await buildApp();
    await app.inject({
      method: 'GET',
      url: '/api/v1/deputes/x',
      remoteAddress: '76.76.21.21',
      headers: {
        'user-agent': 'CLAIR-Web-Proxy/1.0',
        referer: 'https://clair.vote/deputes',
        [INTERNAL_HEADER]: SECRET,
        [CLIENT_IP_HEADER]: '198.51.100.7',
      },
    });
    await flush();
    const { headers, body } = sent();
    expect(body.props.canal).toBe('site');
    expect(body.props.client).toBe('CLAIR-Web-Proxy/1.0');
    expect(body.referrer).toBe('https://clair.vote/deputes');
    expect(headers['X-Forwarded-For']).toBe('198.51.100.7');
  });

  it('classe le SSR et l\'ingestion en « interne »', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'GET',
      url: '/api/v1/deputes/x',
      headers: { 'user-agent': 'CLAIR-Web-SSR/1.0', [INTERNAL_HEADER]: SECRET },
    });
    await flush();
    expect(sent().body.props.canal).toBe('interne');
  });

  it('un faux secret reste « direct »', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'GET',
      url: '/api/v1/deputes/x',
      headers: { [INTERNAL_HEADER]: 'pas-le-bon', [CLIENT_IP_HEADER]: '198.51.100.7' },
    });
    await flush();
    expect(sent().body.props.canal).toBe('direct');
  });

  it('ignore les health checks, OPTIONS et HEAD', async () => {
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/health' });
    await app.inject({ method: 'OPTIONS', url: '/api/v1/deputes/x' });
    await app.inject({ method: 'HEAD', url: '/api/v1/deputes/x' });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('compte les 404 hors routes sous un motif unique', async () => {
    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/wp-login.php' });
    await flush();
    expect(sent().body.url).toBe('https://api.clair.vote/(route inconnue)');
    expect(sent().body.props.statut).toBe('404');
  });

  it("une panne de Plausible n'affecte pas la réponse", async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/deputes/x' });
    await flush();
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('abandonne les événements au-delà de 100 envois simultanés', async () => {
    // Plausible ne répond jamais : les envois s'accumulent.
    fetchMock.mockReturnValue(new Promise(() => {}));
    const app = await buildApp();
    for (let i = 0; i < 105; i++) {
      await app.inject({ method: 'GET', url: '/api/v1/deputes/x' });
    }
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(100);
  });
});

describe('clientName', () => {
  it('garde le premier produit du User-Agent', () => {
    expect(clientName('vigie-citoyenne-officials-ingestor/0.1')).toBe(
      'vigie-citoyenne-officials-ingestor/0.1',
    );
    expect(clientName('Referendum/6 CFNetwork/1490 Darwin/23.0.0')).toBe('Referendum/6');
  });

  it('regroupe les navigateurs', () => {
    expect(
      clientName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150.0.0.0'),
    ).toBe('navigateur');
  });

  it("signale l'absence de User-Agent", () => {
    expect(clientName(undefined)).toBe('(aucun)');
    expect(clientName('   ')).toBe('(aucun)');
  });

  it('tronque les valeurs démesurées', () => {
    expect(clientName('x'.repeat(500))).toHaveLength(80);
  });
});
