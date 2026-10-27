import { ComprendreArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Le lobbying en France",
  description:
    "Comprendre le lobbying en France : loi Sapin II, HATVP, déclarations et statistiques.",
};

const Page = () => <ComprendreArticleScreen slug="lobbying" />;

export default Page;
