/**
 * Formatage et accords de la rubrique Sénatoriales 2026 (repris de apps/web
 * `lib/senatoriales/resultats.ts` et `lib/senatoriales/circonscription.ts`).
 */

/** Accord d'un nom : « siège » / « sièges ». La forme plurielle peut être donnée. */
export const pluriel = (n: number, singulier: string, plurielForme = `${singulier}s`): string =>
  n > 1 ? plurielForme : singulier;

/** Accord d'un verbe (séparé de `pluriel`, qui donnerait « ests » et « sonts »). */
export const accorde = (n: number, singulier: string, plurielVerbe: string): string =>
  n > 1 ? plurielVerbe : singulier;

/** Accord au féminin quand la source dit « F » ; sinon masculin, la règle d'usage. */
export const accorder = (sexe: string | null | undefined, masculin: string, feminin: string) =>
  sexe === "F" ? feminin : masculin;

export const nombre = (n: number): string => n.toLocaleString("fr-FR");

export const pourcentage = (valeur: number | null, decimales = 1): string => {
  if (valeur === null) return "—";
  return `${valeur.toLocaleString("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })} %`;
};

/** « 20h14 », heure de Paris, quel que soit le fuseau du lecteur ou du serveur. */
export const heureDeParis = (iso: string): string => {
  const parties = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const h = parties.find((p) => p.type === "hour")?.value ?? "";
  const m = parties.find((p) => p.type === "minute")?.value ?? "";
  return `${h}h${m}`;
};

/** Minuscules sans accents : la forme sur laquelle se comparent les saisies. */
export const sansAccents = (valeur: string): string =>
  valeur.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Ancre d'une section : `#gironde`, `#bouches-du-rhone`. Dérivée du libellé et non du code
 * INSEE, pour que l'URL partagée reste lisible.
 */
export const ancreDepartement = (libelle: string): string =>
  sansAccents(libelle)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Nom affichable d'un groupe ; l'API résout déjà `nom` vers le libellé d'usage du Sénat. */
export const nomGroupe = (groupe: { nom: string } | null): string =>
  groupe ? groupe.nom : "Sans groupe";

/** Lien vers la fiche d'une personne déjà passée par le Parlement. */
export const lienPersonne = (personne: { slug: string; chambre: string }): string =>
  `/${personne.chambre === "senat" ? "senateurs" : "deputes"}/${personne.slug}`;
