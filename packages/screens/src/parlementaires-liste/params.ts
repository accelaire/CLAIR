import type { Chambre } from "@clair/data";
import { asArray, asString, type QueryParams } from "@clair/ui";
import { CHAMBRE_CONFIG, MAX_COMPARAISON } from "../shared/parlementaires/chambre.ts";

/** Tris proposés, avec leur traduction en paramètres de l'API (`sort`, `order`). */
export const TRIS = {
  nom: { label: "Nom (A → Z)", sort: "nom", order: "asc" },
  prenom: { label: "Prénom (A → Z)", sort: "prenom", order: "asc" },
  presence: { label: "Présence", sort: "presence", order: "desc" },
  loyaute: { label: "Loyauté au groupe", sort: "loyaute", order: "desc" },
  amendements: { label: "Amendements déposés", sort: "amendements", order: "desc" },
  interventions: { label: "Interventions", sort: "interventions", order: "desc" },
} as const;

export type TriListe = keyof typeof TRIS;

export const estTri = (valeur: string): valeur is TriListe => Object.hasOwn(TRIS, valeur);

/** Résultats par page (comme apps/web). */
export const PAR_PAGE = 24;

/** État de la liste, lu dans l'URL. */
export type ParlementairesListeFiltres = {
  /** `search` : nom, prénom, département ou circonscription. */
  recherche: string;
  /** `groupe` : slug du groupe politique. */
  groupe: string;
  /** `legislature` (Assemblée) ou `session` (Sénat) ; vide : période en cours. */
  periode: string;
  /** `tri`. */
  tri: TriListe;
  /** `page`, à partir de 1. */
  page: number;
  /** `compare` : slugs choisis pour le comparateur (séparés par des virgules). */
  comparer: string[];
};

/** Slugs d'un paramètre `a,b` ou répété (`?compare=a&compare=b`), sans doublon. */
export const slugsDe = (valeur: string | string[] | undefined, max: number) =>
  [
    ...new Set(
      asArray(valeur)
        .flatMap((item) => item.split(","))
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ].slice(0, max);

const pageDe = (valeur: string) => {
  const page = Number.parseInt(valeur, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
};

export const parseParlementairesListeParams = (
  params: QueryParams,
  chambre: Chambre,
): ParlementairesListeFiltres => {
  const tri = asString(params.tri);
  return {
    recherche: asString(params.search).trim(),
    groupe: asString(params.groupe),
    periode: asString(params[CHAMBRE_CONFIG[chambre].periode]),
    tri: estTri(tri) ? tri : "nom",
    page: pageDe(asString(params.page)),
    comparer: slugsDe(params.compare, MAX_COMPARAISON),
  };
};

/** Paramètres d'URL de la liste ; les valeurs par défaut sont omises. */
export const parlementairesListeParamsOf = (
  filtres: ParlementairesListeFiltres,
  chambre: Chambre,
): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filtres.recherche) params.search = filtres.recherche;
  if (filtres.groupe) params.groupe = filtres.groupe;
  if (filtres.periode) params[CHAMBRE_CONFIG[chambre].periode] = filtres.periode;
  if (filtres.tri !== "nom") params.tri = filtres.tri;
  if (filtres.page > 1) params.page = String(filtres.page);
  if (filtres.comparer.length > 0) params.compare = filtres.comparer.join(",");
  return params;
};

/**
 * Requête de l'API pour une page de la liste. Partagée par la route (chargement serveur) et
 * l'écran : la clé de cache est la même, les données du serveur sont reprises sans nouvel appel.
 */
export const listeQueryOf = (
  filtres: ParlementairesListeFiltres,
  chambre: Chambre,
): Record<string, string> => {
  const { sort, order } = TRIS[filtres.tri];
  const query: Record<string, string> = {
    page: String(filtres.page),
    limit: String(PAR_PAGE),
    sort,
    order,
  };
  if (filtres.recherche) query.search = filtres.recherche;
  if (filtres.groupe) query.groupe = filtres.groupe;
  if (filtres.periode) query[CHAMBRE_CONFIG[chambre].periode] = filtres.periode;
  return query;
};

/**
 * Requête des groupes du filtre, bornée à la période choisie. `/senateurs` attend la session en
 * « 2024-2025 », mais `/senateurs/groupes` en année de début (« 2024 ») : envoyée telle quelle,
 * elle était ignorée et le filtre proposait les groupes de la session courante.
 */
export const groupesQueryOf = (
  filtres: ParlementairesListeFiltres,
  chambre: Chambre,
): Record<string, string> => {
  if (!filtres.periode) return {};
  const valeur = chambre === "senat" ? filtres.periode.slice(0, 4) : filtres.periode;
  return { [CHAMBRE_CONFIG[chambre].periode]: valeur };
};

/** Chemins de l'API de la liste. */
export const listePaths = (chambre: Chambre) => {
  const { chemin } = CHAMBRE_CONFIG[chambre];
  return {
    liste: chemin,
    groupes: `${chemin}/groupes`,
    periodes: chambre === "senat" ? `${chemin}/sessions` : `${chemin}/legislatures`,
  };
};
