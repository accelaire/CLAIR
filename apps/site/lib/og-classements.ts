/**
 * Adresse de l'image de partage des classements (`app/classements/og/route.tsx`), reprise de
 * `/api/og?type=classement…` de apps/web : l'image suit l'onglet, la chambre, le critère et le
 * parlementaire mis en avant de la page partagée.
 *
 * Fonctions pures, sans dépendance d'exécution (testées par `node --test`).
 */

/** Paramètres de la page que l'image reprend ; les autres (page, ordre, filtre de groupe) n'y changent rien. */
const CLES = ["tab", "chambre", "sort", "periode", "highlight", "rank", "groupeSort"] as const;

/**
 * Version du rendu, reportée dans l'adresse (`v`) : les réseaux gardent une image par adresse. À
 * incrémenter seulement quand une image déjà diffusée devient fausse.
 */
export const OG_CLASSEMENTS_VERSION = "1";

type Valeur = string | string[] | null | undefined;

const premier = (valeur: Valeur) => (Array.isArray(valeur) ? valeur[0] : valeur) ?? "";

/** Requête de l'image pour les paramètres d'une page `/classements` (valeurs vides omises). */
export const queryImageClassements = (params: Record<string, Valeur>): string => {
  const query = new URLSearchParams();
  for (const cle of CLES) {
    const valeur = premier(params[cle]).trim();
    if (valeur) query.set(cle, valeur);
  }
  query.set("v", OG_CLASSEMENTS_VERSION);
  return query.toString();
};

/**
 * Traduit une ancienne adresse `/api/og?type=classement…` de apps/web (déjà partagée sur les
 * réseaux) en requête de la nouvelle image ; `null` pour un autre type.
 */
export const depuisAncienneImage = (recherche: URLSearchParams): string | null => {
  const lire = (cle: string) => recherche.get(cle) ?? undefined;
  switch (recherche.get("type")) {
    case "classement":
      return queryImageClassements({ sort: lire("sort"), chambre: lire("chambre") });
    case "classement-parlementaire":
      return queryImageClassements({
        highlight: lire("slug"),
        sort: lire("sort"),
        rank: lire("rank"),
      });
    case "classement-groupes":
      return queryImageClassements({
        tab: "groupes",
        chambre: lire("chambre"),
        groupeSort: lire("sort"),
      });
    default:
      return null;
  }
};
