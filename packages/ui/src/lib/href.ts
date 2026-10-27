/** Paramètres d'URL tels que les fournit le routeur (`?chambre=an&groupe=a&groupe=b`). */
export type QueryParams = Record<string, string | string[] | undefined>;

/** Construit une URL à partir d'un chemin et de paramètres ; les valeurs vides sont omises. */
export const buildHref = (
  pathname: string,
  params: Record<string, string | string[] | number | boolean | null | undefined>,
) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === null || item === undefined || item === "" || item === false) continue;
      search.append(key, String(item));
    }
  }
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
};

/** Ajoute ou retire une valeur d'une liste. */
export const toggle = <T>(values: readonly T[], value: T): T[] =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/** Valeurs d'un paramètre répété (`?groupe=a&groupe=b`). */
export const asArray = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/** Première valeur d'un paramètre, ou chaîne vide. */
export const asString = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? "";
