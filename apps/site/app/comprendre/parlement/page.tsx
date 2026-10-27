import { ComprendreArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Le Parlement français",
  description:
    "Comprendre le fonctionnement du Parlement français : Assemblée nationale, Sénat, sessions parlementaires et navette législative.",
};

const Page = () => <ComprendreArticleScreen slug="parlement" />;

export default Page;
