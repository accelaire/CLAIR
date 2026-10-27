import { ApiPresentationScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API ouverte",
  description:
    "Accédez librement aux données politiques françaises via l'API CLAIR : députés, sénateurs, scrutins, lobbying, dossiers législatifs. Données ouvertes, documentées et gratuites.",
};

const Page = () => <ApiPresentationScreen />;

export default Page;
