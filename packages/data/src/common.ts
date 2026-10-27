/**
 * Formes communes des réponses de l'API (apps/api).
 *
 * L'API renvoie deux formes de pagination selon les modules : `meta` (parlementaires, scrutins,
 * dossiers, lobbying…) et `pagination` (commissions, agenda…). `pageOf` les ramène à une seule.
 */
export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
};

export type PageMeta<T> = { data: T[]; meta: PaginationMeta };
export type PagePagination<T> = { data: T[]; pagination: PaginationMeta };
export type ApiPage<T> = PageMeta<T> | PagePagination<T>;

/** Une page de résultats, quelle que soit la forme renvoyée par l'API. */
export type Page<T> = { items: T[]; total: number; page: number; totalPages: number };

export const pageOf = <T>(response: ApiPage<T>): Page<T> => {
  const meta = "meta" in response ? response.meta : response.pagination;
  return { items: response.data, total: meta.total, page: meta.page, totalPages: meta.totalPages };
};

export type Chambre = "assemblee" | "senat";

/** Libellés des chambres. */
export const CHAMBRES: Record<Chambre, { nom: string; court: string; membres: string }> = {
  assemblee: { nom: "Assemblée nationale", court: "AN", membres: "députés" },
  senat: { nom: "Sénat", court: "Sénat", membres: "sénateurs" },
};
