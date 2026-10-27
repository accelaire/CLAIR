/** Fiche « Les commissions parlementaires » (reprise de apps/web/app/comprendre/commissions/page.tsx). */
import { Building, Calendar } from "lucide-react";
import { list, paragraph, strong } from "../../shared/rich-text/rich-text.ts";
import type { ComprendreArticle } from "../types.ts";
import { textCard } from "./helpers.ts";

const commissionsAN = [
  "Affaires culturelles et éducation",
  "Affaires économiques",
  "Affaires étrangères",
  "Affaires sociales",
  "Défense nationale et forces armées",
  "Développement durable et aménagement du territoire",
  "Finances, économie générale et contrôle budgétaire",
  "Lois constitutionnelles, législation et administration générale",
];

const commissionsSenat = [
  "Affaires économiques",
  "Affaires étrangères, défense et forces armées",
  "Affaires sociales",
  "Aménagement du territoire et développement durable",
  "Culture, éducation, communication et sport",
  "Finances",
  "Lois constitutionnelles, législation, suffrage universel, Règlement et administration générale",
];

export const commissions: ComprendreArticle = {
  slug: "commissions",
  title: "Les commissions parlementaires",
  shortTitle: "Les commissions",
  icon: Building,
  summary: "Le travail législatif en coulisses",
  liveData: {
    title: "Explorez les données en temps réel sur CLAIR",
    actions: [
      { label: "Voir les commissions", href: "/commissions", icon: Building },
      { label: "Consulter l'agenda", href: "/agenda", icon: Calendar },
    ],
  },
  sections: [
    {
      title: "Les commissions permanentes",
      blocks: [
        paragraph(
          "Chaque chambre dispose de commissions permanentes qui examinent les textes de loi avant leur passage en séance publique. C'est en commission que se fait l'essentiel du travail législatif de fond.",
        ),
        {
          type: "cards",
          columns: 2,
          cards: [
            {
              title: `Assemblée nationale (${commissionsAN.length} commissions)`,
              blocks: [list(...commissionsAN)],
            },
            {
              title: `Sénat (${commissionsSenat.length} commissions)`,
              blocks: [list(...commissionsSenat)],
            },
          ],
        },
      ],
    },
    {
      title: "Le rôle des commissions",
      blocks: [
        {
          type: "cards",
          columns: 3,
          cards: [
            textCard(
              "Examen des textes",
              "Avant la séance publique, la commission examine le texte article par article, auditionne les parties prenantes et adopte des amendements.",
            ),
            textCard(
              "Auditions",
              "Les commissions auditionnent régulièrement des ministres, experts, représentants de la société civile et acteurs concernés par les textes.",
            ),
            textCard(
              "Rapports",
              "Un rapporteur est désigné pour chaque texte. Il rédige un rapport qui présente le texte, les modifications proposées et les conclusions de la commission.",
            ),
          ],
        },
      ],
    },
    {
      id: "saisine",
      title: "Saisine au fond et pour avis",
      blocks: [
        paragraph(
          "Lorsqu'un texte de loi est déposé, il est renvoyé à une ou plusieurs commissions pour examen. Deux types de saisine existent :",
        ),
        {
          type: "cards",
          columns: 2,
          cards: [
            {
              badge: { kind: "libelle", label: "Saisie au fond", tone: "info" },
              blocks: [
                paragraph([
                  "La commission saisie ",
                  strong("au fond"),
                  " est la commission principale qui examine le texte. Elle désigne un rapporteur, organise les auditions, examine les articles un par un et adopte des amendements. C'est elle qui produit le texte soumis à la séance publique.",
                ]),
              ],
            },
            {
              badge: { kind: "libelle", label: "Saisie pour avis", tone: "neutre" },
              blocks: [
                paragraph([
                  "Une commission saisie ",
                  strong("pour avis"),
                  " donne un avis consultatif sur les aspects du texte qui relèvent de son domaine de compétence. Son avis n'est pas contraignant mais peut influencer le débat en séance publique. Plusieurs commissions peuvent être saisies pour avis sur un même texte.",
                ]),
              ],
            },
          ],
        },
      ],
    },
    {
      title: "Commissions spéciales et d'enquête",
      blocks: [
        {
          type: "cards",
          columns: 2,
          cards: [
            textCard(
              "Commissions spéciales",
              "Créées pour examiner un texte spécifique qui ne relève pas clairement d'une seule commission permanente. Elles sont dissoutes une fois le texte adopté.",
            ),
            textCard(
              "Commissions d'enquête",
              "Créées pour enquêter sur un sujet précis. Durée limitée à 6 mois. Elles disposent de pouvoirs d'investigation renforcés : convocations, auditions sous serment, accès aux documents.",
            ),
          ],
        },
      ],
    },
  ],
  actions: [{ label: "Explorer les dossiers législatifs", href: "/dossiers" }],
};
