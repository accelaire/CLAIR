"use client";

import { ApiProvider, createHttpClient } from "@clair/api-client";
import { cssVariablesResolver, theme } from "@clair/theme";
import { type Navigation, NavigationProvider, type RouterLinkProps } from "@clair/ui";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import "dayjs/locale/fr";

const SiteLink = (props: RouterLinkProps) => <NextLink {...props} />;

/** Navigateur : l'API passe par le proxy same-origin `/api/v1`, qui porte le secret interne. */
const browserApi = createHttpClient({ baseUrl: "/api/v1" });

export const Providers = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useMemo<Navigation>(
    () => ({ Link: SiteLink, navigate: (href) => router.push(href, { scroll: false }), pathname }),
    [router, pathname],
  );
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="auto"
    >
      <DatesProvider settings={{ locale: "fr" }}>
        <ApiProvider client={browserApi}>
          <NavigationProvider value={navigation}>{children}</NavigationProvider>
        </ApiProvider>
      </DatesProvider>
    </MantineProvider>
  );
};
