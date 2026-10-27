import type { FooterProps } from "./Footer.tsx";

/** Contenu du pied de page du site actuel (apps/web components/layout/footer.tsx). */
export const footerExemple: FooterProps = {
  tagline:
    "Plateforme citoyenne de transparence politique. Données 100 % publiques, 0 % d'opinion.",
  columns: [
    {
      title: "Explorer",
      links: [
        { label: "Députés", href: "/deputes" },
        { label: "Sénateurs", href: "/senateurs" },
        { label: "Groupes politiques", href: "/groupes" },
        { label: "Scrutins", href: "/scrutins" },
      ],
    },
    {
      title: "Ressources",
      links: [
        { label: "Nous soutenir", href: "/soutenir" },
        { label: "À propos", href: "/a-propos" },
        { label: "Méthodologie", href: "/methodologie" },
      ],
    },
    {
      title: "Légal",
      links: [
        { label: "Mentions légales", href: "/mentions-legales" },
        { label: "Confidentialité", href: "/confidentialite" },
        { label: "CGU", href: "/cgu" },
      ],
    },
  ],
  sources: [
    { label: "Assemblée nationale", href: "https://data.assemblee-nationale.fr" },
    { label: "Sénat", href: "https://data.senat.fr" },
    { label: "HATVP", href: "https://www.hatvp.fr" },
  ],
  year: 2026,
};
