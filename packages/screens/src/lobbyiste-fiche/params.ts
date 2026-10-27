import { asString, type QueryParams } from "@clair/ui";

/** État de la fiche d'un représentant d'intérêts dans l'URL (mêmes clés que apps/web). */
export type LobbyisteFicheParams = {
  /** Jour `YYYY-MM-DD` : début de la période des actions affichées. */
  dateFrom: string;
  dateTo: string;
};

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Lit l'URL ; une date mal formée est ignorée. */
export const parseLobbyisteFicheParams = (params: QueryParams = {}): LobbyisteFicheParams => {
  const dateFrom = asString(params.dateFrom);
  const dateTo = asString(params.dateTo);
  return {
    dateFrom: JOUR.test(dateFrom) ? dateFrom : "",
    dateTo: JOUR.test(dateTo) ? dateTo : "",
  };
};

/** Paramètres d'URL ; les bornes vides sont omises. */
export const lobbyisteFicheParamsOf = (params: LobbyisteFicheParams) => ({
  dateFrom: params.dateFrom,
  dateTo: params.dateTo,
});

/**
 * L'action est-elle dans la période ? Comparaison sur le jour (`YYYY-MM-DD`), bornes incluses ;
 * une action sans date reste affichée (comme dans apps/web).
 */
export const dansLaPeriode = (
  dateDebut: string | null,
  { dateFrom, dateTo }: LobbyisteFicheParams,
) => {
  if (!dateDebut) return true;
  const jour = dateDebut.slice(0, 10);
  if (dateFrom && jour < dateFrom) return false;
  if (dateTo && jour > dateTo) return false;
  return true;
};
