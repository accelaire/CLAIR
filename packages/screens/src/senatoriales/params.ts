import type { TriSortants } from "@clair/data";
import { asString, type QueryParams } from "@clair/ui";
import { TRIS_SORTANTS } from "./lib/graphiques.ts";

/**
 * État de la page des sénatoriales dans l'URL, comme apps/web : `?search=` (recherche par nom,
 * faite dans le navigateur), `?departement=` (code INSEE), `?groupe=` (slug) et `?tri=`.
 */
export type SenatorialesParams = {
  search: string;
  departement: string;
  groupe: string;
  /** Vide : tri par défaut de l'API (département). */
  tri: TriSortants | "";
};

/**
 * Les filtres décrivent des ensembles finis : un code INSEE, un slug de groupe. Les borner évite
 * qu'une valeur libre fasse répondre 400 à l'API (tri inconnu) ou multiplie les entrées de cache
 * d'une page rendue à la demande (même règle que `lireFiltres` de apps/web).
 */
const DEPARTEMENT_VALIDE = /^(?:\d{2,3}|2[AB])$/;
const GROUPE_VALIDE = /^[a-z0-9-]{1,60}$/;

const estTri = (valeur: string): valeur is TriSortants =>
  (TRIS_SORTANTS as readonly string[]).includes(valeur);

export const parseSenatorialesParams = (params: QueryParams = {}): SenatorialesParams => {
  const departement = asString(params.departement);
  const groupe = asString(params.groupe);
  const tri = asString(params.tri);
  return {
    search: asString(params.search),
    departement: DEPARTEMENT_VALIDE.test(departement) ? departement : "",
    groupe: GROUPE_VALIDE.test(groupe) ? groupe : "",
    tri: estTri(tri) ? tri : "",
  };
};

/** Paramètres d'URL de la page ; les valeurs vides sont omises. */
export const senatorialesParamsOf = (params: SenatorialesParams) => ({
  search: params.search || undefined,
  departement: params.departement || undefined,
  groupe: params.groupe || undefined,
  tri: params.tri || undefined,
});

/**
 * Requête de `/senatoriales/2026/sortants`. La recherche n'y figure pas : elle se fait dans le
 * navigateur, sur la liste reçue.
 */
export const sortantsQueryOf = ({ departement, groupe, tri }: SenatorialesParams) => ({
  departement: departement || undefined,
  groupe: groupe || undefined,
  tri: tri || undefined,
});

/** Un filtre restreint-il réellement la liste (un tri ne fait que la réordonner) ? */
export const listeRestreinte = ({ departement, groupe }: SenatorialesParams) =>
  Boolean(departement || groupe);

/** Requête des sortants d'une circonscription, par ordre alphabétique (comme apps/web). */
export const sortantsCirconscriptionQuery = (code: string) => ({ departement: code, tri: "nom" });
