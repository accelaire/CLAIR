import {
  LOBBYING_CIBLE_LIBELLES,
  LOBBYISTE_TYPE_LIBELLES,
  type LobbyingCible,
  type LobbyisteType,
  type SecteurRef,
} from "@clair/data";

/** Formats partagés par les écrans du lobbying (liste, fiche, actions). */

const isType = (value: string): value is LobbyisteType => value in LOBBYISTE_TYPE_LIBELLES;
const isCible = (value: string): value is LobbyingCible => value in LOBBYING_CIBLE_LIBELLES;

/** Libellé d'un type de représentant d'intérêts ; une valeur inconnue reste telle quelle. */
export const typeLibelle = (type: string | null) =>
  type ? (isType(type) ? LOBBYISTE_TYPE_LIBELLES[type] : type) : null;

/** Libellé court d'une cible ; une valeur inconnue reste telle quelle. */
export const cibleLibelle = (cible: string | null) =>
  cible ? (isCible(cible) ? LOBBYING_CIBLE_LIBELLES[cible] : cible) : null;

const euros = (maximumFractionDigits: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits,
  });

/** Budget déclaré, en notation compacte (« 1,2 M€ ») ; `null` s'il n'est pas déclaré. */
export const formatBudget = (budget: number | null) => (budget ? euros(1).format(budget) : null);

/** « 31 mars 2026 ». */
export const formatJour = (date: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(date));

const PREFIXE_SECTEURS = /^\[([^\]]+)\]\s*/;

/**
 * Sépare les secteurs écrits entre crochets en tête de la description (« [Énergie] Objet »)
 * de l'objet de l'action. Les secteurs normalisés (`secteursList`) priment quand ils existent.
 */
export const objetEtSecteurs = (description: string, secteursList: SecteurRef[]) => {
  const match = description.match(PREFIXE_SECTEURS);
  const objet = (match ? description.slice(match[0].length) : description).trim();
  const secteurs =
    secteursList.length > 0
      ? secteursList.map((secteur) => secteur.label)
      : match?.[1]
        ? [match[1]]
        : [];
  return { objet, secteurs };
};

/** Secteurs d'un représentant : la liste normalisée, sinon le texte déclaré. */
export const secteursLibelle = (secteursList: SecteurRef[], secteur: string | null) =>
  secteursList.length > 0 ? secteursList.map((item) => item.label).join(", ") : (secteur ?? "");
