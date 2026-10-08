// =============================================================================
// Le lien d'un vote vers son passage dans la séance
// =============================================================================
//
// La page d'un vote ne montre que le débat qui le précède. Le reste de la
// séance (ce qui s'est dit avant, les votes voisins, la suite) est sur la page
// de la séance. Ce lien y mène au bon endroit : la séance se déroule jusqu'au
// rang où le débat du vote commence, et met ce vote en évidence.
//
// Deux paramètres, lus côté client seulement : la page de la séance reste la
// même page mise en cache pour tous, quel que soit le vote d'où l'on arrive.
// =============================================================================

export interface SeanceDuVote {
  uid: string;
  /** Rang de la première prise du débat du vote, `null` s'il n'y en a pas. */
  rang: number | null;
}

/** `/reunions/<uid>?vote=<id>&rang=<n>` */
export function seanceDuVoteHref(seance: SeanceDuVote, scrutinId: string): string {
  const params = new URLSearchParams({ vote: scrutinId });
  if (seance.rang !== null) params.set('rang', String(seance.rang));
  return `/reunions/${encodeURIComponent(seance.uid)}?${params.toString()}`;
}

/** Le vote d'où l'on arrive sur la page d'une séance, lu dans l'URL. */
export function voteDOrigine(search: string): { vote: string; rang: number | null } | null {
  const params = new URLSearchParams(search);
  const vote = params.get('vote');
  if (!vote) return null;
  const rang = Number.parseInt(params.get('rang') ?? '', 10);
  return { vote, rang: Number.isFinite(rang) && rang >= 0 ? rang : null };
}
