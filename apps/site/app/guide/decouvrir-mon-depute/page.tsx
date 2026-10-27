import { GuideArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Découvrir mon député",
  description:
    "Parcours guidé pour trouver votre député et comprendre son activité parlementaire sur CLAIR.",
};

const Page = () => <GuideArticleScreen slug="decouvrir-mon-depute" />;

export default Page;
