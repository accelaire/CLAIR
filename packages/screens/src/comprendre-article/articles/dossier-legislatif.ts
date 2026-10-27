/** Fiche « Le dossier législatif » (reprise de apps/web/app/comprendre/dossier-legislatif/page.tsx). */
import { FileText } from "lucide-react";
import { paragraph, strong } from "../../shared/rich-text/rich-text.ts";
import type { ArticleCard, ComprendreArticle } from "../types.ts";

type SortTone = "succes" | "erreur" | "avertissement" | "neutre";

/** Sorts possibles d'un amendement (repris de apps/web/components/SORTSList.tsx). */
const SORTS: readonly [label: string, tone: SortTone, description: string][] = [
  ["Adopté", "succes", "L'amendement est intégré au texte de loi."],
  [
    "Adopté modifié",
    "succes",
    "L'amendement est adopté avec des modifications apportées par le gouvernement ou la commission.",
  ],
  ["Rejeté", "erreur", "L'amendement est refusé par la majorité des votants."],
  ["Retiré", "avertissement", "L'auteur retire son amendement avant le vote."],
  [
    "Retiré avant publication",
    "avertissement",
    "L'auteur retire son amendement avant la publication du texte définitif.",
  ],
  [
    "Retiré après publication",
    "avertissement",
    "L'auteur retire son amendement après la publication du texte, le rendant sans effet.",
  ],
  [
    "Tombé",
    "avertissement",
    "L'amendement devient sans objet car l'article visé a été supprimé ou modifié par un autre amendement adopté.",
  ],
  [
    "Effacé",
    "avertissement",
    "L'amendement a été effacé du débat par décision du président de séance.",
  ],
  [
    "Entonnoir (45)",
    "avertissement",
    "Amendement devenu sans objet car l'article ou le texte qu'il visait a été adopté ou modifié.",
  ],
  [
    "Irrecevable",
    "neutre",
    "Déclaré irrecevable par le président de séance (vice de forme, cavalier législatif, etc.).",
  ],
  [
    "Cavalier (45)",
    "neutre",
    "Amendement sans lien direct avec le texte en discussion (article 45 de la Constitution).",
  ],
  [
    "Cavalier budgétaire",
    "neutre",
    "Variante du cavalier : amendement budgétairement irrecevable car créant une charge nouvelle sans compensation.",
  ],
  [
    "Cavalier social",
    "neutre",
    "Amendement cavalier portant sur un sujet sociaux et économiques sans lien direct avec le texte.",
  ],
  ["Irr en première partie", "neutre", "Irrecevable en première lecture du texte."],
  ["Irr en seconde partie", "neutre", "Irrecevable en seconde lecture du texte."],
  [
    "Autres irr LOLF",
    "neutre",
    "Irrecevable au regard de la loi organique relative aux lois de finances (LOLF).",
  ],
  [
    "Autres irr LOLFSS",
    "neutre",
    "Irrecevable au regard de la loi organique relative aux lois de financement de la sécurité sociale (LOLFSS).",
  ],
  [
    "Autre irrecevabilité",
    "neutre",
    "Motif d'irrecevabilité non spécifiquement catégorisé (domaine réglementaire, procédure, etc.).",
  ],
  [
    "Autre irrecevabilité 40",
    "neutre",
    "Irrecevable pour un motif économique/financier spécifique (art. 40 Const.).",
  ],
  [
    "Champ de l'habilitation (38)",
    "neutre",
    "Irrecevable car sort du périmètre de l'habilitation législative accordée au gouvernement (art. 38 Const.).",
  ],
  [
    "Disposition réglementaire (37)",
    "neutre",
    "Irrecevable : la matière est de nature réglementaire et non législative (art. 37 Const.).",
  ],
  [
    "Domaine de la loi (41)",
    "neutre",
    "Irrecevable : l'objet relève d'une loi organique ou empiète sur le domaine réservé aux lois organiques (art. 41 Const.).",
  ],
  [
    "Domaine loi organique (127)",
    "neutre",
    "Irrecevable : l'objet relève du domaine des lois organiques (art. 127 Règl. AN).",
  ],
  [
    "Gage",
    "neutre",
    "Irrecevable budgétairement : l'amendement créerait une charge nouvelle sans indiquer son financement (art. 40).",
  ],
  [
    "Crédits",
    "neutre",
    "Irrecevable : l'amendement réduirait les recettes ou créerait une dépense sans compenser (art. 40 Const.).",
  ],
  [
    "Hors champ",
    "neutre",
    "Irrecevable car l'objet de l'amendement sort du périmètre du texte en discussion.",
  ],
  [
    "Hors-délais",
    "neutre",
    "Irrecevable car déposé après la deadline prévue par le règlement de l'assemblée.",
  ],
  [
    "Injonction (20)",
    "neutre",
    "Irrecevable : l'amendement porte sur une demande d'information ou d'injonction au gouvernement (art. 20 Const.).",
  ],
  [
    "Ordre du jour (48)",
    "neutre",
    "Irrecevable : l'amendement porte sur un sujet non inscrit à l'ordre du jour de la séance (art. 48 Const.).",
  ],
  [
    "Ratification traité (53)",
    "neutre",
    "Irrecevable : l'amendement modifierait un traité de ratification (art. 53 Const.).",
  ],
  [
    "Non soutenu",
    "neutre",
    "L'auteur ne défend pas son amendement lors de la discussion. Il est considéré comme abandonné.",
  ],
  [
    "Satisfait ou inopérant (42)",
    "neutre",
    "L'amendement est sans objet car le texte visé a déjà été adopté dans une version équivalente (art. 42 Règl. AN).",
  ],
  ["Doublon", "neutre", "Amendement identique à un autre déjà déposé ou déjà adopté."],
  [
    "Sous-amendement",
    "neutre",
    "Proposition de modification d'un amendement déjà déposé (art. 98 Règl. AN).",
  ],
  ["A discuter", "neutre", "Amendement en attente de discussion par le président de séance."],
  ["En traitement", "neutre", "Amendement en cours de traitement par les services de l'assemblée."],
];

const SORTS_VISIBLE = 8;

const sortCards: readonly ArticleCard[] = SORTS.map(([label, tone, description]) => ({
  badge: { kind: "libelle", label, tone },
  blocks: [paragraph(description)],
}));

export const dossierLegislatif: ComprendreArticle = {
  slug: "dossier-legislatif",
  title: "Le dossier législatif",
  shortTitle: "Le dossier législatif",
  icon: FileText,
  summary: "De la proposition de loi à la promulgation",
  sections: [
    {
      title: "Le cycle de vie d'une loi",
      blocks: [
        paragraph(
          "De l'idée initiale à la publication au Journal Officiel, un texte de loi traverse plusieurs étapes clés.",
        ),
        {
          type: "steps",
          steps: [
            {
              title: "Initiative",
              description:
                "Un projet de loi (déposé par le gouvernement) ou une proposition de loi (déposée par un parlementaire) est enregistré.",
            },
            {
              title: "Examen en commission",
              description:
                "La commission permanente compétente examine le texte : auditions d'experts, débats, adoption d'amendements, vote en commission.",
            },
            {
              title: "Discussion en séance publique",
              description:
                "Le texte est débattu dans l'hémicycle. Les parlementaires défendent leurs amendements et votent article par article.",
            },
            {
              title: "Navette parlementaire",
              description:
                "Le texte fait des allers-retours entre l'Assemblée nationale et le Sénat jusqu'à accord sur une version identique.",
            },
            {
              title: "Commission mixte paritaire",
              description:
                "En cas de désaccord persistant, 7 députés et 7 sénateurs tentent de trouver un compromis.",
            },
            {
              title: "Promulgation",
              description:
                "Le Président de la République promulgue la loi, qui est publiée au Journal Officiel et entre en vigueur.",
            },
          ],
        },
      ],
    },
    {
      id: "amendements-sort",
      title: "Les amendements",
      blocks: [
        paragraph([
          "Un amendement est une ",
          strong("proposition de modification"),
          " d'un texte de loi. Il peut être déposé par un parlementaire ou par le gouvernement, à n'importe quelle étape de la discussion.",
        ]),
        {
          type: "cards",
          columns: 2,
          cards: sortCards,
          collapsible: {
            visible: SORTS_VISIBLE,
            moreLabel: `Voir ${SORTS.length - SORTS_VISIBLE} autres sorts`,
          },
        },
        paragraph([
          strong("Rectification"),
          " : l'auteur d'un amendement peut le modifier avant le vote. L'amendement modifié est alors marqué comme \"Rect\" dans la numérotation.",
        ]),
      ],
    },
    {
      title: "Les états sur CLAIR",
      blocks: [
        paragraph(
          "Sur CLAIR, chaque dossier législatif affiche un état reflétant l'avancement du texte.",
        ),
        {
          type: "cards",
          columns: 2,
          cards: [
            {
              badge: { kind: "statut", statut: "en_cours" },
              blocks: [paragraph("Le texte est en cours d'examen parlementaire.")],
            },
            {
              badge: { kind: "statut", statut: "adopte" },
              blocks: [paragraph("Le texte a été adopté par les deux chambres.")],
            },
            {
              badge: { kind: "statut", statut: "rejete" },
              blocks: [paragraph("Le texte a été rejeté par l'une des chambres.")],
            },
            {
              badge: { kind: "statut", statut: "promulgue" },
              blocks: [
                paragraph(
                  "La loi a été promulguée par le Président et publiée au Journal Officiel.",
                ),
              ],
            },
          ],
        },
      ],
    },
  ],
  actions: [{ label: "Explorer les dossiers législatifs", href: "/dossiers" }],
};
