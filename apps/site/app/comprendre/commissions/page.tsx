import { ComprendreArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Les commissions parlementaires",
  description: "Comprendre les commissions parlementaires : permanentes, spéciales et d’enquête.",
};

const Page = () => <ComprendreArticleScreen slug="commissions" />;

export default Page;
