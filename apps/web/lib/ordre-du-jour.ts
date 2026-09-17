// =============================================================================
// Lire l'ordre du jour d'une réunion
// =============================================================================
//
// Deux champs le portent, et aucun n'est propre :
//
// - `odjResume` concatène les points avec « | » et est plafonné à 500
//   caractères à l'ingestion : son dernier point est coupé en plein mot une
//   fois sur deux.
// - `odjComplet` sépare les points par des retours à la ligne et va plus loin,
//   mais préfixe souvent chaque point d'un tiret que la source a déjà mis.
//
// Rendu tel quel, on obtenait « • - Nomination d'un rapporteur… » : deux puces
// pour un seul point. C'est le genre de détail qui fait négligé sur une page
// dont l'ordre du jour est justement le premier repère.
// =============================================================================

/**
 * Les points de l'ordre du jour, un par entrée, débarrassés de leur ponctuation
 * de liste.
 *
 * `odjComplet` d'abord : il est plus fidèle et ne tronque pas. Le tiret de tête
 * et le point-virgule de fin viennent de la source, pas du sens — ils sont
 * retirés parce que la page pose déjà sa propre puce.
 */
export function pointsDeLOrdreDuJour(
  resume: string | null | undefined,
  complet: string | null | undefined,
): string[] {
  const source = complet || resume || '';
  if (source.length === 0) return [];

  return source
    .split(complet ? '\n' : '|')
    .map((point) =>
      point
        .trim()
        // Tiret de liste en tête : « - », « – », « — », suivi d'un blanc.
        .replace(/^[-–—]\s*/u, '')
        // Séparateur de fin, quand le point a été découpé d'une énumération.
        .replace(/\s*[;,]\s*$/u, '')
        .trim(),
    )
    .filter((point) => point.length > 0);
}
