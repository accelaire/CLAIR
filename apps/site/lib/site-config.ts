import type { FooterProps, HeaderProps } from "@clair/ui";

/** Rubriques de l'en-tête (mêmes rubriques que apps/web components/layout/header.tsx). */
export const navigation: HeaderProps["navigation"] = [
  {
    label: "Parlementaires",
    items: [
      { label: "Groupes politiques", href: "/groupes" },
      { label: "Députés", href: "/deputes" },
      { label: "Sénateurs", href: "/senateurs" },
      { label: "Commissions", href: "/commissions" },
      { label: "Sénatoriales 2026", href: "/senatoriales-2026" },
    ],
  },
  {
    label: "Activité",
    items: [
      { label: "Sujets parlementaires", href: "/sujets" },
      { label: "Dossiers législatifs", href: "/dossiers" },
      { label: "Scrutins", href: "/scrutins" },
      { label: "Agenda parlementaire", href: "/agenda" },
    ],
  },
  { label: "Lobbying", href: "/lobbying" },
  {
    label: "Outils",
    items: [
      { label: "Comprendre", href: "/comprendre" },
      { label: "Guide pratique", href: "/guide" },
      { label: "Classements", href: "/classements" },
      { label: "Comparer des députés", href: "/deputes/comparer" },
      { label: "Comparer des sénateurs", href: "/senateurs/comparer" },
    ],
  },
];

export const cta = { label: "Nous soutenir", href: "/soutenir" };

export const DOCS_URL = "https://docs.clair.vote";

/** Pied de page (même contenu que apps/web components/layout/footer.tsx). */
export const footer: Omit<FooterProps, "social"> = {
  tagline:
    "Plateforme citoyenne de transparence politique. Données 100 % publiques, 0 % d'opinion.",
  columns: [
    {
      title: "Explorer",
      links: [
        { label: "Députés", href: "/deputes" },
        { label: "Sénateurs", href: "/senateurs" },
        { label: "Groupes politiques", href: "/groupes" },
        { label: "Sujets", href: "/sujets" },
        { label: "Dossiers législatifs", href: "/dossiers" },
        { label: "Scrutins", href: "/scrutins" },
        { label: "Agenda", href: "/agenda" },
        { label: "Lobbying", href: "/lobbying" },
      ],
    },
    {
      title: "Ressources",
      links: [
        { label: "Nous soutenir", href: "/soutenir" },
        { label: "À propos", href: "/a-propos" },
        { label: "Méthodologie", href: "/methodologie" },
        { label: "Contact", href: "/contact" },
        { label: "Comprendre", href: "/comprendre" },
        { label: "Guide pratique", href: "/guide" },
        { label: "API ouverte", href: "/api" },
        { label: "Documentation", href: DOCS_URL, external: true },
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
    { label: "Ministère de l'Intérieur", href: "https://www.elections.interieur.gouv.fr" },
    { label: "DILA", href: "https://echanges.dila.gouv.fr/OPENDATA" },
  ],
};
