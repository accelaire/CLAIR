/** Fiche « Le scrutin public » (reprise de apps/web/app/comprendre/scrutin/page.tsx). */
import { Vote } from "lucide-react";
import { paragraph, strong } from "../../shared/rich-text/rich-text.ts";
import type { ComprendreArticle } from "../types.ts";
import { textCard } from "./helpers.ts";

export const scrutin: ComprendreArticle = {
  slug: "scrutin",
  title: "Le scrutin public",
  shortTitle: "Le scrutin",
  icon: Vote,
  summary: "Comment se déroule un vote et comment lire le résultat",
  sections: [
    {
      title: "Qu'est-ce qu'un scrutin public ?",
      blocks: [
        paragraph([
          "Un scrutin public est un vote formel où le choix de chaque parlementaire est ",
          strong("enregistré individuellement"),
          ". Contrairement au vote à main levée (où seul le résultat global est constaté), le scrutin public permet de savoir précisément qui a voté quoi.",
        ]),
        paragraph(
          "C'est grâce aux scrutins publics que CLAIR peut afficher le détail des votes par parlementaire et par groupe.",
        ),
      ],
    },
    {
      title: "Les types de scrutin",
      blocks: [
        {
          type: "cards",
          columns: 3,
          cards: [
            textCard(
              "Vote solennel",
              "Porte sur l'ensemble d'un texte de loi. Tous les parlementaires sont convoqués. C'est le vote le plus important et le plus médiatisé.",
            ),
            textCard(
              "Vote ordinaire",
              "Porte sur un article, un amendement ou une motion en séance. Plus fréquent et souvent plus technique que le vote solennel.",
            ),
            textCard(
              "Motion",
              "Procédure spécifique : motion de censure (renverser le gouvernement), motion de rejet préalable (refuser de débattre), question de confiance.",
            ),
          ],
        },
      ],
    },
    {
      title: "Comment lire un résultat",
      blocks: [
        paragraph("Chaque parlementaire peut voter dans l'une de ces quatre positions :"),
        {
          type: "cards",
          columns: 2,
          cards: [
            {
              badge: { kind: "vote", position: "pour" },
              blocks: [paragraph("Le parlementaire approuve le texte soumis au vote.")],
            },
            {
              badge: { kind: "vote", position: "contre" },
              blocks: [paragraph("Le parlementaire s'oppose au texte.")],
            },
            {
              badge: { kind: "vote", position: "abstention" },
              blocks: [paragraph("Le parlementaire ne se prononce ni pour ni contre.")],
            },
            {
              badge: { kind: "vote", position: "absent" },
              blocks: [paragraph("Le parlementaire n'a pas pris part au vote.")],
            },
          ],
        },
        {
          type: "cards",
          columns: 1,
          cards: [
            textCard("Les suffrages exprimés", [
              "Les suffrages exprimés = ",
              strong("pour + contre"),
              ". Les abstentions et les absences ne comptent pas. Un texte est adopté si les « pour » dépassent les « contre » parmi les suffrages exprimés.",
            ]),
          ],
        },
      ],
    },
  ],
  actions: [{ label: "Explorer les scrutins", href: "/scrutins" }],
};
