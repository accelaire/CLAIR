/** Parcours « Suivre un sujet » (repris de apps/web/app/guide/suivre-un-sujet/page.tsx). */
import { FileText, Search } from "lucide-react";
import type { GuideArticle } from "../types.ts";

export const suivreUnSujet: GuideArticle = {
  slug: "suivre-un-sujet",
  title: "Suivre un sujet",
  icon: FileText,
  cardIcon: Search,
  summary: "Rechercher un thème et suivre les votes associés",
  intro:
    "Un sujet, c'est un grand texte de loi suivi de bout en bout, de son dépôt à son issue, à travers l'Assemblée nationale et le Sénat. Voici comment lire sa page en 4 étapes.",
  steps: [
    {
      title: "Choisir un texte",
      description:
        "Depuis la page Sujets, parcourez les grands textes de loi : en cours d'examen, adoptés, rejetés ou promulgués. Chaque sujet réunit un même texte suivi à l'Assemblée et au Sénat.",
    },
    {
      title: "Suivre son parcours",
      description:
        "La chronologie législative montre où en est le texte : dépôt, examen à l'Assemblée nationale et au Sénat, adoption ou rejet, puis promulgation.",
    },
    {
      title: "Voir qui a voté quoi",
      description:
        "Les scrutins liés et les statistiques par groupe politique montrent comment chaque camp s'est positionné, à l'Assemblée comme au Sénat.",
    },
    {
      title: "Remonter à la source",
      description:
        "Les liens vers Légifrance et les dossiers officiels de l'Assemblée et du Sénat permettent de vérifier chaque information directement à la source.",
    },
  ],
  start: { label: "Voir les sujets", href: "/sujets" },
};
