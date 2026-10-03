import Script from 'next/script';

/**
 * Plausible Analytics - Solution respectueuse de la vie privée
 *
 * Plausible est exempt de consentement RGPD car :
 * - Pas de cookies
 * - Pas de tracking cross-site
 * - Données anonymisées
 * - Hébergé en Europe (EU)
 *
 * @see https://plausible.io/data-policy
 */

const DEFAULT_SCRIPT_URL = 'https://plausible.io/js/script.js';

/**
 * Scripts à charger : `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URLS`, séparés par des virgules.
 *
 * Deux URLs font tourner deux instances en parallèle le temps d'une bascule
 * (Plausible Cloud → instance auto-hébergée) : chaque script envoie ses
 * événements au serveur qui l'a servi (il dérive l'endpoint de son propre
 * `src`), les deux comptent donc les mêmes visites. Le second écrase
 * `window.plausible`, sans effet tant que le site n'envoie aucun événement
 * personnalisé.
 */
function scriptUrls(): string[] {
  const urls = (process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URLS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  return urls.length > 0 ? urls : [DEFAULT_SCRIPT_URL];
}

export function PlausibleAnalytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  // Ne pas charger si pas de domaine configuré
  if (!domain) {
    return null;
  }

  return (
    <>
      {scriptUrls().map((src) => (
        <Script
          key={src}
          defer
          data-domain={domain}
          src={src}
          strategy="afterInteractive"
        />
      ))}
    </>
  );
}
