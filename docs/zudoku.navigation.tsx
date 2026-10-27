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
    label: "Front",
    icon: "layout-template",
    collapsed: false,
    items: [
      {
        type: "doc",
        file: "04-front/index.mdx",
        path: "/front",
        label: "Vue d'ensemble",
        icon: "layout-template",
      },
      {
        type: "category",
        label: "Architecture",
        icon: "network",
        collapsed: false,
        items: [
          {
            type: "doc",
            file: "04-front/01-architecture/index.mdx",
            path: "/front/architecture",
            label: "Vue d'ensemble",
            icon: "network",
          },
          {
            type: "doc",
            file: "04-front/01-architecture/01-pages.mdx",
            path: "/front/architecture/pages",
            label: "Pages et écrans",
            icon: "layout-dashboard",
          },
          {
            type: "doc",
            file: "04-front/01-architecture/02-donnees.mdx",
            path: "/front/architecture/donnees",
            label: "Données",
            icon: "database",
          },
          {
            type: "doc",
            file: "04-front/01-architecture/03-tests.mdx",
            path: "/front/architecture/tests",
            label: "Tests",
            icon: "flask-conical",
          },
          {
            type: "doc",
            file: "04-front/01-architecture/04-deploiement.mdx",
            path: "/front/architecture/deploiement",
            label: "Déploiement",
            icon: "rocket",
          },
        ],
      },
      {
        type: "category",
        label: "Design system",
        icon: "palette",
        collapsed: false,
        items: [
          {
            type: "doc",
            file: "04-front/02-design-system/index.mdx",
            path: "/front/design-system",
            label: "Principes",
            icon: "palette",
          },
          {
            type: "doc",
            file: "04-front/02-design-system/01-couleurs.mdx",
            path: "/front/design-system/couleurs",
            label: "Couleurs",
            icon: "swatch-book",
          },
          {
            type: "doc",
            file: "04-front/02-design-system/02-typographie.mdx",
            path: "/front/design-system/typographie",
            label: "Typographie",
            icon: "type",
          },
          {
            type: "doc",
            file: "04-front/02-design-system/03-espacements.mdx",
            path: "/front/design-system/espacements",
            label: "Espacements",
            icon: "ruler",
          },
        ],
      },
      {
        type: "category",
        label: "Composants",
        icon: "blocks",
        collapsed: false,
        items: [
          {
            type: "doc",
            file: "04-front/03-composants/index.mdx",
            path: "/front/composants",
            label: "Catalogue",
            icon: "blocks",
          },
          {
            type: "category",
            label: "Fondations",
            icon: "brick-wall",
            collapsed: false,
            items: [
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/aide.mdx",
                path: "/front/composants/fondations/aide",
                label: "Aide",
                icon: "circle-question-mark",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/badge.mdx",
                path: "/front/composants/fondations/badge",
                label: "Badge",
                icon: "tag",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/button.mdx",
                path: "/front/composants/fondations/button",
                label: "Button",
                icon: "mouse-pointer-click",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/callout.mdx",
                path: "/front/composants/fondations/callout",
                label: "Callout",
                icon: "megaphone",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/card.mdx",
                path: "/front/composants/fondations/card",
                label: "Card",
                icon: "square",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/chambre-badge.mdx",
                path: "/front/composants/fondations/chambre-badge",
                label: "ChambreBadge",
                icon: "landmark",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/expandable-text.mdx",
                path: "/front/composants/fondations/expandable-text",
                label: "ExpandableText",
                icon: "text-align-start",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/faq.mdx",
                path: "/front/composants/fondations/faq",
                label: "Faq",
                icon: "messages-square",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/link.mdx",
                path: "/front/composants/fondations/link",
                label: "Link",
                icon: "link",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/provenance-label.mdx",
                path: "/front/composants/fondations/provenance-label",
                label: "ProvenanceLabel",
                icon: "badge-check",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/query-states.mdx",
                path: "/front/composants/fondations/query-states",
                label: "QueryStates",
                icon: "loader",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/skip-link.mdx",
                path: "/front/composants/fondations/skip-link",
                label: "SkipLink",
                icon: "skip-forward",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/stat-card.mdx",
                path: "/front/composants/fondations/stat-card",
                label: "StatCard",
                icon: "hash",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/statut-badge.mdx",
                path: "/front/composants/fondations/statut-badge",
                label: "StatutBadge",
                icon: "gavel",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/theme-toggle.mdx",
                path: "/front/composants/fondations/theme-toggle",
                label: "ThemeToggle",
                icon: "sun-moon",
              },
              {
                type: "doc",
                file: "04-front/03-composants/01-fondations/vote-position.mdx",
                path: "/front/composants/fondations/vote-position",
                label: "VotePosition",
                icon: "vote",
              },
            ],
          },
          {
            type: "category",
            label: "Mise en page",
            icon: "panels-top-left",
            collapsed: false,
            items: [
              {
                type: "doc",
                file: "04-front/03-composants/02-mise-en-page/app-shell.mdx",
                path: "/front/composants/mise-en-page/app-shell",
                label: "AppShell",
                icon: "app-window",
              },
              {
                type: "doc",
                file: "04-front/03-composants/02-mise-en-page/bandeau.mdx",
                path: "/front/composants/mise-en-page/bandeau",
                label: "Bandeau",
                icon: "megaphone",
              },
              {
                type: "doc",
                file: "04-front/03-composants/02-mise-en-page/container.mdx",
                path: "/front/composants/mise-en-page/container",
                label: "Container",
                icon: "box",
              },
              {
                type: "doc",
                file: "04-front/03-composants/02-mise-en-page/footer.mdx",
                path: "/front/composants/mise-en-page/footer",
                label: "Footer",
                icon: "panel-bottom",
              },
              {
                type: "doc",
                file: "04-front/03-composants/02-mise-en-page/header.mdx",
                path: "/front/composants/mise-en-page/header",
                label: "Header",
                icon: "panel-top",
              },
              {
                type: "doc",
                file: "04-front/03-composants/02-mise-en-page/page-header.mdx",
                path: "/front/composants/mise-en-page/page-header",
                label: "PageHeader",
                icon: "heading-1",
              },
              {
                type: "doc",
                file: "04-front/03-composants/02-mise-en-page/pagination.mdx",
                path: "/front/composants/mise-en-page/pagination",
                label: "Pagination",
                icon: "chevrons-left-right",
              },
              {
                type: "doc",
                file: "04-front/03-composants/02-mise-en-page/section-header.mdx",
                path: "/front/composants/mise-en-page/section-header",
                label: "SectionHeader",
                icon: "heading-2",
              },
              {
                type: "doc",
                file: "04-front/03-composants/02-mise-en-page/share-button.mdx",
                path: "/front/composants/mise-en-page/share-button",
                label: "ShareButton",
                icon: "share-2",
              },
              {
                type: "doc",
                file: "04-front/03-composants/02-mise-en-page/tabs.mdx",
                path: "/front/composants/mise-en-page/tabs",
                label: "Tabs",
                icon: "layout-panel-top",
              },
            ],
          },
          {
            type: "category",
            label: "Filtres",
            icon: "filter",
            collapsed: false,
            items: [
              {
                type: "doc",
                file: "04-front/03-composants/03-filtres/calendrier-mois.mdx",
                path: "/front/composants/filtres/calendrier-mois",
                label: "CalendrierMois",
                icon: "calendar-days",
              },
              {
                type: "doc",
                file: "04-front/03-composants/03-filtres/chambre-switch.mdx",
                path: "/front/composants/filtres/chambre-switch",
                label: "ChambreSwitch",
                icon: "landmark",
              },
              {
                type: "doc",
                file: "04-front/03-composants/03-filtres/comparison-bar.mdx",
                path: "/front/composants/filtres/comparison-bar",
                label: "ComparisonBar",
                icon: "git-compare-arrows",
              },
              {
                type: "doc",
                file: "04-front/03-composants/03-filtres/date-range-picker.mdx",
                path: "/front/composants/filtres/date-range-picker",
                label: "DateRangePicker",
                icon: "calendar-range",
              },
              {
                type: "doc",
                file: "04-front/03-composants/03-filtres/filter-bar.mdx",
                path: "/front/composants/filtres/filter-bar",
                label: "FilterBar",
                icon: "sliders-horizontal",
              },
              {
                type: "doc",
                file: "04-front/03-composants/03-filtres/multi-select-filter.mdx",
                path: "/front/composants/filtres/multi-select-filter",
                label: "MultiSelectFilter",
                icon: "list-filter",
              },
              {
                type: "doc",
                file: "04-front/03-composants/03-filtres/search-input.mdx",
                path: "/front/composants/filtres/search-input",
                label: "SearchInput",
                icon: "search",
              },
              {
                type: "doc",
                file: "04-front/03-composants/03-filtres/sort-select.mdx",
                path: "/front/composants/filtres/sort-select",
                label: "SortSelect",
                icon: "arrow-up-down",
              },
            ],
          },
          {
            type: "category",
            label: "Parlementaire",
            icon: "landmark",
            collapsed: false,
            items: [
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/amendement-card.mdx",
                path: "/front/composants/parlementaire/amendement-card",
                label: "AmendementCard",
                icon: "file-pen-line",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/data-table.mdx",
                path: "/front/composants/parlementaire/data-table",
                label: "DataTable",
                icon: "table",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/dossier-card.mdx",
                path: "/front/composants/parlementaire/dossier-card",
                label: "DossierCard",
                icon: "folder-open",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/evenement-card.mdx",
                path: "/front/composants/parlementaire/evenement-card",
                label: "EvenementCard",
                icon: "calendar-days",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/groupe-badge.mdx",
                path: "/front/composants/parlementaire/groupe-badge",
                label: "GroupeBadge",
                icon: "circle-dot",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/legislative-timeline.mdx",
                path: "/front/composants/parlementaire/legislative-timeline",
                label: "LegislativeTimeline",
                icon: "milestone",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/lobbyiste-logo.mdx",
                path: "/front/composants/parlementaire/lobbyiste-logo",
                label: "LobbyisteLogo",
                icon: "building-2",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/mandats-timeline.mdx",
                path: "/front/composants/parlementaire/mandats-timeline",
                label: "MandatsTimeline",
                icon: "briefcase",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/parlementaire-avatar.mdx",
                path: "/front/composants/parlementaire/parlementaire-avatar",
                label: "ParlementaireAvatar",
                icon: "circle-user",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/parlementaire-card.mdx",
                path: "/front/composants/parlementaire/parlementaire-card",
                label: "ParlementaireCard",
                icon: "id-card",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/resultat-vote.mdx",
                path: "/front/composants/parlementaire/resultat-vote",
                label: "ResultatVote",
                icon: "chart-bar-stacked",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/scrutin-card.mdx",
                path: "/front/composants/parlementaire/scrutin-card",
                label: "ScrutinCard",
                icon: "vote",
              },
              {
                type: "doc",
                file: "04-front/03-composants/04-parlementaire/top-flop.mdx",
                path: "/front/composants/parlementaire/top-flop",
                label: "TopFlop",
                icon: "list-ordered",
              },
            ],
          },
          {
            type: "category",
            label: "Graphiques",
            icon: "chart-column",
            collapsed: false,
            items: [
              {
                type: "doc",
                file: "04-front/03-composants/05-graphiques/bar-chart.mdx",
                path: "/front/composants/graphiques/bar-chart",
                label: "BarChart",
                icon: "chart-column",
              },
              {
                type: "doc",
                file: "04-front/03-composants/05-graphiques/chart-frame.mdx",
                path: "/front/composants/graphiques/chart-frame",
                label: "ChartFrame",
                icon: "frame",
              },
              {
                type: "doc",
                file: "04-front/03-composants/05-graphiques/hemicycle.mdx",
                path: "/front/composants/graphiques/hemicycle",
                label: "Hemicycle",
                icon: "landmark",
              },
            ],
          },
        ],
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
  {
    from: "/04-front",
    to: "/front",
  },
  {
    from: "/04-front/01-architecture",
    to: "/front/architecture",
  },
  {
    from: "/04-front/01-architecture/01-pages",
    to: "/front/architecture/pages",
  },
  {
    from: "/04-front/01-architecture/02-donnees",
    to: "/front/architecture/donnees",
  },
  {
    from: "/04-front/01-architecture/03-tests",
    to: "/front/architecture/tests",
  },
  {
    from: "/04-front/01-architecture/04-deploiement",
    to: "/front/architecture/deploiement",
  },
  {
    from: "/04-front/02-design-system",
    to: "/front/design-system",
  },
  {
    from: "/04-front/02-design-system/01-couleurs",
    to: "/front/design-system/couleurs",
  },
  {
    from: "/04-front/02-design-system/02-typographie",
    to: "/front/design-system/typographie",
  },
  {
    from: "/04-front/02-design-system/03-espacements",
    to: "/front/design-system/espacements",
  },
  {
    from: "/04-front/03-composants",
    to: "/front/composants",
  },
  {
    from: "/04-front/03-composants/01-fondations/aide",
    to: "/front/composants/fondations/aide",
  },
  {
    from: "/04-front/03-composants/01-fondations/badge",
    to: "/front/composants/fondations/badge",
  },
  {
    from: "/04-front/03-composants/01-fondations/button",
    to: "/front/composants/fondations/button",
  },
  {
    from: "/04-front/03-composants/01-fondations/callout",
    to: "/front/composants/fondations/callout",
  },
  {
    from: "/04-front/03-composants/01-fondations/card",
    to: "/front/composants/fondations/card",
  },
  {
    from: "/04-front/03-composants/01-fondations/chambre-badge",
    to: "/front/composants/fondations/chambre-badge",
  },
  {
    from: "/04-front/03-composants/01-fondations/expandable-text",
    to: "/front/composants/fondations/expandable-text",
  },
  {
    from: "/04-front/03-composants/01-fondations/faq",
    to: "/front/composants/fondations/faq",
  },
  {
    from: "/04-front/03-composants/01-fondations/link",
    to: "/front/composants/fondations/link",
  },
  {
    from: "/04-front/03-composants/01-fondations/provenance-label",
    to: "/front/composants/fondations/provenance-label",
  },
  {
    from: "/04-front/03-composants/01-fondations/query-states",
    to: "/front/composants/fondations/query-states",
  },
  {
    from: "/04-front/03-composants/01-fondations/skip-link",
    to: "/front/composants/fondations/skip-link",
  },
  {
    from: "/04-front/03-composants/01-fondations/stat-card",
    to: "/front/composants/fondations/stat-card",
  },
  {
    from: "/04-front/03-composants/01-fondations/statut-badge",
    to: "/front/composants/fondations/statut-badge",
  },
  {
    from: "/04-front/03-composants/01-fondations/theme-toggle",
    to: "/front/composants/fondations/theme-toggle",
  },
  {
    from: "/04-front/03-composants/01-fondations/vote-position",
    to: "/front/composants/fondations/vote-position",
  },
  {
    from: "/04-front/03-composants/02-mise-en-page/app-shell",
    to: "/front/composants/mise-en-page/app-shell",
  },
  {
    from: "/04-front/03-composants/02-mise-en-page/bandeau",
    to: "/front/composants/mise-en-page/bandeau",
  },
  {
    from: "/04-front/03-composants/02-mise-en-page/container",
    to: "/front/composants/mise-en-page/container",
  },
  {
    from: "/04-front/03-composants/02-mise-en-page/footer",
    to: "/front/composants/mise-en-page/footer",
  },
  {
    from: "/04-front/03-composants/02-mise-en-page/header",
    to: "/front/composants/mise-en-page/header",
  },
  {
    from: "/04-front/03-composants/02-mise-en-page/page-header",
    to: "/front/composants/mise-en-page/page-header",
  },
  {
    from: "/04-front/03-composants/02-mise-en-page/pagination",
    to: "/front/composants/mise-en-page/pagination",
  },
  {
    from: "/04-front/03-composants/02-mise-en-page/section-header",
    to: "/front/composants/mise-en-page/section-header",
  },
  {
    from: "/04-front/03-composants/02-mise-en-page/share-button",
    to: "/front/composants/mise-en-page/share-button",
  },
  {
    from: "/04-front/03-composants/02-mise-en-page/tabs",
    to: "/front/composants/mise-en-page/tabs",
  },
  {
    from: "/04-front/03-composants/03-filtres/calendrier-mois",
    to: "/front/composants/filtres/calendrier-mois",
  },
  {
    from: "/04-front/03-composants/03-filtres/chambre-switch",
    to: "/front/composants/filtres/chambre-switch",
  },
  {
    from: "/04-front/03-composants/03-filtres/comparison-bar",
    to: "/front/composants/filtres/comparison-bar",
  },
  {
    from: "/04-front/03-composants/03-filtres/date-range-picker",
    to: "/front/composants/filtres/date-range-picker",
  },
  {
    from: "/04-front/03-composants/03-filtres/filter-bar",
    to: "/front/composants/filtres/filter-bar",
  },
  {
    from: "/04-front/03-composants/03-filtres/multi-select-filter",
    to: "/front/composants/filtres/multi-select-filter",
  },
  {
    from: "/04-front/03-composants/03-filtres/search-input",
    to: "/front/composants/filtres/search-input",
  },
  {
    from: "/04-front/03-composants/03-filtres/sort-select",
    to: "/front/composants/filtres/sort-select",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/amendement-card",
    to: "/front/composants/parlementaire/amendement-card",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/data-table",
    to: "/front/composants/parlementaire/data-table",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/dossier-card",
    to: "/front/composants/parlementaire/dossier-card",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/evenement-card",
    to: "/front/composants/parlementaire/evenement-card",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/groupe-badge",
    to: "/front/composants/parlementaire/groupe-badge",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/legislative-timeline",
    to: "/front/composants/parlementaire/legislative-timeline",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/lobbyiste-logo",
    to: "/front/composants/parlementaire/lobbyiste-logo",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/mandats-timeline",
    to: "/front/composants/parlementaire/mandats-timeline",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/parlementaire-avatar",
    to: "/front/composants/parlementaire/parlementaire-avatar",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/parlementaire-card",
    to: "/front/composants/parlementaire/parlementaire-card",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/resultat-vote",
    to: "/front/composants/parlementaire/resultat-vote",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/scrutin-card",
    to: "/front/composants/parlementaire/scrutin-card",
  },
  {
    from: "/04-front/03-composants/04-parlementaire/top-flop",
    to: "/front/composants/parlementaire/top-flop",
  },
  {
    from: "/04-front/03-composants/05-graphiques/bar-chart",
    to: "/front/composants/graphiques/bar-chart",
  },
  {
    from: "/04-front/03-composants/05-graphiques/chart-frame",
    to: "/front/composants/graphiques/chart-frame",
  },
  {
    from: "/04-front/03-composants/05-graphiques/hemicycle",
    to: "/front/composants/graphiques/hemicycle",
  },
];
