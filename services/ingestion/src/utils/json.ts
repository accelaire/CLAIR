// =============================================================================
// Helpers de navigation dans du JSON non typé
// =============================================================================
//
// Les payloads bruts (AN, Sénat, HATVP) n'ont pas de schéma garanti. Plutôt que
// de les typer `any`, on les traite en `unknown` et on narrow explicitement.

/** Objet JSON dont on ne connaît pas la forme. */
export type JsonRecord = Record<string, unknown>;

/** Vrai si la valeur est un objet indexable (et pas null / un tableau primitif). */
export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

/** Normalise un champ qui peut être un objet seul OU un tableau d'objets. */
export function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Lit une propriété string, `undefined` si absente ou d'un autre type. */
export function readString(source: unknown, key: string): string | undefined {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}
