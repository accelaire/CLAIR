import { PageLegaleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité et protection des données personnelles sur CLAIR.",
};

const Page = () => <PageLegaleScreen page="confidentialite" />;

export default Page;
