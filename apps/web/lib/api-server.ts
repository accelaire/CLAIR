/**
 * Server-side API fetch utility for use in generateMetadata and server components.
 * Uses native fetch with Next.js caching (revalidate).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchFromApi<T>(
  endpoint: string,
  revalidate = 3600,
): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1${endpoint}`, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}
