/**
 * En-têtes identifiant le frontend auprès de l'API comme trafic interne CLAIR.
 *
 * ⚠️ Code serveur uniquement (server components, generateMetadata, sitemap,
 * route handlers). Ne jamais importer depuis un composant `'use client'`.
 *
 * La garantie ne repose pas seulement sur cette consigne : Next n'injecte dans
 * les bundles navigateur que les variables préfixées `NEXT_PUBLIC_`. Comme
 * `CLAIR_INTERNAL_SECRET` ne l'est pas, elle vaut `undefined` côté client et le
 * secret ne peut pas fuir, même en cas d'import par erreur — la requête partira
 * simplement sans en-tête et retombera dans le tier anonyme.
 *
 * Remplace l'en-tête `Origin: https://clair.vote` qui servait de laissez-passer
 * jusqu'ici : `Origin` est choisi par le client, donc n'importe qui pouvait s'en
 * réclamer. Le secret, lui, ne quitte jamais le serveur.
 */

/** User-Agent explicite : Node envoie « undici » par défaut, que l'API bloque. */
export function internalHeaders(userAgent: string): Record<string, string> {
  const secret = process.env.CLAIR_INTERNAL_SECRET?.trim();

  return {
    'User-Agent': userAgent,
    ...(secret ? { 'x-clair-internal': secret } : {}),
  };
}
