import { ComprendreArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Le scrutin public",
  description:
    "Comprendre les scrutins publics : types de vote, déroulement, lecture des résultats.",
};

const Page = () => <ComprendreArticleScreen slug="scrutin" />;

export default Page;
