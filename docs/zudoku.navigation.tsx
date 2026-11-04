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
        path: "/guide",
        label: "Vue d'ensemble",
        icon: "sparkles",
      },
      {
        type: "doc",
        file: "01-guide/stack-technique.mdx",
        path: "/guide/stack-technique",
        label: "Stack Technique",
        icon: "layers",
      },
      {
        type: "doc",
        file: "01-guide/vision-et-valeurs.mdx",
        path: "/guide/vision-et-valeurs",
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
            path: "/guide/api-reference",
            label: "Vue d'ensemble",
            icon: "code",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/authentification-et-limites.mdx",
            path: "/guide/api-reference/authentification-et-limites",
            label: "Limites & Cache",
            icon: "shield",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/dossiers-et-amendements.mdx",
            path: "/guide/api-reference/dossiers-et-amendements",
            label: "Dossiers & Amendements",
            icon: "file-text",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/exemples-integration.mdx",
            path: "/guide/api-reference/exemples-integration",
            label: "Exemples de Code",
            icon: "code",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/lobbying-hatvp.mdx",
            path: "/guide/api-reference/lobbying-hatvp",
            label: "Lobbying HATVP",
            icon: "building-2",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/parlementaires.mdx",
            path: "/guide/api-reference/parlementaires",
            label: "Parlementaires",
            icon: "users",
          },
          {
            type: "doc",
            file: "01-guide/api-reference/scrutins-et-votes.mdx",
            path: "/guide/api-reference/scrutins-et-votes",
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
            path: "/guide/guide-developpeur",
            label: "Guide Contributeur",
            icon: "rocket",
          },
          {
            type: "doc",
            file: "01-guide/guide-developpeur/contribution.mdx",
            path: "/guide/guide-developpeur/contribution",
            label: "Contribution & Normes",
            icon: "git-pull-request",
          },
          {
            type: "doc",
            file: "01-guide/guide-developpeur/demarrage-local.mdx",
            path: "/guide/guide-developpeur/demarrage-local",
            label: "Démarrage Local",
            icon: "laptop",
          },
          {
            type: "doc",
            file: "01-guide/guide-developpeur/deploiement-production.mdx",
            path: "/guide/guide-developpeur/deploiement-production",
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
        path: "/donnees",
        label: "Vue d'ensemble",
        icon: "database",
      },
      {
        type: "doc",
        file: "02-donnees/commandes-cli.mdx",
        path: "/donnees/commandes-cli",
        label: "Commandes CLI",
        icon: "terminal",
      },
      {
        type: "doc",
        file: "02-donnees/enrichissement-ia.mdx",
        path: "/donnees/enrichissement-ia",
        label: "Enrichissement IA",
        icon: "bot",
      },
      {
        type: "doc",
        file: "02-donnees/modele-prisma.mdx",
        path: "/donnees/modele-prisma",
        label: "Modèle Prisma",
        icon: "database",
      },
      {
        type: "doc",
        file: "02-donnees/orchestrateur-ingestion.mdx",
        path: "/donnees/orchestrateur-ingestion",
        label: "Orchestrateur d'Ingestion",
        icon: "cpu",
      },
      {
        type: "doc",
        file: "02-donnees/qualite-des-donnees.mdx",
        path: "/donnees/qualite-des-donnees",
        label: "Qualité des Données",
        icon: "check-circle",
      },
      {
        type: "doc",
        file: "02-donnees/schemas-erd.mdx",
        path: "/donnees/schemas-erd",
        label: "Schémas ERD",
        icon: "git-fork",
      },
      {
        type: "doc",
        file: "02-donnees/sources-de-donnees.mdx",
        path: "/donnees/sources-de-donnees",
        label: "Sources Open Data",
        icon: "cloud-download",
      },
      {
        type: "doc",
        file: "02-donnees/suivi-des-modifications.mdx",
        path: "/donnees/suivi-des-modifications",
        label: "Suivi des Modifications",
        icon: "history",
      },
    ],
  },
  {
    type: "category",
    label: "Journal des versions",
    icon: "history",
    collapsed: false,
    items: [
      {
        type: "doc",
        file: "03-changelog/index.mdx",
        path: "/changelog",
        label: "Vue d'ensemble",
        icon: "history",
      },
      {
        type: "doc",
        file: "03-changelog/v0-5-0.mdx",
        path: "/changelog/v0-5-0",
        label: "Version v0.5.0",
      },
      {
        type: "doc",
        file: "03-changelog/v0-4-0.mdx",
        path: "/changelog/v0-4-0",
        label: "Version v0.4.0",
      },
      {
        type: "doc",
        file: "03-changelog/v0-3-0.mdx",
        path: "/changelog/v0-3-0",
        label: "Version v0.3.0",
      },
      {
        type: "doc",
        file: "03-changelog/v0-2-0.mdx",
        path: "/changelog/v0-2-0",
        label: "Version v0.2.0",
      },
      {
        type: "doc",
        file: "03-changelog/v0-1-0.mdx",
        path: "/changelog/v0-1-0",
        label: "Version v0.1.0",
      },
    ],
  },
  {
    type: "category",
    label: "Explorateur API",
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
    to: "/guide",
  },
  {
    from: "/01-introduction/vision-et-valeurs",
    to: "/guide/vision-et-valeurs",
  },
  {
    from: "/01-introduction/stack-technique",
    to: "/guide/stack-technique",
  },
  {
    from: "/stack",
    to: "/guide/stack-technique",
  },
  {
    from: "/sources",
    to: "/donnees/sources-de-donnees",
  },
  {
    from: "/02-donnees-et-sources",
    to: "/donnees",
  },
  {
    from: "/02-donnees-et-sources/sources-de-donnees",
    to: "/donnees/sources-de-donnees",
  },
  {
    from: "/02-donnees-et-sources/orchestrateur-ingestion",
    to: "/donnees/orchestrateur-ingestion",
  },
  {
    from: "/02-donnees-et-sources/commandes-cli",
    to: "/donnees/commandes-cli",
  },
  {
    from: "/02-donnees-et-sources/qualite-des-donnees",
    to: "/donnees/qualite-des-donnees",
  },
  {
    from: "/02-donnees-et-sources/enrichissement-ia",
    to: "/donnees/enrichissement-ia",
  },
  {
    from: "/ingestion",
    to: "/donnees/orchestrateur-ingestion",
  },
  {
    from: "/cli",
    to: "/donnees/commandes-cli",
  },
  {
    from: "/qualite",
    to: "/donnees/qualite-des-donnees",
  },
  {
    from: "/ia",
    to: "/donnees/enrichissement-ia",
  },
  {
    from: "/03-base-de-donnees",
    to: "/donnees",
  },
  {
    from: "/03-base-de-donnees/modele-prisma",
    to: "/donnees/modele-prisma",
  },
  {
    from: "/03-base-de-donnees/schemas-erd",
    to: "/donnees/schemas-erd",
  },
  {
    from: "/bdd",
    to: "/donnees/modele-prisma",
  },
  {
    from: "/erd",
    to: "/donnees/schemas-erd",
  },
  {
    from: "/04-api-reference",
    to: "/guide/api-reference",
  },
  {
    from: "/04-api-reference/authentification-et-limites",
    to: "/guide/api-reference/authentification-et-limites",
  },
  {
    from: "/04-api-reference/parlementaires",
    to: "/guide/api-reference/parlementaires",
  },
  {
    from: "/04-api-reference/scrutins-et-votes",
    to: "/guide/api-reference/scrutins-et-votes",
  },
  {
    from: "/04-api-reference/dossiers-et-amendements",
    to: "/guide/api-reference/dossiers-et-amendements",
  },
  {
    from: "/04-api-reference/lobbying-hatvp",
    to: "/guide/api-reference/lobbying-hatvp",
  },
  {
    from: "/04-api-reference/exemples-integration",
    to: "/guide/api-reference/exemples-integration",
  },
  {
    from: "/05-guide-developpeur",
    to: "/guide/guide-developpeur",
  },
  {
    from: "/05-guide-developpeur/demarrage-local",
    to: "/guide/guide-developpeur/demarrage-local",
  },
  {
    from: "/05-guide-developpeur/deploiement-production",
    to: "/guide/guide-developpeur/deploiement-production",
  },
  {
    from: "/05-guide-developpeur/contribution",
    to: "/guide/guide-developpeur/contribution",
  },
  {
    from: "/deploiement",
    to: "/guide/guide-developpeur/deploiement-production",
  },
  {
    from: "/demarrage",
    to: "/guide/guide-developpeur/demarrage-local",
  },
  {
    from: "/01-guide",
    to: "/guide",
  },
  {
    from: "/01-guide/stack-technique",
    to: "/guide/stack-technique",
  },
  {
    from: "/01-guide/vision-et-valeurs",
    to: "/guide/vision-et-valeurs",
  },
  {
    from: "/01-guide/api-reference",
    to: "/guide/api-reference",
  },
  {
    from: "/01-guide/api-reference/authentification-et-limites",
    to: "/guide/api-reference/authentification-et-limites",
  },
  {
    from: "/01-guide/api-reference/dossiers-et-amendements",
    to: "/guide/api-reference/dossiers-et-amendements",
  },
  {
    from: "/01-guide/api-reference/exemples-integration",
    to: "/guide/api-reference/exemples-integration",
  },
  {
    from: "/01-guide/api-reference/lobbying-hatvp",
    to: "/guide/api-reference/lobbying-hatvp",
  },
  {
    from: "/01-guide/api-reference/parlementaires",
    to: "/guide/api-reference/parlementaires",
  },
  {
    from: "/01-guide/api-reference/scrutins-et-votes",
    to: "/guide/api-reference/scrutins-et-votes",
  },
  {
    from: "/01-guide/guide-developpeur",
    to: "/guide/guide-developpeur",
  },
  {
    from: "/01-guide/guide-developpeur/contribution",
    to: "/guide/guide-developpeur/contribution",
  },
  {
    from: "/01-guide/guide-developpeur/demarrage-local",
    to: "/guide/guide-developpeur/demarrage-local",
  },
  {
    from: "/01-guide/guide-developpeur/deploiement-production",
    to: "/guide/guide-developpeur/deploiement-production",
  },
  {
    from: "/02-donnees",
    to: "/donnees",
  },
  {
    from: "/02-donnees/commandes-cli",
    to: "/donnees/commandes-cli",
  },
  {
    from: "/02-donnees/enrichissement-ia",
    to: "/donnees/enrichissement-ia",
  },
  {
    from: "/02-donnees/modele-prisma",
    to: "/donnees/modele-prisma",
  },
  {
    from: "/02-donnees/orchestrateur-ingestion",
    to: "/donnees/orchestrateur-ingestion",
  },
  {
    from: "/02-donnees/qualite-des-donnees",
    to: "/donnees/qualite-des-donnees",
  },
  {
    from: "/02-donnees/schemas-erd",
    to: "/donnees/schemas-erd",
  },
  {
    from: "/02-donnees/sources-de-donnees",
    to: "/donnees/sources-de-donnees",
  },
  {
    from: "/02-donnees/suivi-des-modifications",
    to: "/donnees/suivi-des-modifications",
  },
  {
    from: "/03-changelog",
    to: "/changelog",
  },
  {
    from: "/03-changelog/v0-5-0",
    to: "/changelog/v0-5-0",
  },
  {
    from: "/03-changelog/v0-4-0",
    to: "/changelog/v0-4-0",
  },
  {
    from: "/03-changelog/v0-3-0",
    to: "/changelog/v0-3-0",
  },
  {
    from: "/03-changelog/v0-2-0",
    to: "/changelog/v0-2-0",
  },
  {
    from: "/03-changelog/v0-1-0",
    to: "/changelog/v0-1-0",
  },
];
