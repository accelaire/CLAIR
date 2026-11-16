/** Parcours « Comparer des élus » (repris de apps/web/app/guide/comparer-des-elus/page.tsx). */
import { GitCompareArrows } from "lucide-react";
import type { GuideArticle } from "../types.ts";

export const comparerDesElus: GuideArticle = {
  slug: "comparer-des-elus",
  title: "Comparer des élus",
  icon: GitCompareArrows,
  summary: "Mettre en regard l'activité de deux parlementaires",
  intro: "En 4 étapes, apprenez à comparer l'activité de deux à quatre parlementaires sur CLAIR.",
  steps: [
    {
      title: "Ouvrir la liste des élus",
      description:
        "Rendez-vous sur la page Députés ou Sénateurs. Depuis la fiche d'un élu, le bouton « Comparer avec d'autres députés » (ou sénateurs) ouvre la même liste, cet élu déjà sélectionné.",
    },
    {
      title: "Cocher « Comparer »",
      description:
        "Chaque carte porte une case « Comparer ». Cochez-la sur deux à quatre élus : cherchez ou filtrez la liste pour les trouver. Votre sélection s'affiche dans la barre de comparaison.",
    },
    {
      title: "Lancer la comparaison",
      description:
        "Dans la barre de comparaison, cliquez sur « Comparer ». Vous pouvez aussi y retirer un élu, ou tout retirer pour recommencer.",
    },
    {
      title: "Lire la comparaison",
      description:
        "Les statistiques des élus sont mises côte à côte (présence, loyauté, participation, calculées par CLAIR), puis leurs votes sur les mêmes scrutins et leurs derniers amendements. La case « Uniquement les scrutins où les positions diffèrent » isole les désaccords.",
    },
  ],
  start: { label: "Choisir un député", href: "/deputes" },
};
