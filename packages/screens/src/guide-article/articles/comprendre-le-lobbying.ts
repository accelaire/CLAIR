/** Parcours « Comprendre le lobbying » (repris de apps/web/app/guide/comprendre-le-lobbying/page.tsx). */
import { Briefcase } from "lucide-react";
import type { GuideArticle } from "../types.ts";

export const comprendreLeLobbying: GuideArticle = {
  slug: "comprendre-le-lobbying",
  title: "Comprendre le lobbying",
  icon: Briefcase,
  summary: "Explorer les représentants d'intérêts et leurs actions",
  intro:
    "En 5 étapes, apprenez à explorer les représentants d'intérêts et leurs actions de lobbying sur CLAIR.",
  steps: [
    {
      title: "Accéder à la page Lobbying",
      description:
        "Rendez-vous sur la page Lobbying pour voir l'ensemble des représentants d'intérêts enregistrés auprès de la HATVP.",
    },
    {
      title: "Lire les statistiques générales",
      description:
        "En haut de page, quatre indicateurs : nombre de lobbyistes enregistrés, actions déclarées, budget total déclaré, et nombre de secteurs d'activité représentés.",
    },
    {
      title: "Filtrer par secteur ou type",
      description:
        "Utilisez les filtres pour explorer par secteur d'activité (énergie, santé, numérique...) ou par type d'organisation (entreprise, association, syndicat...).",
    },
    {
      title: "Consulter une fiche lobbyiste",
      description:
        "Cliquez sur un lobbyiste pour voir ses détails : budget annuel, nombre de lobbyistes employés, actions déclarées, et cibles contactées.",
    },
    {
      title: "Croiser avec les parlementaires",
      description:
        "Les actions de lobbying mentionnent souvent le parlementaire ciblé. Cliquez sur son nom pour accéder directement à sa fiche et voir l'ensemble de son activité.",
    },
  ],
  start: { label: "Explorer le lobbying", href: "/lobbying" },
};
