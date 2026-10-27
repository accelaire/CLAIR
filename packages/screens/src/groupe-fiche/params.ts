import { asString, type QueryParams, type SortDirection } from "@clair/ui";

/** Tri de la liste des membres. */
export type TriMembres = "nom" | "presence" | "loyaute";

/**
 * État de la fiche d'un groupe dans l'URL. `legislature` et `session` sont ceux de apps/web (la
 * composition d'époque) ; `initie` (scrutins demandés par le groupe) et `tri`/`ordre` (membres)
 * étaient gardés en mémoire par apps/web et passent dans l'adresse pour être partageables.
 */
export type GroupeFicheParams = {
  legislature: string;
  session: string;
  initie: boolean;
  tri: TriMembres;
  ordre: SortDirection;
};

const NOMBRE = /^\d{1,4}$/;
const TRIS: TriMembres[] = ["nom", "presence", "loyaute"];

/** Sens par défaut d'un tri : alphabétique croissant, statistiques décroissantes. */
export const ordreParDefaut = (tri: TriMembres): SortDirection =>
  tri === "nom" ? "ascending" : "descending";

export const parseGroupeFicheParams = (params: QueryParams = {}): GroupeFicheParams => {
  const legislature = asString(params.legislature);
  const session = asString(params.session);
  const tri = TRIS.find((valeur) => valeur === asString(params.tri)) ?? "nom";
  const ordre = asString(params.ordre);
  return {
    legislature: NOMBRE.test(legislature) ? legislature : "",
    session: NOMBRE.test(session) ? session : "",
    initie: asString(params.initie) === "1",
    tri,
    ordre: ordre === "asc" ? "ascending" : ordre === "desc" ? "descending" : ordreParDefaut(tri),
  };
};

/** Paramètres d'URL ; les valeurs par défaut sont omises. */
export const groupeFicheParamsOf = ({
  legislature,
  session,
  initie,
  tri,
  ordre,
}: GroupeFicheParams) => ({
  legislature,
  session,
  initie: initie ? "1" : null,
  tri: tri === "nom" ? null : tri,
  ordre: ordre === ordreParDefaut(tri) ? null : ordre === "ascending" ? "asc" : "desc",
});

/** Période de la fiche, transmise à chaque requête de l'API. */
export const periodeQueryOf = ({ legislature, session }: GroupeFicheParams) => ({
  legislature,
  session,
});
