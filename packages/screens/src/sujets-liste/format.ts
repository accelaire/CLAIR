import { parseStatut, type Statut } from "@clair/ui";

/** Date en toutes lettres, fuseau de Paris (même rendu côté serveur et navigateur). */
const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const moisAnnee = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** « 12 mars 2026 ». */
export const formatDate = (iso: string) => dateLongue.format(new Date(iso));

/** « mars 2026 ». */
export const formatMois = (iso: string) => moisAnnee.format(new Date(iso));

/** Statut affichable d'un sujet (`en_cours` par défaut, comme apps/web). */
export const statutSujet = (status: string): Statut => parseStatut(status) ?? "en_cours";

/** « 1 scrutin », « 3 scrutins ». */
export const compte = (n: number, mot: string) =>
  `${n.toLocaleString("fr-FR")} ${mot}${n > 1 ? "s" : ""}`;
