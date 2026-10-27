import "server-only";

/**
 * En-têtes identifiant le site auprès de l'API comme trafic interne CLAIR (repris de apps/web).
 * Code serveur uniquement : `CLAIR_INTERNAL_SECRET` n'est jamais exposé au navigateur.
 * User-Agent explicite : Node envoie « undici » par défaut, que l'API bloque.
 */
export const internalHeaders = (userAgent: string): Record<string, string> => {
  const secret = process.env.CLAIR_INTERNAL_SECRET?.trim();
  return { "user-agent": userAgent, ...(secret ? { "x-clair-internal": secret } : {}) };
};
