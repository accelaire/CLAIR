import type { SearchCategorie } from "@clair/data";
import { asString, buildHref, type QueryParams } from "@clair/ui";

/** Catégories filtrables, dans l'ordre des filtres et des sections de apps/web. */
export const CATEGORIES: readonly SearchCategorie[] = [
  "deputes",
  "senateurs",
  "groupes",
  "commissions",
  "scrutins",
  "sujets",
  "lobbyistes",
  "dossiers",
];

export type FiltreRecherche = "all" | SearchCategorie;

/** Longueur minimale d'une recherche (l'API refuse en dessous). */
export const LONGUEUR_MIN = 2;

/** Résultats par page pour une catégorie seule (comme apps/web). */
export const PAR_PAGE = 30;

/**
 * État de la recherche dans l'URL : `?q=…`, `?type=deputes` (tout par défaut) et `?anciens=1`
 * (mandats clos et organes dissous inclus).
 */
export type RechercheParams = { q: string; type: FiltreRecherche; anciens: boolean };

const estCategorie = (valeur: string): valeur is SearchCategorie =>
  CATEGORIES.some((categorie) => categorie === valeur);

export const parseRechercheParams = (params: QueryParams = {}): RechercheParams => {
  const type = asString(params.type);
  return {
    q: asString(params.q).trim(),
    type: estCategorie(type) ? type : "all",
    anciens: asString(params.anciens) === "1",
  };
};

/** Paramètres d'URL de la recherche ; les valeurs par défaut sont omises. */
export const rechercheParamsOf = ({ q, type, anciens }: RechercheParams) => ({
  q: q.trim() || undefined,
  type: type === "all" ? undefined : type,
  anciens: anciens ? "1" : undefined,
});

/** Adresse de la page de recherche pour un terme (formulaire de l'accueil). */
export const rechercheHref = (q: string) => buildHref("/recherche", { q: q.trim() });

/** La recherche est-elle assez longue pour interroger l'API ? */
export const rechercheValide = ({ q }: Pick<RechercheParams, "q">) => q.length >= LONGUEUR_MIN;

/**
 * Requête `/search` : toutes les catégories (aperçu de chacune), ou une seule, paginée.
 * `inclureAnciens` est toujours transmis, comme apps/web : la clé de cache reste explicite.
 */
export const searchQueryOf = ({ q, type, anciens }: RechercheParams, page = 1) =>
  type === "all"
    ? { q, type, inclureAnciens: String(anciens) }
    : { q, type, limit: PAR_PAGE, page, inclureAnciens: String(anciens) };
