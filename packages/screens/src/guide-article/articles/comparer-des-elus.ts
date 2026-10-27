/** Parcours « Comparer des élus » (repris de apps/web/app/guide/comparer-des-elus/page.tsx). */
import { GitCompareArrows } from "lucide-react";
import type { GuideArticle } from "../types.ts";

export const comparerDesElus: GuideArticle = {
  slug: "comparer-des-elus",
  title: "Comparer des élus",
  icon: GitCompareArrows,
  summary: "Mettre en regard l'activité de deux parlementaires",
  intro: "En 4 étapes, apprenez à comparer l'activité de deux parlementaires sur CLAIR.",
  steps: [
    {
      title: "Ouvrir une fiche",
      description:
        "Rendez-vous sur la fiche d'un député ou d'un sénateur depuis les pages Députés ou Sénateurs.",
    },
    {
      title: "Cliquer sur « Comparer »",
      description:
        "En haut de la fiche, cliquez sur le bouton « Comparer avec un autre député/sénateur ». Vous serez redirigé vers la liste avec le mode comparaison activé.",
    },
    {
      title: "Sélectionner un second élu",
      description:
        "La liste des parlementaires s'affiche. Cherchez ou filtrez pour trouver l'élu que vous souhaitez comparer.",
    },
    {
      title: "Lire la comparaison",
      description:
        "Les statistiques des deux élus sont mises côte à côte : présence, loyauté, participation, amendements. Identifiez les différences de comportement parlementaire.",
    },
  ],
  start: { label: "Choisir un député", href: "/deputes" },
};
