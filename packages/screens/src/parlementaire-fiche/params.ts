import { asString, type QueryParams } from "@clair/ui";

export const ONGLETS = [
  "votes",
  "amendements",
  "interventions",
  "mandats",
  "declarations",
] as const;

export type OngletFiche = (typeof ONGLETS)[number];

const estOnglet = (valeur: string): valeur is OngletFiche =>
  ONGLETS.some((onglet) => onglet === valeur);

/** État de la fiche, lu dans l'URL. */
export type ParlementaireFicheFiltres = {
  /** `onglet` ; `votes` par défaut. */
  onglet: OngletFiche;
  /** `page` de la liste de l'onglet, à partir de 1. */
  page: number;
  /** `dateFrom` et `dateTo` (AAAA-MM-JJ), comme apps/web. */
  dateFrom: string;
  dateTo: string;
  /** `dissidents=1` : votes différents de la position du groupe. */
  dissidents: boolean;
  /** `votesPublics=1` : amendements mis aux voix par scrutin public. */
  votesPublics: boolean;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateDe = (valeur: string) => (DATE.test(valeur) ? valeur : "");

const pageDe = (valeur: string) => {
  const page = Number.parseInt(valeur, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const vrai = (valeur: string) => valeur === "1" || valeur === "true";

export const parseParlementaireFicheParams = (params: QueryParams): ParlementaireFicheFiltres => {
  const onglet = asString(params.onglet);
  return {
    onglet: estOnglet(onglet) ? onglet : "votes",
    page: pageDe(asString(params.page)),
    dateFrom: dateDe(asString(params.dateFrom)),
    dateTo: dateDe(asString(params.dateTo)),
    dissidents: vrai(asString(params.dissidents)),
    votesPublics: vrai(asString(params.votesPublics)),
  };
};

/** Paramètres d'URL de la fiche ; les valeurs par défaut sont omises. */
export const parlementaireFicheParamsOf = (
  filtres: ParlementaireFicheFiltres,
): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filtres.onglet !== "votes") params.onglet = filtres.onglet;
  if (filtres.page > 1) params.page = String(filtres.page);
  if (filtres.dateFrom) params.dateFrom = filtres.dateFrom;
  if (filtres.dateTo) params.dateTo = filtres.dateTo;
  if (filtres.dissidents) params.dissidents = "1";
  if (filtres.votesPublics) params.votesPublics = "1";
  return params;
};

const periodeOf = (filtres: ParlementaireFicheFiltres) => {
  const query: Record<string, string> = {};
  if (filtres.dateFrom) query.dateFrom = filtres.dateFrom;
  if (filtres.dateTo) query.dateTo = filtres.dateTo;
  return query;
};

/** Requête de la fiche (statistiques comprises). */
export const FICHE_QUERY = { include: "stats" } as const;

/**
 * Requête des votes. Partagée par la route (chargement serveur de l'onglet par défaut) et
 * l'écran : même clé de cache.
 */
export const votesQueryOf = (filtres: ParlementaireFicheFiltres): Record<string, string> => ({
  page: String(filtres.page),
  limit: "20",
  ...periodeOf(filtres),
  ...(filtres.dissidents ? { dissidentOnly: "true" } : {}),
});

export const amendementsQueryOf = (filtres: ParlementaireFicheFiltres): Record<string, string> => ({
  page: String(filtres.page),
  limit: "20",
  ...periodeOf(filtres),
  ...(filtres.votesPublics ? { votedOnly: "true" } : {}),
});

export const interventionsQueryOf = (
  filtres: ParlementaireFicheFiltres,
): Record<string, string> => ({
  page: String(filtres.page),
  limit: "10",
  ...periodeOf(filtres),
});
