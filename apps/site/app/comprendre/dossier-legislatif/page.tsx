import { ComprendreArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Le dossier législatif",
  description:
    "Comprendre le cycle de vie d'une loi : de la proposition à la promulgation, en passant par les amendements.",
};

const Page = () => <ComprendreArticleScreen slug="dossier-legislatif" />;

export default Page;
