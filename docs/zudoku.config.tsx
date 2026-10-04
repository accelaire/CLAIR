import { defaultLanguages, type ZudokuConfig } from "zudoku";
import {
  ApiSimulator,
  CodeTabs,
  FeatureCard,
  FeatureGrid,
  Mermaid,
  PoliticalBadge,
  TrackCard,
  VoteBadge,
} from "./src/components";
import { docsNavigation, docsRedirects } from "./zudoku.navigation";
import "./zudoku.theme.css";

const config: ZudokuConfig = {
  metadata: {
    title: "%s | CLAIR — Documentation & Référence API",
    description:
      "Portail technique, architecture, modèles de données et référence OpenAPI de la plateforme citoyenne CLAIR (clair.vote).",
    favicon: "/favicon.svg",
  },
  site: {
    title: "CLAIR — Documentation",
    banner: {
      message: "🏛️ CLAIR : Plateforme ouverte de transparence parlementaire & citoyenne",
      color: "info",
      dismissible: true,
    },
    logo: {
      src: {
        light: "/logo-clair-light.svg",
        dark: "/logo-clair-dark.svg",
      },
      alt: "CLAIR — Citoyen Libre, Analyse, Information, République",
      width: 140,
      href: "/",
    },
    showPoweredBy: false,
  },
  search: {
    type: "pagefind",
  },
  header: {
    navigation: [
      {
        label: "Documentation",
        to: "/",
        icon: "book-open",
      },
      {
        label: "Explorateur Swagger (API)",
        to: "/api",
        icon: "code",
      },
      {
        label: "clair.vote",
        to: "https://clair.vote",
        target: "_blank",
        icon: "external-link",
      },
      {
        label: "GitHub",
        to: "https://github.com/accelaire/CLAIR",
        target: "_blank",
        icon: "folder-git-2",
      },
    ],
  },
  syntaxHighlighting: {
    languages: [
      ...defaultLanguages,
      "mermaid",
      "typescript",
      "javascript",
      "json",
      "bash",
      "sql",
      "yaml",
      "dockerfile",
      "http",
    ],
  },
  navigation: docsNavigation,
  apis: {
    type: "file",
    input: "./public/openapi.json",
    path: "/api",
    options: {
      showInfoPage: true,
    },
  },
  mdx: {
    components: {
      Mermaid: Mermaid as any,
      FeatureCard,
      FeatureGrid,
      TrackCard,
      CodeTabs,
      PoliticalBadge,
      VoteBadge,
      ApiSimulator,
    },
  },
  docs: {
    files: "./**/*.{md,mdx}",
    publishMarkdown: true,
    llms: {
      llmsTxt: true,
      llmsTxtFull: true,
      title: "CLAIR — Documentation Technique",
      description: "Documentation technique, modèles de données et référence OpenAPI de CLAIR.",
    },
  },
  redirects: docsRedirects,
};

export default config;
