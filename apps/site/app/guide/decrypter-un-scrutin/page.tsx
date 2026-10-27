import { GuideArticleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Décrypter un scrutin",
  description: "Parcours guidé pour lire et analyser un vote parlementaire sur CLAIR.",
};

const Page = () => <GuideArticleScreen slug="decrypter-un-scrutin" />;

export default Page;
