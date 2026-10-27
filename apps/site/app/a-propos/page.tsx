import { AProposScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "CLAIR est une plateforme citoyenne de transparence politique. Découvrez notre mission, nos valeurs et comment nous rendons la politique française plus accessible.",
};

const Page = () => <AProposScreen />;

export default Page;
