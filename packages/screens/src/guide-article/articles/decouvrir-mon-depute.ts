/** Parcours « Découvrir mon député » (repris de apps/web/app/guide/decouvrir-mon-depute/page.tsx). */
import { User } from "lucide-react";
import type { GuideArticle } from "../types.ts";

export const decouvrirMonDepute: GuideArticle = {
  slug: "decouvrir-mon-depute",
  title: "Découvrir mon député",
  icon: User,
  summary: "Trouver votre député et comprendre son activité",
  intro:
    "En 5 étapes, apprenez à trouver votre député et à comprendre son activité parlementaire sur CLAIR.",
  steps: [
    {
      title: "Trouver votre député",
      description:
        "Rendez-vous sur la page Députés. Utilisez la barre de recherche par nom, ou filtrez par groupe politique, département ou commission.",
    },
    {
      title: "Lire la fiche",
      description:
        "La fiche affiche la photo, le groupe politique, la circonscription, les contacts et liens officiels du député.",
    },
    {
      title: "Comprendre les statistiques",
      description:
        "Quatre indicateurs clés : présence solennelle (% de votes solennels où il/elle a voté), loyauté au groupe (% d'alignement avec son groupe), nombre de votes, nombre d'interventions en séance.",
    },
    {
      title: "Explorer les votes",
      description:
        "L'onglet « Votes récents » liste tous les scrutins publics auxquels votre député a participé. Vous pouvez filtrer les votes dissidents (quand le député vote différemment de son groupe).",
    },
    {
      title: "Comparer",
      description:
        "Cliquez sur « Comparer avec un autre député » pour mettre en regard deux fiches côte à côte : statistiques, votes, et positionnement politique.",
    },
  ],
  start: { label: "Explorer les députés", href: "/deputes" },
};
