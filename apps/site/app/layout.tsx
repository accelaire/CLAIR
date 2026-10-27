import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "@clair/theme/styles.css";
import { organisationJsonLd, siteWebJsonLd } from "@clair/screens";
import { AppShell, Footer, Header } from "@clair/ui";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Feedback } from "@/components/Feedback.tsx";
import { JsonLd } from "@/components/JsonLd.tsx";
import { PlausibleAnalytics } from "@/components/PlausibleAnalytics.tsx";
import { social } from "@/components/SocialIcons.tsx";
import { INDEXABLE, SITE_URL } from "@/lib/env.ts";
import { cta, footer, navigation } from "@/lib/site-config.ts";
import { Providers } from "./providers.tsx";

const description =
  "CLAIR.vote : analysez les votes des députés et sénateurs, suivez le lobbying et la transparence politique en France. Plateforme citoyenne gratuite.";

export const metadata: Metadata = {
  title: { default: "CLAIR.vote - Transparence Politique en France", template: "%s | CLAIR.vote" },
  description,
  metadataBase: new URL(SITE_URL),
  robots: INDEXABLE ? undefined : { index: false, follow: false },
  openGraph: {
    title: "CLAIR.vote - Transparence Politique en France",
    description,
    type: "website",
    locale: "fr_FR",
    siteName: "CLAIR.vote",
  },
  twitter: { card: "summary_large_image" },
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="fr" {...mantineHtmlProps}>
    <head>
      <ColorSchemeScript defaultColorScheme="auto" />
      <JsonLd data={[organisationJsonLd(SITE_URL), siteWebJsonLd(SITE_URL)]} />
    </head>
    <body>
      <PlausibleAnalytics />
      <Providers>
        <AppShell
          header={<Header navigation={navigation} cta={cta} />}
          footer={<Footer {...footer} social={social} />}
        >
          {children}
        </AppShell>
        <Feedback />
      </Providers>
    </body>
  </html>
);

export default RootLayout;
