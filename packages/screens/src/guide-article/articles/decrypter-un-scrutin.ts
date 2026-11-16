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
        "Sur la page Scrutins, parcourez les votes récents, recherchez un texte ou utilisez les filtres : chambre (Assemblée ou Sénat), mode de scrutin, objet du vote, motions de censure, thématique, période.",
    },
    {
      title: "Lire les informations",
      description:
        "À côté du détail (au-dessus sur mobile), le bloc « Informations » donne l'essentiel : date et lien vers la séance, chambre, mode de scrutin (solennel, ordinaire…), objet du vote, résultat et thématiques. Le dossier législatif associé est rappelé en tête de page, avec, quand il existe, un résumé « En clair » généré par IA.",
    },
    {
      title: "Analyser le vote",
      description:
        "L'onglet « Vote » montre la répartition pour/contre/abstention, avec le nombre de votants et de non-votants. Selon le scrutin, les onglets « Amendements » et « Débats » complètent la lecture.",
    },
    {
      title: "Voir la répartition par groupe",
      description:
        "Le tableau « Par groupe politique » donne, pour chaque groupe, ses voix pour, contre, abstention et ses non-votants ; triez-le en cliquant sur une colonne. Repérez les groupes divisés ou unanimes.",
    },
    {
      title: "Explorer un parlementaire",
      description:
        "Sous le tableau, la liste « Par élu » se filtre par groupe et par position. Cliquez sur le nom d'un parlementaire pour accéder à sa fiche complète : ses votes, interventions et amendements.",
    },
  ],
  start: { label: "Parcourir les scrutins", href: "/scrutins" },
};
