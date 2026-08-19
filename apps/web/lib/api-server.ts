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

/**
 * Comme `fetchFromApi`, mais distingue « la ressource n'existe pas » de « l'API
 * n'a pas répondu ».
 *
 * `fetchFromApi` renvoie `null` dans les deux cas. Une page de détail qui
 * appelle `notFound()` sur ce `null` transforme donc n'importe quel hoquet de
 * l'API en 404. C'était déjà discutable en rendu à la demande, où le dégât se
 * limitait à une requête ; c'est inacceptable sur une route en ISR, où le 404
 * est mis en cache et resservi à tous les visiteurs jusqu'à la revalidation
 * suivante — moteurs compris, qui désindexent sur cette base.
 *
 * D'où la règle : 404 de l'API ⇒ `null`, la ressource est réellement absente.
 * Tout le reste (5xx, réseau, JSON illisible) ⇒ on lève. Next abandonne alors
 * la génération et continue de servir la version précédente si elle existe,
 * exactement comme `fetchSitemapData` dans `app/sitemap.ts`. La page vieillit
 * au lieu de disparaître.
 */
export async function fetchRessource<T>(
  endpoint: string,
  revalidate = 3600,
): Promise<T | null> {
  const url = `${API_URL}/api/v1${endpoint}`;

  const res = await fetch(url, {
    next: { revalidate },
    headers: internalHeaders('CLAIR-Web-SSR/1.0'),
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(`[api-server] ${res.status} ${res.statusText} — ${url}`);
  }

  return res.json() as Promise<T>;
}
