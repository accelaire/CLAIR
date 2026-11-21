import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWikipediaBio } from './client';
import { WikimediaIndisponible } from '../wikimedia-http';

describe('fetchWikipediaBio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const json = (corps: unknown) => new Response(JSON.stringify(corps));

  it("rend null quand aucun article ne porte le nom", async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json(['Jeanne Dupont', []]))));
    expect(await fetchWikipediaBio('Jeanne', 'Dupont')).toBeNull();
  });

  it('rend la bio d’un article politique', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(['Jeanne Dupont', ['Jeanne Dupont']]))
        .mockResolvedValueOnce(
          json({ query: { pages: { '1': { title: 'Jeanne Dupont', extract: 'Jeanne Dupont est une députée française.' } } } }),
        ),
    );
    expect(await fetchWikipediaBio('Jeanne', 'Dupont')).toMatchObject({
      title: 'Jeanne Dupont',
      pageUrl: 'https://fr.wikipedia.org/wiki/Jeanne_Dupont',
    });
  });

  it('lève une erreur, au lieu de rendre null, quand Wikipédia reste en 429', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response('', { status: 429, headers: { 'retry-after': '1' } }))),
    );
    const p = fetchWikipediaBio('Jeanne', 'Dupont');
    const attendu = expect(p).rejects.toBeInstanceOf(WikimediaIndisponible);
    await vi.advanceTimersByTimeAsync(10_000);
    await attendu;
  });
});
