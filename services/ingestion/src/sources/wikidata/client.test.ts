import { afterEach, describe, expect, it, vi } from 'vitest';
import { wikidataGet } from './client';

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
