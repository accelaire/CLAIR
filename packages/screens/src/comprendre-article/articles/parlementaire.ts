/** Fiche « Le parlementaire » (reprise de apps/web/app/comprendre/parlementaire/page.tsx). */
import { MessageSquare, ShieldCheck, TrendingUp, User, Vote } from "lucide-react";
import { paragraph, strong } from "../../shared/rich-text/rich-text.ts";
import type { ComprendreArticle } from "../types.ts";
import { textCard } from "./helpers.ts";

export const parlementaire: ComprendreArticle = {
  slug: "parlementaire",
  title: "Le parlementaire",
  shortTitle: "Le parlementaire",
  icon: User,
  summary: "Mandat, circonscription, groupe politique, statistiques",
  sections: [
    {
      title: "Le mandat",
      blocks: [
        paragraph([
          strong("Élection des députés"),
          " : au scrutin uninominal majoritaire à deux tours, dans chacune des 577 circonscriptions. Mandat de 5 ans.",
        ]),
        paragraph([
          strong("Élection des sénateurs"),
          " : au suffrage universel indirect par un collège de grands électeurs (élus locaux). Mandat de 6 ans, renouvelé par moitié tous les 3 ans.",
        ]),
        paragraph([
          strong("Circonscription"),
          " : chaque parlementaire représente un territoire géographique précis. C'est son ancrage local.",
        ]),
        paragraph([
          strong("Immunité parlementaire"),
          " : protection contre les poursuites judiciaires pour les actes liés à l'exercice du mandat (irresponsabilité) et encadrement des arrestations (inviolabilité).",
        ]),
      ],
    },
    {
      title: "Le rôle",
      blocks: [
        {
          type: "cards",
          columns: 2,
          cards: [
            textCard(
              "Voter la loi",
              "Participer aux scrutins publics pour adopter ou rejeter les textes de loi.",
            ),
            textCard(
              "Contrôler le gouvernement",
              "Poser des questions, créer des commissions d'enquête, voter la censure.",
            ),
            textCard(
              "Proposer des textes",
              "Déposer des propositions de loi et des amendements pour modifier les textes.",
            ),
            textCard(
              "Intervenir en séance",
              "Prendre la parole en séance publique pour défendre une position ou interpeller.",
            ),
          ],
        },
      ],
    },
    {
      title: "Les statistiques sur CLAIR",
      blocks: [
        paragraph(
          "Sur chaque fiche parlementaire, CLAIR affiche quatre indicateurs clés calculés à partir des données publiques.",
        ),
        {
          type: "cards",
          columns: 2,
          cards: [
            {
              ...textCard(
                "Présence solennelle",
                "Pourcentage de scrutins solennels auxquels le parlementaire a participé (voté pour, contre ou abstention). Les scrutins solennels portent sur l'ensemble d'un texte de loi et sont les plus importants.",
              ),
              icon: TrendingUp,
            },
            {
              ...textCard(
                "Loyauté au groupe",
                "Pourcentage de votes alignés avec la position majoritaire du groupe politique. Si le groupe vote majoritairement « pour » et que le parlementaire vote « pour », c'est un vote loyal.",
              ),
              icon: ShieldCheck,
            },
            {
              ...textCard(
                "Participation",
                "Nombre total de scrutins publics auxquels le parlementaire a pris part (voté pour, contre ou abstention).",
              ),
              icon: Vote,
            },
            {
              ...textCard(
                "Interventions",
                "Nombre de prises de parole en séance publique : questions au gouvernement, interventions dans les débats, explications de vote.",
              ),
              icon: MessageSquare,
            },
          ],
        },
      ],
    },
    {
      title: "Groupe parlementaire vs parti politique",
      blocks: [
        paragraph([
          "Le ",
          strong("groupe parlementaire"),
          " est une structure interne à la chambre : il organise le travail des élus, répartit le temps de parole et siège dans les commissions. Seuil minimum : 15 députés à l'AN, 10 sénateurs au Sénat.",
        ]),
        paragraph([
          "Le ",
          strong("parti politique"),
          " est une organisation extérieure au Parlement. Un même parti peut avoir des élus dans plusieurs groupes, et un groupe peut rassembler des élus de plusieurs partis.",
        ]),
      ],
    },
  ],
  actions: [
    { label: "Explorer les députés", href: "/deputes" },
    { label: "Explorer les sénateurs", href: "/senateurs" },
  ],
};
