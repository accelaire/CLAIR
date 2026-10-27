import { asString, type QueryParams } from "@clair/ui";

/** État de la liste des sujets dans l'URL : `?search=…` (comme apps/web). */
export type SujetsListeParams = { search: string };

export const parseSujetsListeParams = (params: QueryParams = {}): SujetsListeParams => ({
  search: asString(params.search).trim(),
});

/** Paramètres d'URL de la liste ; une recherche vide est omise. */
export const sujetsListeParamsOf = ({ search }: SujetsListeParams) => ({
  search: search.trim() || undefined,
});
