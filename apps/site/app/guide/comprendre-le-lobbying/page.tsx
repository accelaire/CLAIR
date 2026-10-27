import { GuideArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comprendre le lobbying",
  description:
    "Parcours guidé pour explorer les représentants d’intérêts et leurs actions sur CLAIR.",
};

const Page = () => <GuideArticleScreen slug="comprendre-le-lobbying" />;

export default Page;
