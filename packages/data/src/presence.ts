import type { Chambre } from "./common.ts";

/**
 * Présence d'un parlementaire, selon sa chambre (ticket #108), portée de `apps/web/lib/presence.ts`.
 *
 * À l'Assemblée, chaque député vote lui-même : le taux de participation aux scrutins publics mesure
 * sa présence. Au Sénat, un scrutin ordinaire se vote par groupe : un délégué dépose les bulletins
 * de tous les membres, présents ou non. Seuls les scrutins solennels, où chacun vote en personne ou
 * confie son vote à un collègue, disent qui était là : c'est la présence d'un sénateur. Le taux tous
 * scrutins devient sa participation aux scrutins.
 *
 * Ces règles servent à tous les écrans (fiche, comparateur, groupe, classements, images de partage) :
 * un seul endroit pour une seule vérité.
 */

export type StatsPresence = {
  /** Nul sans aucun scrutin où il pouvait voter (président de l'assemblée, période au Gouvernement). */
  presence: number | null;
  presenceSolennel?: number | null;
};

/** Explication courte, pour une aide ou une note sous un classement. */
export const PRESENCE_SENAT_EXPLICATION =
  "Au Sénat, un scrutin ordinaire se vote par groupe : un délégué dépose les bulletins de tous les membres, présents ou non. " +
  "Seuls les scrutins solennels, où chacun vote en personne ou confie son vote à un collègue, mesurent la présence. " +
  "Un vote confié à un collègue compte comme une absence. Le président du Sénat, le président de séance et les membres du gouvernement, qui ne votent pas, sont hors calcul.";

export const PRESENCE_SENAT_NON_MESURABLE =
  "Aucun scrutin solennel sur la période : la présence de ce sénateur n'est pas mesurable.";

/** Scrutins où l'élu ne pouvait pas voter, exclus du calcul. */
export const PRESENCE_HORS_CALCUL =
  "Les scrutins où l'élu ne pouvait pas voter (présidence de l'assemblée ou de la séance, membre du gouvernement) sont hors calcul.";

/**
 * En dessous, un député ne figure pas dans le classement de présence, et aucun élu dans celui de
 * loyauté (`SEUIL_SCRUTINS_CLASSEMENT` de l'ingestion). La présence des sénateurs, mesurée sur les
 * scrutins solennels, n'a pas de seuil.
 */
export const SEUIL_SCRUTINS_CLASSEMENT = 50;

/** Période des chiffres d'une fiche, et pourquoi les classements peuvent différer. */
export const PERIODE_FICHE =
  "Calculé sur l'ensemble de la carrière parlementaire, Assemblée et Sénat, tous mandats confondus. " +
  "Les classements comparent par défaut le mandat en cours, d'où un chiffre parfois différent.";

/**
 * Valeur de présence à afficher ou à comparer : présence aux votes solennels pour un sénateur
 * (`null` sans scrutin solennel sur la période, jamais le taux tous scrutins), taux de
 * participation aux scrutins pour un député.
 */
export const presenceDe = (
  chambre: Chambre | string | null | undefined,
  stats: StatsPresence | null | undefined,
): number | null => {
  if (!stats) return null;
  if (chambre === "senat") return stats.presenceSolennel ?? null;
  return stats.presence;
};

/** Libellé de la présence pour une chambre. */
export const libellePresence = (chambre: Chambre | string | null | undefined): string =>
  chambre === "senat" ? "Présence aux votes solennels" : "Présence";

/**
 * Présence en un chiffre et un libellé court (images de partage, cartes) : au Sénat, la présence
 * aux votes solennels, sinon la participation (taux tous scrutins, voté par groupe), sinon rien ;
 * à l'Assemblée, le taux de présence (nul s'il n'est pas mesurable).
 */
export const presenceCourte = (
  chambre: Chambre | string | null | undefined,
  stats: StatsPresence,
): { libelle: string; valeur: number | null } | null => {
  if (chambre !== "senat") return { libelle: "Présence", valeur: stats.presence };
  const solennel = stats.presenceSolennel ?? null;
  if (solennel !== null) return { libelle: "Présence (solennels)", valeur: solennel };
  if (stats.presence !== null) return { libelle: "Participation", valeur: stats.presence };
  return null;
};

/** « 73 % » (espace fine insécable), ou « — » quand le taux n'existe pas (jamais « null % » ni un 0 qui mentirait). */
export const pourcent = (valeur: number | null | undefined): string =>
  valeur === null || valeur === undefined ? "—" : `${valeur.toLocaleString("fr-FR")}\u202f%`;

/**
 * Ligne de classement non classable : sous 50 scrutins, un taux ne se compare pas (l'API classe la
 * ligne après les autres). Sauf la présence d'un sénateur, mesurée sur les solennels, sans seuil.
 */
export const nonClasse = (
  chambre: Chambre | string | null | undefined,
  stats: { classable?: boolean | null } | null | undefined,
  tri: string,
): boolean => {
  if (stats?.classable !== false) return false;
  return tri === "loyaute" || (tri === "presence" && chambre !== "senat");
};

export const NON_CLASSE_EXPLICATION =
  "Non classé : moins de 50 scrutins sur la période, trop peu pour comparer ce taux.";

/** Fonction d'un parlementaire, telle que la fiche la reçoit (`mandats`). */
export type FonctionPresidence = {
  typeOrgane: string;
  qualite: string | null;
  dateFin: string | null;
};

const PRESIDENCE_ASSEMBLEE = /^présidente? (du sénat|de l['’]assemblée nationale)$/i;

/** Préside son assemblée (Sénat ou Assemblée nationale) en ce moment : ne vote pas, par usage. */
export const presideUneAssemblee = (fonctions: readonly FonctionPresidence[]): boolean =>
  fonctions.some(
    (f) =>
      !f.dateFin &&
      f.typeOrgane === "BUREAU" &&
      PRESIDENCE_ASSEMBLEE.test((f.qualite ?? "").trim()),
  );
