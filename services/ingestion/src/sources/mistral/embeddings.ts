// =============================================================================
// Client embeddings Mistral (`mistral-embed`)
//
// Réutilise la clé MISTRAL_API_KEY déjà présente (génération des labels/résumés).
// Graceful degradation : retourne null si la clé est absente ou en cas d'erreur,
// pour que les resolvers puissent retomber sur un classement non-sémantique.
// =============================================================================

import { logger } from '../../utils/logger.js';

const MISTRAL_EMBEDDINGS_API = 'https://api.mistral.ai/v1/embeddings';
const EMBED_MODEL = 'mistral-embed';

export function isEmbeddingAvailable(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

/**
 * Calcule les embeddings d'une liste de textes (un vecteur par entrée, dans
 * l'ordre). Retourne null si indisponible/erreur. Réessaie sur 429.
 */
export async function embedTexts(
  inputs: string[],
  opts: { timeoutMs?: number } = {},
): Promise<number[][] | null> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey || inputs.length === 0) return null;

  const { timeoutMs = 15000 } = opts;

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(MISTRAL_EMBEDDINGS_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        logger.warn({ status: res.status }, 'Mistral embeddings non-OK');
        return null;
      }

      const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      const out = json.data?.map((d) => d.embedding);
      return out && out.length === inputs.length ? out : null;
    } catch {
      // timeout / réseau → réessai ou abandon
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

/** Similarité cosinus entre deux vecteurs denses. */
export function cosineSim(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
