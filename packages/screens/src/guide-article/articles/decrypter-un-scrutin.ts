/** Parcours « Décrypter un scrutin » (repris de apps/web/app/guide/decrypter-un-scrutin/page.tsx). */
import { Vote } from "lucide-react";
import type { GuideArticle } from "../types.ts";

export const decrypterUnScrutin: GuideArticle = {
  slug: "decrypter-un-scrutin",
  title: "Décrypter un scrutin",
  icon: Vote,
  summary: "Lire et analyser un vote parlementaire",
  intro: "En 5 étapes, apprenez à lire et analyser un vote parlementaire sur CLAIR.",
  steps: [
    {
      title: "Choisir un scrutin",
      description:
        "Sur la page Scrutins, parcourez les votes récents ou utilisez les filtres : thématique, chambre (Assemblée ou Sénat), résultat (adopté/rejeté), période.",
    },
    {
      title: "Lire la sidebar",
      description:
        "À droite (ou en haut sur mobile), la sidebar affiche les informations essentielles : date, chambre, type de vote (solennel, ordinaire ou motion), résultat, et le dossier législatif associé.",
    },
    {
      title: "Analyser les votes",
      description:
        "L'onglet « Votes » montre la répartition pour/contre/abstention/absent, avec le décompte total et les suffrages exprimés (pour + contre).",
    },
    {
      title: "Voir la répartition par groupe",
      description:
        "Chaque groupe politique est affiché avec sa position majoritaire et le détail des votes de ses membres. Repérez les groupes divisés ou unanimes.",
    },
    {
      title: "Explorer un parlementaire",
      description:
        "Cliquez sur le nom d'un parlementaire pour accéder à sa fiche complète et voir l'ensemble de ses votes, interventions et amendements.",
    },
  ],
  start: { label: "Parcourir les scrutins", href: "/scrutins" },
};
