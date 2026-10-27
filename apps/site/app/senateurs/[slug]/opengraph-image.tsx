import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og.tsx";
import { imageParlementaire } from "../../_parlementaires/image-partage.tsx";

export const contentType = OG_CONTENT_TYPE;
export const size = OG_SIZE;
export const alt = "Fiche d'un sénateur sur CLAIR.vote";

const Image = async ({ params }: { params: Promise<{ slug: string }> }) =>
  imageParlementaire("senat", (await params).slug);

export default Image;
