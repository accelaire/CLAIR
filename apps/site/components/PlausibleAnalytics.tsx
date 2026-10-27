import Script from "next/script";
import { PLAUSIBLE_DOMAIN, PLAUSIBLE_SCRIPT_URLS } from "@/lib/env.ts";

/**
 * Plausible (repris de apps/web) : ni cookie, ni suivi d'un site à l'autre, données agrégées et
 * hébergées en Europe, donc exempt de consentement. Rien n'est chargé sans
 * `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`. Chaque script envoie ses événements au serveur qui l'a servi.
 * `afterInteractive` : chargé après l'hydratation, sans bloquer le rendu (équivalent de `defer`).
 */
export const PlausibleAnalytics = () => {
  const domaine = PLAUSIBLE_DOMAIN;
  if (!domaine) return null;
  // Attributs passés en objet : les types de `next/script` ne voient pas ceux de `<script>`
  // (`@types/react` est hors de portée de `next` dans l'arborescence pnpm).
  return PLAUSIBLE_SCRIPT_URLS.map((src) => (
    <Script key={src} {...{ src, "data-domain": domaine }} strategy="afterInteractive" />
  ));
};
