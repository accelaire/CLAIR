import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWikidataFacts, wikidataGet } from './client';
import { WikimediaIndisponible } from '../wikimedia-http';

describe('wikidataGet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const reponses = (...r: Response[]) => {
    const f = vi.fn();
    for (const x of r) f.mockResolvedValueOnce(x);
    vi.stubGlobal('fetch', f);
    return f;
  };

  it('sans reprise, rend null au premier échec (comportement d’origine)', async () => {
    const f = reponses(new Response('', { status: 429, headers: { 'retry-after': '1' } }));
    expect(await wikidataGet({ action: 'x' })).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('reprend après un 429 en respectant Retry-After', async () => {
    vi.useFakeTimers();
    const f = reponses(
      new Response('', { status: 429, headers: { 'retry-after': '11' } }),
      new Response(JSON.stringify({ ok: 1 })),
    );
    const p = wikidataGet<{ ok: number }>({ action: 'x' }, { reprises: 3 });
    await vi.advanceTimersByTimeAsync(10_999);
    expect(f).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('ne reprend pas une erreur définitive (4xx hors 429)', async () => {
    const f = reponses(new Response('', { status: 400 }));
    expect(await wikidataGet({ action: 'x' }, { reprises: 3 })).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('fetchWikidataFacts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const json = (corps: unknown) => new Response(JSON.stringify(corps));
  const humain = (id: string, description: string, claims: Record<string, unknown[]> = {}) => ({
    id,
    labels: { fr: { value: 'Jeanne Dupont' } },
    descriptions: { fr: { value: description } },
    claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }], ...claims },
  });
  const valeur = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });

  it('rend null quand Wikidata ne connaît personne de ce nom', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ search: [] })));
    expect(await fetchWikidataFacts('Jeanne', 'Dupont')).toBeNull();
  });

  it('lève une erreur, au lieu de rendre null, quand Wikidata reste en 429', async () => {
    vi.useFakeTimers();
    const f = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('', { status: 429, headers: { 'retry-after': '1' } })),
    );
    vi.stubGlobal('fetch', f);
    const p = fetchWikidataFacts('Jeanne', 'Dupont');
    const attendu = expect(p).rejects.toBeInstanceOf(WikimediaIndisponible);
    await vi.advanceTimersByTimeAsync(10_000);
    await attendu;
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("lève une erreur sur une erreur de l'API rendue en HTTP 200", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: { code: 'toomanyvalues' } })));
    await expect(fetchWikidataFacts('Jeanne', 'Dupont')).rejects.toThrow('toomanyvalues');
  });

  it('ne transmet pas un fait dont le libellé est introuvable (pas de QID brut)', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ search: [{ id: 'Q1' }] }))
      .mockResolvedValueOnce(
        json({ entities: { Q1: humain('Q1', 'femme politique française', { P102: [valeur('Q10'), valeur('Q11')] }) } }),
      )
      .mockResolvedValueOnce(json({ entities: { Q10: { id: 'Q10', labels: { fr: { value: 'Parti A' } } }, Q11: { id: 'Q11' } } }));
    vi.stubGlobal('fetch', f);
    const r = await fetchWikidataFacts('Jeanne', 'Dupont');
    expect(r?.partis).toEqual([{ label: 'Parti A', debut: undefined, fin: undefined }]);
  });
});
