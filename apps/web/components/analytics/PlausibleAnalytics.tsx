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
export function PlausibleAnalytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  // Ne pas charger si pas de domaine configuré
  if (!domain) {
    return null;
  }

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
