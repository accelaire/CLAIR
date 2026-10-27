import { MethodologieScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Méthodologie",
  description:
    "Découvrez comment CLAIR collecte, structure et présente les données publiques de la vie politique française.",
};

const Page = () => <MethodologieScreen />;

export default Page;
