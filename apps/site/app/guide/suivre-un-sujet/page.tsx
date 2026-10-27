import { GuideArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suivre un sujet",
  description:
    "Comprendre une page Sujet sur CLAIR : le parcours d'un grand texte de loi entre l'Assemblée et le Sénat, sa chronologie, ses scrutins et les votes par groupe politique.",
};

const Page = () => <GuideArticleScreen slug="suivre-un-sujet" />;

export default Page;
