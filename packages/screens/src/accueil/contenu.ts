import type { HomepageStats } from "@clair/data";

/** Contenu éditorial de la page d'accueil (repris de apps/web/app/page.tsx). */

export const GITHUB_URL = "https://github.com/accelaire/CLAIR";
export const CONTRIBUTION_GUIDE_URL =
  "https://docs.clair.vote/guide/guide-developpeur/contribution";
export const CONTACT_EMAIL = "contact@clair.vote";

type CleStat = Exclude<keyof HomepageStats, "deputesTotal" | "senateursTotal">;

export type ChiffreCle = {
  cle: CleStat;
  label: string;
  href: string;
  /** Compte toutes législatures confondues, affiché « … au total ». */
  cleTotal?: "deputesTotal" | "senateursTotal";
};

/** Chiffres clés, dans l'ordre de apps/web. */
export const CHIFFRES_CLES: readonly ChiffreCle[] = [
  { cle: "deputes", label: "Députés", href: "/deputes", cleTotal: "deputesTotal" },
  { cle: "senateurs", label: "Sénateurs", href: "/senateurs", cleTotal: "senateursTotal" },
  { cle: "scrutins", label: "Scrutins", href: "/scrutins" },
  { cle: "dossiers", label: "Dossiers", href: "/dossiers" },
  { cle: "interventions", label: "Interventions", href: "/deputes" },
  { cle: "amendements", label: "Amendements", href: "/scrutins" },
  { cle: "lobbyistes", label: "Lobbyistes", href: "/lobbying" },
  { cle: "actionsLobby", label: "Actions lobby", href: "/lobbying" },
];

export type Fonctionnalite = {
  id: "deputes" | "senateurs" | "groupes";
  titre: string;
  description: string;
  action: string;
  href: string;
};

export const FONCTIONNALITES: readonly Fonctionnalite[] = [
  {
    id: "deputes",
    titre: "Députés",
    description: "Votes, présence, loyauté au groupe... Tout savoir sur votre député.",
    action: "Trouver un député",
    href: "/deputes",
  },
  {
    id: "senateurs",
    titre: "Sénateurs",
    description: "Découvrez l'activité des 348 sénateurs de la République.",
    action: "Trouver un sénateur",
    href: "/senateurs",
  },
  {
    id: "groupes",
    titre: "Groupes parlementaires",
    description: "Explorez les groupes politiques de l'Assemblée et du Sénat.",
    action: "Trouver un groupe",
    href: "/groupes",
  },
];

export type Theme = { titre: string; description: string; href: string };

export const THEMES_COMPRENDRE: readonly Theme[] = [
  {
    titre: "Le Parlement",
    description:
      "Assemblée nationale et Sénat : découvrez les deux chambres du Parlement, leurs différences et comment elles votent les lois ensemble.",
    href: "/comprendre/parlement",
  },
  {
    titre: "Le parlementaire",
    description:
      "Mandat, circonscription, groupe politique... Comprenez le rôle d'un député ou sénateur, comment il est élu et ses missions.",
    href: "/comprendre/parlementaire",
  },
  {
    titre: "Le scrutin",
    description:
      "Comment se déroule un vote au Parlement ? Apprenez à distinguer les différents types de scrutins et à décrypter les résultats des votes.",
    href: "/comprendre/scrutin",
  },
  {
    titre: "Le dossier législatif",
    description:
      "De la proposition à la promulgation : suivez le parcours d'un texte de loi à travers les différentes étapes du processus parlementaire.",
    href: "/comprendre/dossier-legislatif",
  },
  {
    titre: "Les groupes politiques",
    description:
      "Parti vs groupe parlementaire : comprenez la différence, comment se forment les alliances et leur impact sur les votes à l'Assemblée.",
    href: "/comprendre/groupes-politiques",
  },
  {
    titre: "Le lobbying",
    description:
      "Représentants d'intérêts, HATVP, déclarations... Découvrez qui peut influencer les parlementaires et comment c'est encadré.",
    href: "/comprendre/lobbying",
  },
];

/**
 * Questions fréquentes. Une réponse est une suite de paragraphes ; un paragraphe mêle texte et
 * liens internes (`{ texte, href }`).
 */
export type Morceau = string | { texte: string; href: string };
export type QuestionFrequente = { question: string; paragraphes: Morceau[][] };

export const QUESTIONS_FREQUENTES: readonly QuestionFrequente[] = [
  {
    question: "Quel est l'objectif de CLAIR ?",
    paragraphes: [
      [
        "La transparence politique est un pilier de la démocratie. Pourtant, les données sur l'activité de nos élus sont dispersées, difficiles d'accès et souvent incompréhensibles pour le citoyen lambda.",
      ],
      [
        "CLAIR rassemble ces informations publiques en un seul endroit, les structure, et les présente de manière claire et accessible. Notre objectif : permettre à chaque citoyen de comprendre ce que font ses représentants, comment ils votent, et qui cherche à les influencer.",
      ],
    ],
  },
  {
    question: "Pourquoi CLAIR plutôt que les sites de l'Assemblée nationale ou du Sénat ?",
    paragraphes: [
      [
        "Les sites institutionnels sont des références indispensables, et CLAIR s'en inspire. Mais chacun se concentre sur sa propre chambre : il faut naviguer entre assemblee-nationale.fr et senat.fr pour suivre un même texte de loi.",
      ],
      [
        "CLAIR réunit les données des deux chambres en un seul endroit, et y ajoute les données de lobbying (HATVP). Vous pouvez comparer les votes entre députés et sénateurs, croiser les amendements avec les scrutins, et suivre l'ensemble du parcours législatif sur une même page.",
      ],
    ],
  },
  {
    question: "Ai-je besoin de connaissances poussées sur le parlement pour comprendre ?",
    paragraphes: [
      [
        "Pas du tout ! CLAIR a pour vocation de rendre les données parlementaires accessibles au plus grand nombre. Si un terme vous échappe, consultez notre section ",
        { texte: "Comprendre", href: "/comprendre" },
        " qui explique simplement le fonctionnement des institutions. Et pour apprendre à utiliser la plateforme, suivez notre ",
        { texte: "Guide pratique", href: "/guide" },
        " pas à pas.",
      ],
    ],
  },
  {
    question: "D'où viennent les données qui figurent sur CLAIR ?",
    paragraphes: [
      [
        "Toutes nos données proviennent de sources officielles et publiques : l'Assemblée nationale (open data), le Sénat, la Haute Autorité pour la Transparence de la Vie Publique (HATVP) et la Direction de l'Information Légale et Administrative (DILA). Ces données sont disponibles sous Licence Ouverte. Pour en savoir plus, consultez notre page ",
        { texte: "Méthodologie", href: "/methodologie" },
        ".",
      ],
    ],
  },
  {
    question: "À quelle fréquence les données sont-elles mises à jour ?",
    paragraphes: [
      [
        "Les votes, interventions et amendements sont synchronisés quotidiennement. Les données de lobbying (HATVP) sont mises à jour de façon hebdomadaire. Un léger délai de 24 à 48h peut exister entre la publication des données par les sources officielles et leur apparition sur CLAIR.",
      ],
    ],
  },
  {
    question: "Qui est derrière le projet CLAIR ?",
    paragraphes: [
      [
        "CLAIR est un projet citoyen indépendant, entièrement open-source. Il n'est financé par aucun parti politique, syndicat ou entreprise. Le code source est disponible sur GitHub et les contributions sont les bienvenues.",
      ],
    ],
  },
];
