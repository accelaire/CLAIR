import { defaultLanguages, type ZudokuConfig } from "zudoku";
import {
  CodeTabs,
  FeatureCard,
  FeatureGrid,
  Footer,
  Mermaid,
  SwaggerLink,
  TrackCard,
} from "./src/components";
import { docsNavigation, docsRedirects } from "./zudoku.navigation";
import "./zudoku.theme.css";

const config: ZudokuConfig = {
  metadata: {
    title: "%s | CLAIR.vote Docs",
    description:
      "Portail technique, architecture, modèles de données et référence OpenAPI de la plateforme citoyenne CLAIR (clair.vote).",
    favicon: "/icon.png",
  },
  theme: {
    fonts: {
      sans: "Inter",
    },
    // Source de vérité : apps/web/app/globals.css
    light: {
      background: "#ffffff",
      foreground: "#020817",
      card: "#ffffff",
      cardForeground: "#020817",
      popover: "#ffffff",
      popoverForeground: "#020817",
      primary: "#106ff4", // hsl(215, 91%, 51%)
      primaryForeground: "#f8fafc", // hsl(210, 40%, 98%)
      secondary: "#f1f5f9", // hsl(210, 40%, 96.1%)
      secondaryForeground: "#0f172a", // hsl(222.2, 47.4%, 11.2%)
      muted: "#f1f5f9",
      mutedForeground: "#64748b", // hsl(215.4, 16.3%, 46.9%)
      accent: "#f1f5f9",
      accentForeground: "#0f172a",
      destructive: "#ef4444", // hsl(0, 84.2%, 60.2%)
      destructiveForeground: "#f8fafc",
      border: "#e2e8f0", // hsl(214.3, 31.8%, 91.4%)
      input: "#e2e8f0",
      ring: "#106ff4",
      radius: "0.5rem",
    },
    dark: {
      background: "#0c0e12", // hsl(220, 20%, 5.9%) — Figma page bg
      foreground: "#ffffff",
      card: "#12151b", // hsl(221, 20%, 8.8%) — Figma surface
      cardForeground: "#ffffff",
      popover: "#12151b",
      popoverForeground: "#ffffff",
      primary: "#106ff4", // hsl(215, 91%, 51%), brand blue
      primaryForeground: "#ffffff",
      secondary: "#22262f", // hsl(221, 16%, 15.9%) — Figma divider
      secondaryForeground: "#ffffff",
      muted: "#22262f",
      mutedForeground: "#94969c", // hsl(225, 4%, 59.6%) — Figma muted text
      accent: "#22262f",
      accentForeground: "#ffffff",
      destructive: "#7f1d1d", // hsl(0, 62.8%, 30.6%)
      destructiveForeground: "#ffffff",
      border: "#22262f",
      input: "#373a41", // hsl(222, 8%, 23.5%) — Figma subtle border
      ring: "#106ff4",
      radius: "0.5rem",
    },
  },
  site: {
    title: "CLAIR.vote Docs",
    logo: {
      src: {
        light: "/logo-clair-light.svg",
        dark: "/logo-clair-dark.svg",
      },
      alt: "CLAIR Docs",
      width: 119,
      href: "/",
    },
    showPoweredBy: false,
    footer: {},
  },
  slots: {
    "footer-before": <Footer />,
    "content-before": <SwaggerLink />,
  },
  search: {
    type: "pagefind",
  },
  header: {
    navigation: [
      {
        label: "clair.vote",
        to: "https://clair.vote",
        target: "_blank",
      },
      {
        label: "GitHub",
        to: "https://github.com/accelaire/CLAIR",
        target: "_blank",
      },
      {
        label: "Nous soutenir",
        to: "https://clair.vote/soutenir",
        target: "_blank",
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
    },
  },
  docs: {
    files: "./**/*.{md,mdx}",
    publishMarkdown: true,
    defaultOptions: {
      showLastModified: false,
    },
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
