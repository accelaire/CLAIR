import { imageRubrique, OG_CONTENT_TYPE, OG_COULEURS, OG_SIZE } from "@/lib/og.tsx";

export const contentType = OG_CONTENT_TYPE;
export const size = OG_SIZE;
export const alt = "Dossiers législatifs — CLAIR.vote";

export default imageRubrique({
  badge: "Législation",
  badgeColor: OG_COULEURS.textes,
  titre: "Dossiers législatifs",
  sousTitre: "Projets et propositions de loi, de leur dépôt à leur promulgation.",
});
