import { asString, type QueryParams } from "@clair/ui";
import { slugsDe } from "../parlementaires-liste/params.ts";
import { MAX_COMPARAISON } from "../shared/parlementaires/chambre.ts";

/** État du comparateur, lu dans l'URL. */
export type ComparateurFiltres = {
  /** `slugs=a,b` (comme apps/web) : élus comparés, quatre au plus. */
  slugs: string[];
  /** `divergents=1` : seulement les scrutins où les positions diffèrent. */
  divergents: boolean;
};

export const parseComparateurParams = (params: QueryParams): ComparateurFiltres => ({
  slugs: slugsDe(params.slugs, MAX_COMPARAISON),
  divergents: ["1", "true"].includes(asString(params.divergents)),
});

export const comparateurParamsOf = (filtres: ComparateurFiltres): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filtres.slugs.length > 0) params.slugs = filtres.slugs.join(",");
  if (filtres.divergents) params.divergents = "1";
  return params;
};

/** Requête de l'API (`/deputes/compare?slugs=a,b`), partagée par la route et l'écran. */
export const compareQueryOf = (filtres: ComparateurFiltres): Record<string, string> => ({
  slugs: filtres.slugs.join(","),
});

/** Nombre de votes lus par élu pour trouver les scrutins communs. */
export const VOTES_COMPARES = 100;
