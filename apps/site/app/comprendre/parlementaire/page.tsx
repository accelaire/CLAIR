import { ComprendreArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Le parlementaire",
  description:
    "Comprendre le rôle d’un parlementaire : mandat, élection, statistiques de présence, loyauté et participation.",
};

const Page = () => <ComprendreArticleScreen slug="parlementaire" />;

export default Page;
