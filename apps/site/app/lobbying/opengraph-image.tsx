import { imageRubrique, OG_CONTENT_TYPE, OG_COULEURS, OG_SIZE } from "@/lib/og.tsx";

export const contentType = OG_CONTENT_TYPE;
export const size = OG_SIZE;
export const alt = "Lobbying — Données HATVP — CLAIR.vote";

export default imageRubrique({
  badge: "Lobbying",
  badgeColor: OG_COULEURS.lobbying,
  titre: "Lobbying",
  sousTitre:
    "Les représentants d'intérêts déclarés à la HATVP : budgets, secteurs, actions menées.",
});
