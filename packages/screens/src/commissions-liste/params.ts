import { COMMISSION_TYPES, type CommissionType } from "@clair/data";
import { asString, type QueryParams } from "@clair/ui";

/**
 * État de la liste des commissions dans l'URL. Mêmes clés que apps/web (`chambre`, `type`,
 * `historique=1`) ; `search` y ajoute la recherche, que apps/web gardait en mémoire.
 */
export type CommissionsListeParams = {
  search: string;
  chambre: "assemblee" | "senat" | "";
  type: CommissionType | "";
  /** Inclure les organes qui ne siègent plus. */
  historique: boolean;
};

const isType = (value: string): value is CommissionType =>
  (COMMISSION_TYPES as readonly string[]).includes(value);

/** Lit l'URL ; une valeur inconnue est ignorée. */
export const parseCommissionsListeParams = (params: QueryParams = {}): CommissionsListeParams => {
  const chambre = asString(params.chambre);
  const type = asString(params.type);
  return {
    search: asString(params.search).trim(),
    chambre: chambre === "assemblee" || chambre === "senat" ? chambre : "",
    type: isType(type) ? type : "",
    historique: asString(params.historique) === "1",
  };
};

/** Paramètres d'URL ; les valeurs par défaut sont omises. */
export const commissionsListeParamsOf = (params: CommissionsListeParams) => ({
  search: params.search,
  chambre: params.chambre,
  type: params.type,
  historique: params.historique ? "1" : null,
});

/**
 * Requête `/commissions` : la recherche se fait sur la page (l'API ne la connaît pas), d'où la
 * limite haute, comme apps/web. Sans `historique`, seules les commissions actives.
 */
export const commissionsQueryOf = (params: CommissionsListeParams) => ({
  chambre: params.chambre,
  type: params.type,
  actif: params.historique ? null : "true",
  limit: 500,
});

/** La vue chargée par la route (aucun filtre d'API). */
export const estVueParDefaut = (params: CommissionsListeParams) =>
  !params.chambre && !params.type && !params.historique;

export const aDesFiltres = (params: CommissionsListeParams) =>
  Boolean(params.search || params.chambre || params.type || params.historique);
