import { imageRubrique, OG_CONTENT_TYPE, OG_COULEURS, OG_SIZE } from "@/lib/og.tsx";

export const contentType = OG_CONTENT_TYPE;
export const size = OG_SIZE;
export const alt = "Agenda parlementaire — CLAIR.vote";

export default imageRubrique({
  badge: "Agenda",
  badgeColor: OG_COULEURS.agenda,
  titre: "Agenda parlementaire",
  sousTitre: "Réunions de commissions et séances publiques, à l'Assemblée nationale et au Sénat.",
});
