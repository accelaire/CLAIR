import { asString, type ChambreSwitchValue, type QueryParams } from "@clair/ui";

export type OngletClassement = "parlementaires" | "groupes";
export type CritereParlementaire = "presence" | "loyaute" | "amendements" | "interventions" | "nom";
export type CritereGroupe = "presence" | "loyaute" | "cohesion" | "membres";
export type PeriodeStats = "mandat" | "carriere";
export type Ordre = "asc" | "desc";

/** Nombre de parlementaires par page (comme apps/web). */
export const PAR_PAGE = 50;

/** État des classements dans l'URL, avec les clés de apps/web. */
export type ClassementsParams = {
  tab: OngletClassement;
  chambre: ChambreSwitchValue;
  sort: CritereParlementaire;
  order: Ordre;
  periode: PeriodeStats;
  groupe: string;
  /** Page demandée ; `null` : déduite du rang du parlementaire mis en avant, sinon 1. */
  page: number | null;
  /** Slug du parlementaire (ou du groupe) mis en avant. */
  highlight: string;
  /** Rang du parlementaire mis en avant, s'il est connu. */
  rank: number | null;
  groupeSort: CritereGroupe;
};

const CRITERES: CritereParlementaire[] = [
  "presence",
  "loyaute",
  "amendements",
  "interventions",
  "nom",
];
const CRITERES_GROUPE: CritereGroupe[] = ["presence", "loyaute", "cohesion", "membres"];
const SLUG = /^[a-z0-9-]{1,120}$/;

const entier = (value: string) => {
  const nombre = Number.parseInt(value, 10);
  return Number.isInteger(nombre) && nombre > 0 ? nombre : null;
};

export const parseClassementsParams = (params: QueryParams = {}): ClassementsParams => {
  const chambre = asString(params.chambre);
  const groupe = asString(params.groupe);
  const highlight = asString(params.highlight);
  return {
    tab: asString(params.tab) === "groupes" ? "groupes" : "parlementaires",
    chambre: chambre === "assemblee" || chambre === "senat" ? chambre : "",
    sort: CRITERES.find((critere) => critere === asString(params.sort)) ?? "presence",
    order: asString(params.order) === "asc" ? "asc" : "desc",
    periode: asString(params.periode) === "carriere" ? "carriere" : "mandat",
    groupe: SLUG.test(groupe) ? groupe : "",
    page: entier(asString(params.page)),
    highlight: SLUG.test(highlight) ? highlight : "",
    rank: entier(asString(params.rank)),
    groupeSort:
      CRITERES_GROUPE.find((critere) => critere === asString(params.groupeSort)) ?? "presence",
  };
};

/** Paramètres d'URL ; les valeurs par défaut sont omises. */
export const classementsParamsOf = (params: ClassementsParams) => ({
  tab: params.tab === "parlementaires" ? null : params.tab,
  chambre: params.chambre,
  sort: params.sort === "presence" ? null : params.sort,
  order: params.order === "desc" ? null : params.order,
  periode: params.periode === "mandat" ? null : params.periode,
  groupe: params.groupe,
  page: params.page !== null && params.page > 1 ? params.page : null,
  highlight: params.highlight,
  rank: params.rank,
  groupeSort: params.groupeSort === "presence" ? null : params.groupeSort,
});

/** Page affichée : celle de l'URL, sinon celle du rang mis en avant, sinon 1. */
export const pageEffective = (params: ClassementsParams, rang: number | null) =>
  params.page ?? (rang ? Math.ceil(rang / PAR_PAGE) : 1);

/** Requête `/parlementaires` du classement. */
export const classementQueryOf = (params: ClassementsParams, page: number) => ({
  chambre: params.chambre,
  sort: params.sort,
  order: params.order,
  periode: params.periode,
  groupe: params.groupe,
  page,
  limit: PAR_PAGE,
});
