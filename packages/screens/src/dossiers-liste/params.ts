import { asString, type QueryParams } from "@clair/ui";

/** États proposés en filtre : ceux que l'API accepte (`etat` de `/dossiers`). */
export const ETATS_FILTRABLES = ["en_cours", "adopte", "rejete", "promulgue"] as const;
export type EtatFiltrable = (typeof ETATS_FILTRABLES)[number];

/** État de la liste des dossiers, tel qu'il s'écrit dans l'URL (mêmes clés que apps/web). */
export type DossiersListeParams = {
  search: string;
  etat: EtatFiltrable | "";
  chambre: "assemblee" | "senat" | "";
  procedureCode: string;
  procedureLibelle: string;
  /** Jour `YYYY-MM-DD` (date de dépôt). */
  dateFrom: string;
  dateTo: string;
  page: number;
};

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

const isEtat = (value: string): value is EtatFiltrable =>
  (ETATS_FILTRABLES as readonly string[]).includes(value);

/** Lit l'URL ; une valeur inconnue ou mal formée est ignorée. */
export const parseDossiersListeParams = (params: QueryParams = {}): DossiersListeParams => {
  const etat = asString(params.etat);
  const chambre = asString(params.chambre);
  const dateFrom = asString(params.dateFrom);
  const dateTo = asString(params.dateTo);
  const page = Number.parseInt(asString(params.page), 10);
  return {
    search: asString(params.search).trim(),
    etat: isEtat(etat) ? etat : "",
    chambre: chambre === "assemblee" || chambre === "senat" ? chambre : "",
    procedureCode: asString(params.procedureCode),
    procedureLibelle: asString(params.procedureLibelle),
    dateFrom: JOUR.test(dateFrom) ? dateFrom : "",
    dateTo: JOUR.test(dateTo) ? dateTo : "",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
};

/** Paramètres d'URL ; les valeurs par défaut (page 1, filtres vides) sont omises. */
export const dossiersListeParamsOf = (params: DossiersListeParams) => ({
  search: params.search,
  etat: params.etat,
  chambre: params.chambre,
  procedureCode: params.procedureCode,
  procedureLibelle: params.procedureLibelle,
  dateFrom: params.dateFrom,
  dateTo: params.dateTo,
  page: params.page > 1 ? params.page : null,
});

/** Paramètres de la requête `/dossiers` (20 dossiers par page, comme apps/web). */
export const dossiersQueryOf = (params: DossiersListeParams) => ({
  ...dossiersListeParamsOf(params),
  page: params.page,
  limit: 20,
});

/** Au moins un filtre actif (hors pagination). */
export const aDesFiltres = (params: DossiersListeParams) =>
  Boolean(
    params.search ||
      params.etat ||
      params.chambre ||
      params.procedureCode ||
      params.procedureLibelle ||
      params.dateFrom ||
      params.dateTo,
  );
