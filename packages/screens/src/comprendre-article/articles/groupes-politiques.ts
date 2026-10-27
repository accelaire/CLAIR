/** Fiche « Les groupes politiques » (reprise de apps/web/app/comprendre/groupes-politiques/page.tsx). */
import { Users } from "lucide-react";
import { labelled, list, paragraph, strong } from "../../shared/rich-text/rich-text.ts";
import type { ComprendreArticle } from "../types.ts";
import { textCard } from "./helpers.ts";

export const groupesPolitiques: ComprendreArticle = {
  slug: "groupes-politiques",
  title: "Les groupes politiques",
  shortTitle: "Les groupes politiques",
  icon: Users,
  summary: "Parti vs groupe, cohésion, alliances",
  sections: [
    {
      title: "Groupe parlementaire ≠ parti politique",
      blocks: [
        paragraph([
          "Le ",
          strong("groupe parlementaire"),
          " est une structure interne à l'assemblée. C'est l'unité d'organisation du travail parlementaire : il répartit le temps de parole, siège dans les commissions et coordonne les positions de vote.",
        ]),
        {
          type: "cards",
          columns: 2,
          cards: [
            {
              title: "Seuils minimum",
              blocks: [
                list(
                  labelled("Assemblée nationale", "15 députés minimum"),
                  labelled("Sénat", "10 sénateurs minimum"),
                ),
              ],
            },
            textCard(
              "Non-inscrits",
              "Les parlementaires qui n'appartiennent à aucun groupe sont dits « non-inscrits ». Ils disposent de moins de temps de parole et de postes en commission.",
            ),
          ],
        },
        paragraph([
          "Le ",
          strong("parti politique"),
          " est une organisation extérieure au Parlement. Un même parti peut avoir des élus dans plusieurs groupes, et un groupe peut rassembler des élus de différents partis.",
        ]),
      ],
    },
    {
      title: "Le rôle des groupes",
      blocks: [
        {
          type: "cards",
          columns: 2,
          cards: [
            textCard(
              "Temps de parole",
              "Le temps de parole en séance est réparti entre les groupes proportionnellement à leur taille.",
            ),
            textCard(
              "Commissions",
              "Les postes dans les commissions permanentes sont distribués proportionnellement entre les groupes.",
            ),
            textCard(
              "Scrutins publics",
              "Un groupe peut demander un scrutin public sur un texte, obligeant chaque parlementaire à se prononcer individuellement.",
            ),
            textCard(
              "Expression dans les débats",
              "Chaque groupe désigne un orateur pour les discussions générales et les explications de vote.",
            ),
          ],
        },
      ],
    },
    {
      title: "Cohésion et loyauté",
      blocks: [
        paragraph([
          "Sur CLAIR, la ",
          strong("loyauté au groupe"),
          " mesure le pourcentage de votes d'un parlementaire alignés avec la position majoritaire de son groupe.",
        ]),
        {
          type: "cards",
          columns: 1,
          cards: [
            textCard(
              "Comment c'est calculé",
              "Pour chaque scrutin, CLAIR identifie la position majoritaire du groupe (la position choisie par le plus grand nombre de membres). Un parlementaire qui vote dans ce sens est considéré comme « loyal ». Le taux de loyauté est le pourcentage de votes loyaux sur l'ensemble des scrutins auxquels le parlementaire a participé.",
            ),
          ],
        },
        paragraph(
          "Un taux de loyauté élevé indique une forte discipline de vote. Un taux plus bas peut refléter un positionnement indépendant ou des désaccords internes au groupe.",
        ),
      ],
    },
    {
      title: "Majorité et opposition",
      blocks: [
        paragraph([
          "Le ",
          strong("groupe majoritaire"),
          " (ou coalition majoritaire) soutient le gouvernement. Il dispose de la majorité des sièges et peut faire adopter les textes de loi.",
        ]),
        paragraph([
          "Les ",
          strong("groupes d'opposition"),
          " s'opposent au gouvernement. Ils disposent de droits spécifiques : présidence de la commission des finances, « niche parlementaire » (journée dédiée à leurs propositions de loi).",
        ]),
        paragraph([
          "Les ",
          strong("groupes minoritaires"),
          " ne se déclarent ni dans la majorité ni dans l'opposition. Leur positionnement varie selon les textes.",
        ]),
      ],
    },
  ],
  actions: [{ label: "Explorer les groupes politiques", href: "/groupes" }],
};
