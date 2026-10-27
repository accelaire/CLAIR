import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "dayjs/locale/fr";
import "@clair/theme/styles.css";
import "./preview.css";
import { cssVariablesResolver, theme } from "@clair/theme";
import { type LinkProps, type Navigation, NavigationProvider } from "@clair/ui";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { DecoratorHelpers } from "@storybook/addon-themes";
import type { Decorator, Preview } from "@storybook/react-vite";
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

const navigation: Navigation = { Link: StoryLink, navigate: () => {}, pathname: "/" };

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
        <NavigationProvider value={navigation}>
          <Story />
        </NavigationProvider>
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
  decorators: [withMantine],
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
