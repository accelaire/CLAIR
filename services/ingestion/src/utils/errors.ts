// =============================================================================
// Helpers d'erreur
// =============================================================================
//
// Sous `strict`, une variable de `catch` est typée `unknown` : on ne peut pas
// lire `.message` directement. Ces helpers normalisent l'accès sans réintroduire
// de `any`.

/** Message lisible d'une erreur inconnue (Error, string, ou autre). */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

/**
 * Lit une propriété d'une erreur non typée (ex: `status` d'une AxiosError,
 * `code` d'une erreur Node) sans supposer sa forme.
 */
export function errorProp<T = unknown>(error: unknown, key: string): T | undefined {
  if (typeof error === 'object' && error !== null && key in error) {
    return (error as Record<string, T>)[key];
  }
  return undefined;
}

/**
 * Code HTTP porté par une erreur, qu'elle vienne d'axios (`error.response.status`)
 * ou de fetch/erreur maison (`error.status`). `undefined` si absent.
 */
export function httpStatus(error: unknown): number | undefined {
  const response = errorProp<{ status?: unknown }>(error, 'response');
  if (response && typeof response.status === 'number') return response.status;
  const status = errorProp(error, 'status');
  return typeof status === 'number' ? status : undefined;
}
