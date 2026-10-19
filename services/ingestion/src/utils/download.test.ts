import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

// Le cache du portail AN compte plusieurs nœuds : la vérification de fraîcheur
// peut voir la version du jour et le téléchargement tomber sur celle de la
// veille (archive des débats, 10 octobre 2026).

const { axiosMock } = vi.hoisted(() => {
  const axiosMock = Object.assign(vi.fn(), { get: vi.fn() });
  return { axiosMock };
});
vi.mock('axios', () => ({ default: axiosMock }));

import { downloadWithRetry } from './download';

const URL_DEBATS = 'https://data.assemblee-nationale.fr/static/openData/repository/17/vp/syceronbrut/syseron.xml.zip';
const DU_JOUR = '"368e022-65d72e7f8c21e"';
const DE_LA_VEILLE = '"3603e39-65d4aacc3bb07"';

function reponse(contenu: string, etag: string) {
  return { data: Readable.from([Buffer.from(contenu)]), headers: { etag, 'content-length': String(contenu.length) } };
}

describe('downloadWithRetry sur le portail AN', () => {
  let dest: string;

  beforeEach(() => {
    axiosMock.mockReset();
    axiosMock.get.mockReset();
    dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clair-dl-')), 'archive.zip');
    // Cache et origine annoncent la même version au GET d'un octet.
    axiosMock.get.mockResolvedValue({ headers: { etag: DU_JOUR } });
  });

  it("bascule sur l'origine quand le nœud qui répond sert une autre version", async () => {
    axiosMock.mockImplementation(async (config: { url: string }) =>
      config.url.includes('?_=') ? reponse('du jour', DU_JOUR) : reponse('veille', DE_LA_VEILLE),
    );

    const resultat = await downloadWithRetry(URL_DEBATS, dest, { backoffMs: 1 });

    expect(fs.readFileSync(dest, 'utf8')).toBe('du jour');
    expect(resultat.attempts).toBe(1);
    expect(axiosMock.mock.calls.map(([c]) => (c as { url: string }).url.includes('?_='))).toEqual([false, true]);
  });

  it('garde le cache quand il sert la version de l’origine', async () => {
    axiosMock.mockResolvedValue(reponse('du jour', DU_JOUR));

    await downloadWithRetry(URL_DEBATS, dest, { backoffMs: 1 });

    expect(fs.readFileSync(dest, 'utf8')).toBe('du jour');
    expect(axiosMock).toHaveBeenCalledTimes(1);
    expect((axiosMock.mock.calls[0]![0] as { url: string }).url).toBe(URL_DEBATS);
  });
});

// Le CDN de l'AN coupait l'archive des amendements tous les 5 à 30 Mo le
// 19 octobre 2026 : sans reprise, aucune tentative n'aboutissait.
describe('downloadWithRetry : reprise après coupure', () => {
  let dest: string;
  const URL_HORS_AN = 'https://exemple.test/archive.zip';
  const ETAG = '"v1"';
  const TOUT = 'debut-et-fin';

  // Un flux qui livre `morceau` puis se coupe, comme un ECONNRESET.
  function coupee(morceau: string) {
    const flux = new Readable({ read() {} });
    flux.push(Buffer.from(morceau));
    setTimeout(() => flux.destroy(Object.assign(new Error('aborted'), { code: 'ECONNRESET' })), 50);
    return flux;
  }

  beforeEach(() => {
    axiosMock.mockReset();
    dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clair-dl-')), 'archive.zip');
  });

  it('reprend à l’octet atteint, avec If-Range sur l’ETag, et ajoute la suite', async () => {
    axiosMock.mockImplementation(async (config: { headers: Record<string, string> }) => {
      if (!config.headers.Range) {
        return { status: 200, data: coupee('debut'), headers: { etag: ETAG, 'content-length': String(TOUT.length) } };
      }
      expect(config.headers.Range).toBe('bytes=5-');
      expect(config.headers['If-Range']).toBe(ETAG);
      return {
        status: 206,
        data: Readable.from([Buffer.from(TOUT.slice(5))]),
        headers: { etag: ETAG, 'content-range': `bytes 5-${TOUT.length - 1}/${TOUT.length}`, 'content-length': String(TOUT.length - 5) },
      };
    });

    const resultat = await downloadWithRetry(URL_HORS_AN, dest, { backoffMs: 1, maxAttempts: 1 });

    expect(fs.readFileSync(dest, 'utf8')).toBe(TOUT);
    expect(resultat.bytes).toBe(TOUT.length);
  }, 20_000);

  it('repart de zéro quand le serveur renvoie l’archive entière (version changée)', async () => {
    let appels = 0;
    axiosMock.mockImplementation(async () => {
      appels++;
      if (appels === 1) {
        return { status: 200, data: coupee('debut'), headers: { etag: ETAG, 'content-length': '100' } };
      }
      return { status: 200, data: Readable.from([Buffer.from('nouvelle')]), headers: { etag: '"v2"', 'content-length': '8' } };
    });

    await downloadWithRetry(URL_HORS_AN, dest, { backoffMs: 1, maxAttempts: 1 });

    expect(fs.readFileSync(dest, 'utf8')).toBe('nouvelle');
  }, 20_000);
});
