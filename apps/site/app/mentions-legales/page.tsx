import { PageLegaleScreen } from "@clair/screens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales du site CLAIR - Plateforme citoyenne de transparence politique.",
};

const Page = () => <PageLegaleScreen page="mentions-legales" />;

export default Page;
