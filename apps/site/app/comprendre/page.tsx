import { ComprendreScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comprendre la politique française",
  description:
    "Découvrez le fonctionnement des institutions démocratiques françaises : Parlement, scrutins, dossiers législatifs, groupes politiques, lobbying et commissions.",
};

const Page = () => <ComprendreScreen />;

export default Page;
