import { GuideArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparer des élus",
  description: "Parcours guidé pour comparer l’activité de deux parlementaires sur CLAIR.",
};

const Page = () => <GuideArticleScreen slug="comparer-des-elus" />;

export default Page;
