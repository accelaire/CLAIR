import { cssVariablesResolver, theme } from "@clair/theme";
import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { type LinkProps, type Navigation, NavigationProvider } from "./lib/navigation.tsx";

const AnchorLink = (props: LinkProps) => <a {...props} />;

/** Rendu de test : thème Mantine et navigation simulée (les navigations sont observables). */
export const renderWithProviders = (
  ui: ReactElement,
  {
    pathname = "/",
    colorScheme = "light",
  }: { pathname?: string; colorScheme?: "light" | "dark" } = {},
) => {
  const visited: string[] = [];
  const navigation: Navigation = {
    Link: AnchorLink,
    navigate: (href) => {
      visited.push(href);
    },
    pathname,
  };
  const result = render(
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      forceColorScheme={colorScheme}
    >
      <NavigationProvider value={navigation}>{ui}</NavigationProvider>
    </MantineProvider>,
  );
  return { ...result, visited };
};
