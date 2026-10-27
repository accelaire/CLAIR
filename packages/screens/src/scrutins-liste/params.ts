import { asString, type QueryParams } from "@clair/ui";

export const TYPES_FILTRABLES = ["solennel", "ordinaire", "motion"] as const;
export type TypeFiltrable = (typeof TYPES_FILTRABLES)[number];

/** Objets du vote proposés en filtre, du plus engageant au plus procédural (comme apps/web). */
export const NATURES_FILTRABLES = [
  "ensemble",
  "article",
  "amendement",
  "credits",
  "motion",
  "declaration",
] as const;
export type NatureFiltrable = (typeof NATURES_FILTRABLES)[number];

/** État de la liste des scrutins, tel qu'il s'écrit dans l'URL (mêmes clés que apps/web). */
export type ScrutinsListeParams = {
  search: string;
  chambre: "assemblee" | "senat" | "";
  type: TypeFiltrable | "";
  nature: NatureFiltrable | "";
  tag: string;
  /** Jour `YYYY-MM-DD`. */
  dateFrom: string;
  dateTo: string;
  page: number;
};

/** Scrutins par page (comme apps/web). */
export const SCRUTINS_PAR_PAGE = 20;

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

const parmi = <T extends string>(valeurs: readonly T[], valeur: string): T | "" =>
  valeurs.find((item) => item === valeur) ?? "";

/** Numéro de page de l'URL : entier ≥ 1, sinon 1. */
export const parsePage = (value: string | string[] | undefined) => {
  const raw = asString(value);
  if (!/^\d+$/.test(raw)) return 1;
  const page = Number.parseInt(raw, 10);
  return page >= 1 && page <= 10_000 ? page : 1;
};

/** Lit l'URL ; une valeur inconnue ou mal formée est ignorée. */
export const parseScrutinsListeParams = (params: QueryParams = {}): ScrutinsListeParams => {
  const chambre = asString(params.chambre);
  const dateFrom = asString(params.dateFrom);
  const dateTo = asString(params.dateTo);
  return {
    search: asString(params.search).trim(),
    chambre: chambre === "assemblee" || chambre === "senat" ? chambre : "",
    type: parmi(TYPES_FILTRABLES, asString(params.type)),
    nature: parmi(NATURES_FILTRABLES, asString(params.nature)),
    tag: asString(params.tag),
    dateFrom: JOUR.test(dateFrom) ? dateFrom : "",
    dateTo: JOUR.test(dateTo) ? dateTo : "",
    page: parsePage(params.page),
  };
};

/** Paramètres d'URL ; les valeurs par défaut (page 1, filtres vides) sont omises. */
export const scrutinsListeParamsOf = (params: ScrutinsListeParams) => ({
  search: params.search,
  chambre: params.chambre,
  type: params.type,
  nature: params.nature,
  tag: params.tag,
  dateFrom: params.dateFrom,
  dateTo: params.dateTo,
  page: params.page > 1 ? params.page : null,
});

/** Requête `/scrutins` correspondante (valeurs vides omises). */
export const scrutinsQueryOf = (params: ScrutinsListeParams): Record<string, string> =>
  Object.fromEntries(
    Object.entries({
      ...scrutinsListeParamsOf(params),
      page: params.page,
      limit: SCRUTINS_PAR_PAGE,
    })
      .filter(([, value]) => value !== null && value !== "")
      .map(([key, value]) => [key, String(value)]),
  );

/** Au moins un filtre actif (hors pagination). */
export const aDesFiltres = (params: ScrutinsListeParams) =>
  Boolean(
    params.search ||
      params.chambre ||
      params.type ||
      params.nature ||
      params.tag ||
      params.dateFrom ||
      params.dateTo,
  );
