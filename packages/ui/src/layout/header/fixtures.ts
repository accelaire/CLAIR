import type { HeaderProps } from "./Header.tsx";

/** Navigation du site actuel (apps/web components/layout/header.tsx), pour les stories et les tests. */
export const navigationExemple: HeaderProps["navigation"] = [
  {
    label: "Parlementaires",
    items: [
      { label: "Groupes politiques", href: "/groupes" },
      { label: "Députés", href: "/deputes" },
      { label: "Sénateurs", href: "/senateurs" },
      { label: "Commissions", href: "/commissions" },
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
    ],
  },
];
