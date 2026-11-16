// =============================================================================
// Ce qu'il est advenu d'un amendement, en quatre familles
// =============================================================================

/**
 * Les chambres publient une cinquantaine de sorts (« Rejeté », « rejete »,
 * « Charge », « Cavalier (45) », « Sous-amendement (98) », « R »…). Pour
 * résumer les amendements d'un dossier, on les range en quatre familles :
 *
 * - `adopte`, `rejete` : mis aux voix, en scrutin public ou à main levée ;
 * - `attente` : pas encore examiné en séance (« En traitement », « A
 *   discuter », recevabilité financière en cours) ou sort inconnu ;
 * - `non_vote` : tout le reste, c'est-à-dire un amendement qui n'a pas été mis
 *   aux voix : retiré, tombé, non soutenu, irrecevable, satisfait, doublon.
 */
export type FamilleSort = 'adopte' | 'rejete' | 'non_vote' | 'attente';

export const FAMILLES_SORT: readonly FamilleSort[] = ['adopte', 'rejete', 'non_vote', 'attente'];

export function familleSort(sort: string | null | undefined): FamilleSort {
  const s = (sort ?? '').trim().toLowerCase();
  if (!s) return 'attente';
  if (s.includes('adopt')) return 'adopte';
  if (s.includes('rejet')) return 'rejete';
  if (s.includes('traitement') || s.includes('discuter') || s.includes('attente') || s.startsWith('recevable')) {
    return 'attente';
  }
  return 'non_vote';
}
