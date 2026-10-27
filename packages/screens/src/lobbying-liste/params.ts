import { LOBBYISTE_TYPES, type LobbyisteType } from "@clair/data";
import { asString, type QueryParams } from "@clair/ui";

/** Critères de tri acceptés par `/lobbying`. */
export const TRIS_LOBBYISTES = ["nom", "budget", "actions"] as const;
export type TriLobbyistes = (typeof TRIS_LOBBYISTES)[number];
export type Ordre = "asc" | "desc";

/**
 * État de la liste des représentants d'intérêts, tel qu'il s'écrit dans l'URL (mêmes clés que
 * apps/web : `search`, `type`, `secteurs` séparés par des virgules, `sort`, `order`, `page`).
 */
export type LobbyingListeParams = {
  search: string;
  type: LobbyisteType | "";
  secteurs: string[];
  sort: TriLobbyistes;
  order: Ordre;
  page: number;
};

const isType = (value: string): value is LobbyisteType =>
  (LOBBYISTE_TYPES as readonly string[]).includes(value);
const isTri = (value: string): value is TriLobbyistes =>
  (TRIS_LOBBYISTES as readonly string[]).includes(value);

/** Numéro de page lu dans l'URL (1 par défaut). */
export const parsePage = (value: string | string[] | undefined) => {
  const page = Number.parseInt(asString(value), 10);
  return Number.isFinite(page) && page > 1 ? page : 1;
};

/** Liste séparée par des virgules (`?secteurs=energie,sante`). */
export const parseListe = (value: string | string[] | undefined) =>
  asString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** Lit l'URL ; une valeur inconnue est ignorée. */
export const parseLobbyingListeParams = (params: QueryParams = {}): LobbyingListeParams => {
  const type = asString(params.type);
  const sort = asString(params.sort);
  return {
    search: asString(params.search).trim(),
    type: isType(type) ? type : "",
    secteurs: parseListe(params.secteurs),
    sort: isTri(sort) ? sort : "nom",
    order: asString(params.order) === "desc" ? "desc" : "asc",
    page: parsePage(params.page),
  };
};

/** Paramètres d'URL ; les valeurs par défaut (tri par nom croissant, page 1) sont omises. */
export const lobbyingListeParamsOf = (params: LobbyingListeParams) => {
  const triParDefaut = params.sort === "nom" && params.order === "asc";
  return {
    search: params.search,
    type: params.type,
    secteurs: params.secteurs.join(","),
    sort: triParDefaut ? null : params.sort,
    order: triParDefaut ? null : params.order,
    page: params.page > 1 ? params.page : null,
  };
};

/** Paramètres de la requête `/lobbying` (20 par page, comme apps/web). */
export const lobbyistesQueryOf = (params: LobbyingListeParams) => ({
  search: params.search,
  type: params.type,
  secteurs: params.secteurs.join(","),
  sort: params.sort,
  order: params.order,
  page: params.page,
  limit: 20,
});

/** Au moins un filtre actif (hors tri et pagination). */
export const aDesFiltres = (params: LobbyingListeParams) =>
  Boolean(params.search || params.type || params.secteurs.length > 0);
