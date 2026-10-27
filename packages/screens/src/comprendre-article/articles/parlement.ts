/** Fiche « Le Parlement français » (reprise de apps/web/app/comprendre/parlement/page.tsx). */
import { Landmark } from "lucide-react";
import { paragraph, strong } from "../../shared/rich-text/rich-text.ts";
import type { ComprendreArticle } from "../types.ts";
import { textCard } from "./helpers.ts";

export const parlement: ComprendreArticle = {
  slug: "parlement",
  title: "Le Parlement français",
  shortTitle: "Le Parlement",
  icon: Landmark,
  summary: "Assemblée et Sénat : deux chambres, un Parlement",
  sections: [
    {
      title: "Qu'est-ce que le Parlement ?",
      blocks: [
        paragraph([
          "Le Parlement français est ",
          strong("bicaméral"),
          " : il est composé de deux chambres qui participent toutes les deux à l'élaboration de la loi.",
        ]),
        {
          type: "cards",
          columns: 2,
          cards: [
            textCard("Assemblée nationale", [
              strong("577 députés"),
              " élus au suffrage universel direct pour 5 ans. L'Assemblée siège au Palais Bourbon à Paris.",
            ]),
            textCard("Sénat", [
              strong("348 sénateurs"),
              " élus au suffrage universel indirect pour 6 ans (renouvelés par moitié tous les 3 ans). Le Sénat siège au Palais du Luxembourg.",
            ]),
          ],
        },
      ],
    },
    {
      title: "Les sessions parlementaires",
      blocks: [
        paragraph([
          strong("Session ordinaire"),
          " : du premier jour ouvrable d'octobre au dernier jour ouvrable de juin. C'est la période principale de travail parlementaire.",
        ]),
        paragraph([
          strong("Sessions extraordinaires"),
          " : convoquées par le Président de la République, sur un ordre du jour déterminé, en dehors de la session ordinaire (généralement en juillet ou septembre).",
        ]),
      ],
    },
    {
      title: "La navette parlementaire",
      blocks: [
        paragraph(
          "Un texte de loi fait des allers-retours entre les deux chambres jusqu'à ce qu'elles s'accordent sur une version identique. C'est ce qu'on appelle la « navette parlementaire ».",
        ),
        {
          type: "steps",
          steps: [
            {
              title: "Dépôt du texte",
              description:
                "Un projet de loi (déposé par le gouvernement) ou une proposition de loi (déposée par un parlementaire) est enregistré auprès d'une des deux chambres.",
            },
            {
              title: "1re lecture à l'Assemblée nationale",
              description:
                "Le texte est d'abord examiné en commission, puis débattu et voté en séance publique. Les députés peuvent déposer des amendements.",
            },
            {
              title: "1re lecture au Sénat",
              description:
                "Le texte adopté par l'Assemblée est transmis au Sénat, qui l'examine selon le même processus : commission puis séance.",
            },
            {
              title: "2e lecture à l'Assemblée nationale",
              description:
                "Si le Sénat a modifié le texte, il revient à l'Assemblée qui se prononce uniquement sur les articles modifiés.",
            },
            {
              title: "2e lecture au Sénat",
              description:
                "Le Sénat examine à son tour les modifications apportées par l'Assemblée.",
            },
            {
              title: "Commission mixte paritaire (CMP)",
              description:
                "En cas de désaccord persistant, une commission de 7 députés et 7 sénateurs tente de trouver un compromis.",
            },
            {
              title: "Lecture définitive",
              description:
                "Si la CMP échoue, l'Assemblée nationale a le dernier mot et peut adopter le texte définitivement.",
            },
          ],
        },
      ],
    },
  ],
  actions: [
    { label: "Explorer les députés", href: "/deputes" },
    { label: "Explorer les sénateurs", href: "/senateurs" },
  ],
};
