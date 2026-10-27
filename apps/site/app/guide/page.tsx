import { GuideScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guide pratique",
  description:
    "Parcours guidés pour tirer le maximum de CLAIR : découvrir votre député, suivre un sujet, comparer des élus, explorer le lobbying.",
};

const Page = () => <GuideScreen />;

export default Page;
