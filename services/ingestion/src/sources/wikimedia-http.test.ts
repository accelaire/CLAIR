import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWikimedia, USER_AGENT_WIKIMEDIA } from './wikimedia-http';

describe('getWikimedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("s'annonce avec un User-Agent qui donne un contact joignable", async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', f);
    await getWikimedia('https://exemple.org/w/api.php', { action: 'x' });
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe('https://exemple.org/w/api.php?action=x&format=json');
    expect((init as RequestInit).headers).toEqual({ 'User-Agent': USER_AGENT_WIKIMEDIA });
    expect(USER_AGENT_WIKIMEDIA).toContain('contact@clair.vote');
  });

  it('sans reprise, laisse remonter une coupure réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(getWikimedia('https://exemple.org/w/api.php', { action: 'x' })).rejects.toThrow('fetch failed');
  });

  it('reprend après une coupure réseau, puis rend la réponse', async () => {
    vi.useFakeTimers();
    const f = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 })));
    vi.stubGlobal('fetch', f);
    const p = getWikimedia<{ ok: number }>('https://exemple.org/w/api.php', { action: 'x' }, { reprises: 2 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual({ ok: true, json: { ok: 1 } });
  });

  it('rend la raison quand les reprises sont épuisées', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('', { status: 503 }))));
    const p = getWikimedia('https://exemple.org/w/api.php', { action: 'x' }, { reprises: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual({ ok: false, raison: 'HTTP 503' });
  });
});
