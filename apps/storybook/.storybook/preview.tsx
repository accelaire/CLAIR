import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "dayjs/locale/fr";
import "@clair/theme/styles.css";
import "./preview.css";
import {
  ApiProvider,
  createFixtureClient,
  createQueryClient,
  type FixtureRoutes,
} from "@clair/api-client";
import { cssVariablesResolver, theme } from "@clair/theme";
import { type LinkProps, type Navigation, NavigationProvider } from "@clair/ui";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { DecoratorHelpers } from "@storybook/addon-themes";
import type { Decorator, Preview } from "@storybook/react-vite";
import { useState } from "react";
import { clairTheme, sombreTheme } from "./clair-theme.ts";

const { initializeThemeState, pluckThemeFromContext, useThemeParameters } = DecoratorHelpers;

const THEMES = { light: "Clair", dark: "Sombre" } as const;
initializeThemeState(Object.keys(THEMES), "light");

/** Dans Storybook, un lien ne quitte pas la story. */
const StoryLink = ({ href, onClick, ...props }: LinkProps) => (
  <a
    href={href}
    {...props}
    onClick={(event) => {
      event.preventDefault();
      onClick?.(event);
    }}
  />
);

/**
 * Paramètres de story lus par les décorateurs (écrans de `@clair/screens`).
 * - `api` : réponses des chemins de l'API (`createFixtureClient`), jamais de réseau ; un chemin
 *   absent répond 404.
 * - `navigation.pathname` : adresse courante ; `navigation.navigate` : espion (`fn()` de
 *   `storybook/test`) pour vérifier dans `play` l'URL visée par un filtre ou un onglet.
 */
export type ClairParameters = {
  api?: FixtureRoutes;
  navigation?: { pathname?: string; navigate?: Navigation["navigate"] };
};

/** Un client de requêtes par story : pas de cache partagé, pas de nouvel essai, pas de rechargement. */
const nouveauQueryClient = () => {
  const client = createQueryClient();
  client.setDefaultOptions({
    queries: { retry: false, staleTime: Number.POSITIVE_INFINITY, refetchInterval: false },
  });
  return client;
};

const withApi: Decorator = (Story, context) => {
  const { api = {}, navigation: nav = {} } = context.parameters as ClairParameters;
  const [queryClient] = useState(nouveauQueryClient);
  const navigation: Navigation = {
    Link: StoryLink,
    navigate: nav.navigate ?? (() => {}),
    pathname: nav.pathname ?? "/",
  };
  return (
    <NavigationProvider value={navigation}>
      <ApiProvider client={createFixtureClient(api)} queryClient={queryClient}>
        <Story />
      </ApiProvider>
    </NavigationProvider>
  );
};

/** Thème Mantine piloté par le sélecteur clair / sombre (équivalent du themeDecorator du DSFR). */
const withMantine: Decorator = (Story, context) => {
  const selected = pluckThemeFromContext(context);
  const { themeOverride } = useThemeParameters();
  const scheme = (themeOverride || selected || "light") === "dark" ? "dark" : "light";
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      forceColorScheme={scheme}
    >
      <DatesProvider settings={{ locale: "fr" }}>
        <Story />
      </DatesProvider>
    </MantineProvider>
  );
};

/** Viewports = points de rupture de CLAIR, nommés comme dans le Storybook du DSFR. */
const viewports = {
  xs: { name: "Téléphone — 375", styles: { width: "375px", height: "667px" } },
  sm: { name: "Grand téléphone — 640", styles: { width: "640px", height: "900px" } },
  md: { name: "Tablette — 768", styles: { width: "768px", height: "1024px" } },
  lg: { name: "Tablette horizontale — 1024", styles: { width: "1024px", height: "768px" } },
  xl: { name: "Ordinateur — 1280", styles: { width: "1280px", height: "800px" } },
};

const preview: Preview = {
  // withApi s'applique d'abord (au plus près de la story), dans le thème de withMantine.
  decorators: [withApi, withMantine],
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    docs: { theme: clairTheme },
    viewport: { options: viewports },
    a11y: { test: "error" },
    options: {
      storySort: {
        order: [
          "Introduction",
          "Fondations",
          ["Couleurs", "Typographie", "Espacements et rayons"],
          "Composants",
          ["Fondations", "Mise en page", "Filtres", "Parlementaire", "Graphiques"],
          "Écrans",
        ],
      },
    },
  },
  initialGlobals: {
    viewport: { value: undefined, isRotated: false },
    theme: "light",
  },
};

export const themes = { clair: clairTheme, sombre: sombreTheme };

export default preview;
