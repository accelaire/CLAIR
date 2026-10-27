/** Fiche « Le lobbying en France » (reprise de apps/web/app/comprendre/lobbying/page.tsx). */
import { Briefcase, Building2, TrendingUp, Users } from "lucide-react";
import { paragraph, strong } from "../../shared/rich-text/rich-text.ts";
import type { ComprendreArticle } from "../types.ts";
import { textCard } from "./helpers.ts";

export const lobbying: ComprendreArticle = {
  slug: "lobbying",
  title: "Le lobbying en France",
  shortTitle: "Le lobbying",
  icon: Briefcase,
  summary: "HATVP, déclarations, secteurs d'activité",
  sections: [
    {
      title: "Cadre légal",
      blocks: [
        paragraph([
          "Depuis la ",
          strong("loi Sapin II (2016)"),
          ", les représentants d'intérêts (lobbyistes) doivent s'inscrire sur un registre tenu par la ",
          strong("HATVP"),
          " (Haute Autorité pour la Transparence de la Vie Publique).",
        ]),
        paragraph(
          "Cette obligation de transparence concerne toute personne morale ou physique qui entre en contact avec un décideur public (parlementaire, ministre, haut fonctionnaire) pour influencer une décision publique.",
        ),
      ],
    },
    {
      title: "Ce qui est déclaré",
      blocks: [
        {
          type: "cards",
          columns: 2,
          cards: [
            textCard(
              "Actions de lobbying",
              "Chaque rencontre ou communication avec un décideur public doit être déclarée : objet de l'action, cible contactée, texte visé.",
            ),
            textCard(
              "Cibles",
              "Qui a été contacté : parlementaires, ministres, conseillers, administration. CLAIR relie ces actions aux fiches des élus concernés.",
            ),
            textCard(
              "Budgets",
              "Le budget annuel consacré aux activités de lobbying, déclaré par tranches.",
            ),
            textCard(
              "Identité",
              "Nom, type d'organisation (entreprise, association, syndicat...), secteur d'activité, nombre de lobbyistes employés.",
            ),
          ],
        },
      ],
    },
    {
      title: "Les statistiques sur CLAIR",
      blocks: [
        paragraph(
          "Sur la page Lobbying, CLAIR affiche quatre indicateurs clés calculés à partir des données du registre HATVP.",
        ),
        {
          type: "cards",
          columns: 2,
          cards: [
            {
              ...textCard(
                "Budget déclaré",
                "Somme des budgets annuels déclarés par les représentants d'intérêts. Ce sont des montants déclaratifs, souvent indiqués par tranches (ex : 100 000 - 200 000 €).",
              ),
              icon: TrendingUp,
            },
            {
              ...textCard(
                "Nombre de lobbyistes",
                "Nombre de représentants d'intérêts enregistrés auprès de la HATVP : entreprises, associations, cabinets de conseil, syndicats, organisations professionnelles.",
              ),
              icon: Building2,
            },
            {
              ...textCard(
                "Actions",
                "Chaque rencontre, communication ou démarche déclarée auprès d'un décideur public. CLAIR compte chaque activité par exercice fiscal.",
              ),
              icon: Briefcase,
            },
            {
              ...textCard(
                "Secteurs",
                "Les domaines d'activité déclarés par les représentants d'intérêts : énergie, santé, numérique, agriculture, etc.",
              ),
              icon: Users,
            },
          ],
        },
      ],
    },
  ],
  actions: [{ label: "Explorer le lobbying", href: "/lobbying" }],
};
