import { defaultLanguages, type ZudokuConfig } from "zudoku";
import { colors, palette, radius } from "@clair/theme/tokens";
import {
  CodeTabs,
  ColorSwatches,
  ContrastTable,
  FeatureCard,
  FeatureGrid,
  Footer,
  HeaderActions,
  Mermaid,
  Preview,
  RadiusScale,
  SpacingScale,
  SwaggerLink,
  TrackCard,
  TypeScale,
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
    // Couleurs lues dans @clair/theme (packages/theme/src/tokens.ts), plus de copie à la main.
    light: {
      background: colors.clair["fond-page"],
      foreground: colors.clair["texte-defaut"],
      card: colors.clair["fond-surface"],
      cardForeground: colors.clair["texte-defaut"],
      popover: colors.clair["fond-surface"],
      popoverForeground: colors.clair["texte-defaut"],
      primary: colors.clair["fond-action"],
      primaryForeground: colors.clair["texte-sur-action"],
      secondary: colors.clair["fond-neutre"],
      secondaryForeground: palette["ardoise-900"],
      muted: colors.clair["fond-neutre"],
      mutedForeground: colors.clair["texte-mention"],
      accent: colors.clair["fond-neutre"],
      accentForeground: palette["ardoise-900"],
      destructive: colors.clair["statut-erreur"],
      destructiveForeground: colors.clair["texte-sur-action"],
      border: colors.clair["bordure-defaut"],
      input: colors.clair["bordure-defaut"],
      ring: colors.clair.focus,
      radius: `${radius.lg / 16}rem`,
    },
    dark: {
      background: colors.sombre["fond-page"],
      foreground: colors.sombre["texte-defaut"],
      card: colors.sombre["fond-surface"],
      cardForeground: colors.sombre["texte-defaut"],
      popover: colors.sombre["fond-surface"],
      popoverForeground: colors.sombre["texte-defaut"],
      primary: colors.sombre["fond-action"],
      primaryForeground: colors.sombre["texte-sur-action"],
      secondary: colors.sombre["fond-neutre"],
      secondaryForeground: colors.sombre["texte-defaut"],
      muted: colors.sombre["fond-neutre"],
      mutedForeground: colors.sombre["texte-mention"],
      accent: colors.sombre["fond-neutre"],
      accentForeground: colors.sombre["texte-defaut"],
      destructive: colors.sombre["statut-erreur-fond"],
      destructiveForeground: colors.sombre["texte-defaut"],
      border: colors.sombre["bordure-defaut"],
      input: colors.sombre["bordure-forte"],
      ring: colors.sombre.focus,
      radius: `${radius.lg / 16}rem`,
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
    "head-navigation-end": <HeaderActions />,
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
        label: "Storybook",
        to: "https://storybook.clair.vote",
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
    // Thèmes à contraste élevé : chaque jeton de code passe le contraste WCAG AA.
    themes: { light: "github-light-high-contrast", dark: "github-dark-high-contrast" },
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
      Preview,
      ColorSwatches,
      ContrastTable,
      TypeScale,
      SpacingScale,
      RadiusScale,
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
      title: "CLAIR : documentation technique",
      description: "Documentation technique, modèles de données et référence OpenAPI de CLAIR.",
    },
  },
  redirects: docsRedirects,
};

export default config;
