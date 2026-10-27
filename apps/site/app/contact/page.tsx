import { ContactScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez l'équipe CLAIR pour toute question, suggestion ou signalement d'erreur.",
};

const Page = () => <ContactScreen />;

export default Page;
