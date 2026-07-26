/**
 * Server-side API fetch utility for use in generateMetadata and server components.
 * Uses native fetch with Next.js caching (revalidate).
 *
 * Important: Node.js native fetch sends User-Agent "undici" by default,
 * which is blocked by the API rate-limit plugin. We override it here.
 */

import { internalHeaders } from './internal-headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchFromApi<T>(
  endpoint: string,
  revalidate = 3600,
): Promise<T | null> {
  const url = `${API_URL}/api/v1${endpoint}`;
  try {
    const res = await fetch(url, {
      next: { revalidate },
      // Le secret interne exempte le SSR du rate-limit. Sans lui, l'API classait
      // ces appels en « accès direct » à 10 req/min ; ils n'y survivaient que
      // parce que les IP Vercel tournent, chacune ayant son propre seau.
      headers: internalHeaders('CLAIR-Web-SSR/1.0'),
    });
    if (!res.ok) {
      console.error(`[api-server] ${res.status} ${res.statusText} — ${url}`);
      return null;
    }
    return res.json() as Promise<T>;
  } catch (err) {
    console.error(`[api-server] fetch failed — ${url}`, err);
    return null;
  }
}
