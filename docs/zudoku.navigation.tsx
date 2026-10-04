import type { ZudokuConfig } from "zudoku";

export const docsNavigation: ZudokuConfig["navigation"] = [
  {
    type: "doc",
    file: "index.mdx",
    path: "/",
    label: "Accueil",
    icon: "home",
  },
  {
    type: "category",
    label: "Plateforme & Guide",
    icon: "rocket",
    collapsed: false,
    items: [
      {
        type: "doc",
        file: "01-guide/index.mdx",
        path: "/01-guide",
        label: "Vue d'ensemble",
        icon: "sparkles",
      },
      {
        type: "doc",
        file: "01-guide/stack-technique.mdx",
        path: "/01-guide/stack-technique",
        label: "Stack Technique",
        icon: "layers",
      },
      {
        type: "doc",
        file: "01-guide/vision-et-valeurs.mdx",
        path: "/01-guide/vision-et-valeurs",
        label: "Vision & Valeurs",
        icon: "scale",
      },
      {
        type: "category",
        label: "Référence API",
        icon: "folder",
        collapsed: false,
        items: [
          {
            type: "doc",
            file: "01-guide/api-reference/index.mdx",
            path: "/01-guide/api-reference",
            label: "Vue d'ensemble",
            icon: "code",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/authentification-et-limites.mdx",
            path: "/01-guide/api-reference/authentification-et-limites",
            label: "Limites & Cache",
            icon: "shield",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/dossiers-et-amendements.mdx",
            path: "/01-guide/api-reference/dossiers-et-amendements",
            label: "Dossiers & Amendements",
            icon: "file-text",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/exemples-integration.mdx",
            path: "/01-guide/api-reference/exemples-integration",
            label: "Exemples de Code",
            icon: "code",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/lobbying-hatvp.mdx",
            path: "/01-guide/api-reference/lobbying-hatvp",
            label: "Lobbying HATVP",
            icon: "building-2",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/parlementaires.mdx",
            path: "/01-guide/api-reference/parlementaires",
            label: "Parlementaires",
            icon: "users",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/scrutins-et-votes.mdx",
            path: "/01-guide/api-reference/scrutins-et-votes",
            label: "Scrutins & Votes",
            icon: "check-square",
          },
        ],
      },
      {
        type: "category",
        label: "Guide Développeur",
        icon: "folder",
        collapsed: false,
        items: [
          {
            type: "doc",
            file: "01-guide/guide-developpeur/index.mdx",
            path: "/01-guide/guide-developpeur",
            label: "Guide Contributeur",
            icon: "rocket",
          },
          {
            type: "doc",
            file: "01-guide/guide-developpeur/contribution.mdx",
            path: "/01-guide/guide-developpeur/contribution",
            label: "Contribution & Normes",
            icon: "git-pull-request",
          },
          {
            type: "doc",
            file: "01-guide/guide-developpeur/demarrage-local.mdx",
            path: "/01-guide/guide-developpeur/demarrage-local",
            label: "Démarrage Local",
            icon: "laptop",
          },
          {
            type: "doc",
            file: "01-guide/guide-developpeur/deploiement-production.mdx",
            path: "/01-guide/guide-developpeur/deploiement-production",
            label: "Déploiement Production",
            icon: "cloud",
          },
        ],
      },
    ],
  },
  {
    type: "category",
    label: "Données & Base de Données",
    icon: "database",
    collapsed: false,
    items: [
      {
        type: "doc",
        file: "02-donnees/index.mdx",
        path: "/02-donnees",
        label: "Vue d'ensemble",
        icon: "database",
      },
      {
        type: "doc",
        file: "02-donnees/commandes-cli.mdx",
        path: "/02-donnees/commandes-cli",
        label: "Commandes CLI",
        icon: "terminal",
      },
      {
        type: "doc",
        file: "02-donnees/enrichissement-ia.mdx",
        path: "/02-donnees/enrichissement-ia",
        label: "Enrichissement IA",
        icon: "bot",
      },
      {
        type: "doc",
        file: "02-donnees/modele-prisma.mdx",
        path: "/02-donnees/modele-prisma",
        label: "Modèle Prisma",
        icon: "database",
      },
      {
        type: "doc",
        file: "02-donnees/orchestrateur-ingestion.mdx",
        path: "/02-donnees/orchestrateur-ingestion",
        label: "Orchestrateur d'Ingestion",
        icon: "cpu",
      },
      {
        type: "doc",
        file: "02-donnees/qualite-des-donnees.mdx",
        path: "/02-donnees/qualite-des-donnees",
        label: "Qualité des Données",
        icon: "check-circle",
      },
      {
        type: "doc",
        file: "02-donnees/schemas-erd.mdx",
        path: "/02-donnees/schemas-erd",
        label: "Schémas ERD",
        icon: "git-fork",
      },
      {
        type: "doc",
        file: "02-donnees/sources-de-donnees.mdx",
        path: "/02-donnees/sources-de-donnees",
        label: "Sources Open Data",
        icon: "cloud-download",
      },
    ],
  },
  {
    type: "category",
    label: "Explorateur Swagger (API)",
    icon: "code",
    collapsed: false,
    items: [
      {
        type: "link",
        label: "API CLAIR (api.clair.vote)",
        to: "/api",
        icon: "terminal",
      },
    ],
  },
];

export const docsRedirects: ZudokuConfig["redirects"] = [
  {
    from: "/home",
    to: "/",
  },
  {
    from: "/accueil",
    to: "/",
  },
  {
    from: "/01-introduction",
    to: "/01-guide",
  },
  {
    from: "/01-introduction/vision-et-valeurs",
    to: "/01-guide/vision-et-valeurs",
  },
  {
    from: "/01-introduction/stack-technique",
    to: "/01-guide/stack-technique",
  },
  {
    from: "/stack",
    to: "/01-guide/stack-technique",
  },
  {
    from: "/sources",
    to: "/02-donnees/sources-de-donnees",
  },
  {
    from: "/02-donnees-et-sources",
    to: "/02-donnees",
  },
  {
    from: "/02-donnees-et-sources/sources-de-donnees",
    to: "/02-donnees/sources-de-donnees",
  },
  {
    from: "/02-donnees-et-sources/orchestrateur-ingestion",
    to: "/02-donnees/orchestrateur-ingestion",
  },
  {
    from: "/02-donnees-et-sources/commandes-cli",
    to: "/02-donnees/commandes-cli",
  },
  {
    from: "/02-donnees-et-sources/qualite-des-donnees",
    to: "/02-donnees/qualite-des-donnees",
  },
  {
    from: "/02-donnees-et-sources/enrichissement-ia",
    to: "/02-donnees/enrichissement-ia",
  },
  {
    from: "/ingestion",
    to: "/02-donnees/orchestrateur-ingestion",
  },
  {
    from: "/cli",
    to: "/02-donnees/commandes-cli",
  },
  {
    from: "/qualite",
    to: "/02-donnees/qualite-des-donnees",
  },
  {
    from: "/ia",
    to: "/02-donnees/enrichissement-ia",
  },
  {
    from: "/03-base-de-donnees",
    to: "/02-donnees",
  },
  {
    from: "/03-base-de-donnees/modele-prisma",
    to: "/02-donnees/modele-prisma",
  },
  {
    from: "/03-base-de-donnees/schemas-erd",
    to: "/02-donnees/schemas-erd",
  },
  {
    from: "/bdd",
    to: "/02-donnees/modele-prisma",
  },
  {
    from: "/erd",
    to: "/02-donnees/schemas-erd",
  },
  {
    from: "/04-api-reference",
    to: "/01-guide/api-reference",
  },
  {
    from: "/04-api-reference/authentification-et-limites",
    to: "/01-guide/api-reference/authentification-et-limites",
  },
  {
    from: "/04-api-reference/parlementaires",
    to: "/01-guide/api-reference/parlementaires",
  },
  {
    from: "/04-api-reference/scrutins-et-votes",
    to: "/01-guide/api-reference/scrutins-et-votes",
  },
  {
    from: "/04-api-reference/dossiers-et-amendements",
    to: "/01-guide/api-reference/dossiers-et-amendements",
  },
  {
    from: "/04-api-reference/lobbying-hatvp",
    to: "/01-guide/api-reference/lobbying-hatvp",
  },
  {
    from: "/04-api-reference/exemples-integration",
    to: "/01-guide/api-reference/exemples-integration",
  },
  {
    from: "/05-guide-developpeur",
    to: "/01-guide/guide-developpeur",
  },
  {
    from: "/05-guide-developpeur/demarrage-local",
    to: "/01-guide/guide-developpeur/demarrage-local",
  },
  {
    from: "/05-guide-developpeur/deploiement-production",
    to: "/01-guide/guide-developpeur/deploiement-production",
  },
  {
    from: "/05-guide-developpeur/contribution",
    to: "/01-guide/guide-developpeur/contribution",
  },
  {
    from: "/deploiement",
    to: "/01-guide/guide-developpeur/deploiement-production",
  },
  {
    from: "/demarrage",
    to: "/01-guide/guide-developpeur/demarrage-local",
  },
];
