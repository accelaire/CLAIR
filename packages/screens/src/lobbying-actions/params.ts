import { LOBBYING_CIBLES, type LobbyingCible } from "@clair/data";
import { asString, type QueryParams } from "@clair/ui";
import { type Ordre, parseListe, parsePage } from "../lobbying-liste/params.ts";

/** Textes visés proposés en filtre : valeurs du répertoire de la HATVP (`texteVise`). */
export const TEXTES_VISES = [
  { value: "Lois, y compris constitutionnelles", label: "Lois" },
  { value: "Actes réglementaires", label: "Actes réglementaires" },
  { value: "Autres décisions publiques", label: "Autres décisions publiques" },
  { value: "Décisions d'espèce", label: "Décisions d'espèce" },
  {
    value: "Ordonnances de l'article 38 de la Constitution",
    label: "Ordonnances (article 38)",
  },
  {
    value: "Marchés publics d'une valeur supérieure aux seuils européens",
    label: "Marchés publics",
  },
] as const;

export type TriActions = "dateDebut" | "lobbyiste";

/**
 * État de la liste des actions de lobbying, tel qu'il s'écrit dans l'URL (mêmes clés que
 * apps/web : `search`, `cible`, `texteVise`, `secteurs`, `sort`, `order`, `dateFrom`, `dateTo`,
 * plus `page`).
 */
export type LobbyingActionsParams = {
  search: string;
  cible: LobbyingCible | "";
  texteVise: string;
  secteurs: string[];
  sort: TriActions;
  order: Ordre;
  dateFrom: string;
  dateTo: string;
  page: number;
};

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

const isCible = (value: string): value is LobbyingCible =>
  (LOBBYING_CIBLES as readonly string[]).includes(value);

/** Lit l'URL ; une valeur inconnue ou mal formée est ignorée. */
export const parseLobbyingActionsParams = (params: QueryParams = {}): LobbyingActionsParams => {
  const cible = asString(params.cible);
  const texteVise = asString(params.texteVise);
  const dateFrom = asString(params.dateFrom);
  const dateTo = asString(params.dateTo);
  return {
    search: asString(params.search).trim(),
    cible: isCible(cible) ? cible : "",
    texteVise: TEXTES_VISES.some((texte) => texte.value === texteVise) ? texteVise : "",
    secteurs: parseListe(params.secteurs),
    sort: asString(params.sort) === "lobbyiste" ? "lobbyiste" : "dateDebut",
    order: asString(params.order) === "asc" ? "asc" : "desc",
    dateFrom: JOUR.test(dateFrom) ? dateFrom : "",
    dateTo: JOUR.test(dateTo) ? dateTo : "",
    page: parsePage(params.page),
  };
};

/** Paramètres d'URL ; les valeurs par défaut (date décroissante, page 1) sont omises. */
export const lobbyingActionsParamsOf = (params: LobbyingActionsParams) => {
  const triParDefaut = params.sort === "dateDebut" && params.order === "desc";
  return {
    search: params.search,
    cible: params.cible,
    texteVise: params.texteVise,
    secteurs: params.secteurs.join(","),
    sort: triParDefaut ? null : params.sort,
    order: triParDefaut ? null : params.order,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page: params.page > 1 ? params.page : null,
  };
};

/** Paramètres de la requête `/lobbying/actions` (20 par page, comme apps/web). */
export const actionsQueryOf = (params: LobbyingActionsParams) => ({
  ...lobbyingActionsParamsOf(params),
  sort: params.sort,
  order: params.order,
  page: params.page,
  limit: 20,
});

/** Au moins un filtre actif (hors tri et pagination). */
export const aDesFiltres = (params: LobbyingActionsParams) =>
  Boolean(
    params.search ||
      params.cible ||
      params.texteVise ||
      params.secteurs.length > 0 ||
      params.dateFrom ||
      params.dateTo,
  );
