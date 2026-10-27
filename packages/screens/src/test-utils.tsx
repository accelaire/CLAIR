import {
  ApiProvider,
  createFixtureClient,
  createQueryClient,
  type FixtureRoutes,
} from "@clair/api-client";
import { cssVariablesResolver, theme } from "@clair/theme";
import { type Navigation, NavigationProvider, type RouterLinkProps } from "@clair/ui";
import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

const AnchorLink = (props: RouterLinkProps) => <a {...props} />;

/**
 * Rendu d'un écran pour les tests : thème, navigation simulée (les URL visitées sont
 * observables) et API de fixtures (`routes` : chemin → réponse).
 */
export const renderScreen = (
  ui: ReactElement,
  { routes = {}, pathname = "/" }: { routes?: FixtureRoutes; pathname?: string } = {},
) => {
  const visited: string[] = [];
  const navigation: Navigation = {
    Link: AnchorLink,
    navigate: (href) => {
      visited.push(href);
    },
    pathname,
  };
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } });
  const result = render(
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      forceColorScheme="light"
    >
      <NavigationProvider value={navigation}>
        <ApiProvider client={createFixtureClient(routes)} queryClient={queryClient}>
          {ui}
        </ApiProvider>
      </NavigationProvider>
    </MantineProvider>,
  );
  return { ...result, visited };
};
