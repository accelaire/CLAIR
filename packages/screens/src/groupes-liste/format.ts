import type { Chambre } from "@clair/data";

/**
 * Positions politiques déclarées par les sources, de gauche à droite : l'ordre des sièges dans
 * l'hémicycle. Ce n'est pas un jugement, seulement la place où siège le groupe.
 */
const POSITIONS = [
  ["extreme_gauche", "Extrême gauche"],
  ["gauche", "Gauche"],
  ["centre_gauche", "Centre-gauche"],
  ["centre", "Centre"],
  ["centre_droit", "Centre-droit"],
  ["droite", "Droite"],
  ["extreme_droite", "Extrême droite"],
] as const;

const LIBELLES: Record<string, string> = Object.fromEntries(POSITIONS);

/** « centre_gauche » → « Centre-gauche » ; la valeur brute si elle est inconnue. */
export const libellePosition = (position: string | null) =>
  position ? (LIBELLES[position] ?? position) : null;

const rangPosition = (position: string | null) => {
  const index = POSITIONS.findIndex(([valeur]) => valeur === position);
  return index === -1 ? POSITIONS.length : index;
};

/** Groupes dans l'ordre des sièges (gauche à droite, puis non classés), à ordre égal par `ordre`. */
export const parPosition = <T extends { position: string | null; ordre: number }>(
  groupes: readonly T[],
) =>
  [...groupes].sort(
    (a, b) => rangPosition(a.position) - rangPosition(b.position) || a.ordre - b.ordre,
  );

/** Chemin d'une liste de parlementaires d'une chambre. */
export const cheminParlementaires = (chambre: Chambre) =>
  chambre === "assemblee" ? "/deputes" : "/senateurs";

/** Nom lisible d'un groupe : son nom complet s'il existe, sinon son sigle. */
export const nomDuGroupe = (groupe: { nom: string; nomComplet: string | null }) =>
  groupe.nomComplet || groupe.nom;

const nombre = new Intl.NumberFormat("fr-FR");

/** « 1 234 ». */
export const formatNombre = (valeur: number) => nombre.format(valeur);

/** « 98 % » (espace fine insécable). */
export const formatPourcent = (valeur: number) => `${nombre.format(valeur)} %`;

/** Session sénatoriale : « 2025 » → « Session 2025-2026 ». */
export const libelleSession = (session: string) => {
  const annee = Number.parseInt(session, 10);
  return Number.isFinite(annee) ? `Session ${annee}-${annee + 1}` : `Session ${session}`;
};
