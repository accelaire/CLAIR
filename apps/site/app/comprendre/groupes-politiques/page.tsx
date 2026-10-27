import { ComprendreArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Les groupes politiques",
  description:
    "Comprendre les groupes parlementaires : différence avec les partis, rôle, cohésion et loyauté.",
};

const Page = () => <ComprendreArticleScreen slug="groupes-politiques" />;

export default Page;
