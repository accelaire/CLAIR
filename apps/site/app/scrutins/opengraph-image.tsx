import { imageRubrique, OG_CONTENT_TYPE, OG_COULEURS, OG_SIZE } from "@/lib/og.tsx";

export const contentType = OG_CONTENT_TYPE;
export const size = OG_SIZE;
export const alt = "Scrutins publics — CLAIR.vote";

export default imageRubrique({
  badge: "Scrutins",
  badgeColor: OG_COULEURS.scrutins,
  titre: "Scrutins publics",
  sousTitre: "Les votes de l'Assemblée nationale et du Sénat, scrutin par scrutin.",
});
