import type { Chambre } from "@clair/data";
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
  /** `type` : nature des prises de parole (onglet Interventions) ; vide : toutes. */
  type: TypeIntervention | "";
  /** `chambre` : chambre des listes, pour un élu passé par les deux ; vide : les deux. */
  chambre: Chambre | "";
};

/**
 * Natures de prise de parole proposées en filtre, dans l'ordre et avec les libellés de
 * apps/web (`interventions-list.tsx`) ; ce sont les valeurs qu'accepte l'API (`type`).
 */
export const TYPES_INTERVENTION = [
  { valeur: "intervention", libelle: "Interventions" },
  { valeur: "question", libelle: "Questions posées" },
  { valeur: "reponse_gouvernement", libelle: "Réponses du Gouvernement" },
  { valeur: "explication_vote", libelle: "Explications de vote" },
  { valeur: "interruption", libelle: "Interruptions en séance" },
] as const;

export type TypeIntervention = (typeof TYPES_INTERVENTION)[number]["valeur"];

const typeDe = (valeur: string): TypeIntervention | "" =>
  TYPES_INTERVENTION.find((type) => type.valeur === valeur)?.valeur ?? "";

const chambreDe = (valeur: string): Chambre | "" =>
  valeur === "assemblee" || valeur === "senat" ? valeur : "";

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
    type: typeDe(asString(params.type)),
    chambre: chambreDe(asString(params.chambre)),
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
  if (filtres.type) params.type = filtres.type;
  if (filtres.chambre) params.chambre = filtres.chambre;
  return params;
};

/** Période et chambre : filtres communs aux trois listes. */
const periodeOf = (filtres: ParlementaireFicheFiltres) => {
  const query: Record<string, string> = {};
  if (filtres.dateFrom) query.dateFrom = filtres.dateFrom;
  if (filtres.dateTo) query.dateTo = filtres.dateTo;
  if (filtres.chambre) query.chambre = filtres.chambre;
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
  ...(filtres.type ? { type: filtres.type } : {}),
});
