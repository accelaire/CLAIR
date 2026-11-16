import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Atelier de développement des composants de CLAIR.
 * Configuration calquée sur le Storybook du DSFR (dsfr-sb) : une app qui ne contient que la
 * configuration et l'introduction, les stories vivent à côté des composants.
 */
const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../../../packages/ui/src/**/*.stories.@(ts|tsx)",
    // Écrans rendus sur leurs fixtures (`parameters.api`, voir preview.tsx), sans réseau.
    "../../../packages/screens/src/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-links",
    "@storybook/addon-vitest",
    "@storybook/addon-mcp",
  ],
  framework: { name: "@storybook/react-vite", options: {} },
  // Images du nouveau site (identiques à celles de apps/web, qui sera supprimé).
  staticDirs: [{ from: "../../site/public", to: "/" }],
  core: { disableTelemetry: true },
  typescript: { reactDocgen: "react-docgen" },
};

export default config;
