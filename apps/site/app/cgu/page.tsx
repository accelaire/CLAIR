import { PageLegaleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description:
    "Conditions générales d'utilisation du site CLAIR - Plateforme citoyenne de transparence politique.",
};

const Page = () => <PageLegaleScreen page="cgu" />;

export default Page;
