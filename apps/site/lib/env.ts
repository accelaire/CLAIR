/** Adresse de l'API côté serveur (variable reprise de apps/web). */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:3001";

/**
 * Adresse publique du site, sans barre finale (métadonnées, plan du site, JSON-LD, images de
 * partage). Bêta : `https://beta.clair.vote` (défaut) ; après la bascule : `https://clair.vote`.
 * Lue au build (`NEXT_PUBLIC_*`) : la changer impose de reconstruire. Voir apps/site/README.md.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://beta.clair.vote").replace(
  /\/+$/,
  "",
);

/**
 * Le site est-il indexable ? Non tant qu'il n'a pas remplacé apps/web sur clair.vote :
 * beta.clair.vote ne doit pas concurrencer le site actuel dans les moteurs de recherche.
 */
export const INDEXABLE = process.env.SITE_INDEXABLE === "true";

/**
 * Mesure d'audience Plausible (sans cookie, exempte de consentement) : mêmes variables et même
 * condition que apps/web. Sans domaine, aucun script n'est chargé.
 */
export const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() || null;

/**
 * Scripts Plausible, séparés par des virgules (défaut : Plausible Cloud). Deux adresses font
 * compter deux instances en parallèle, le temps d'une bascule vers l'instance auto-hébergée.
 */
export const PLAUSIBLE_SCRIPT_URLS = (() => {
  const urls = (process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  return urls.length > 0 ? urls : ["https://plausible.io/js/script.js"];
})();
