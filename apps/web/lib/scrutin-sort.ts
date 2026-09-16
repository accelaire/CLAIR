/**
 * Lecture du `sort` d'un scrutin.
 *
 * L'API renvoie la valeur brute de la colonne `scrutins.sort`, qui ne prend que
 * deux valeurs, SANS accent : `'adopte'` et `'rejete'`.
 *
 * Trois points d'entrée comparaient `sort === 'adopté'`, avec accent : la
 * condition était donc toujours fausse. La carte OG, la meta description et le
 * JSON-LD `VoteEvent` annonçaient « Rejeté » sur les 8 050 scrutins adoptés,
 * pendant que la page elle-même affichait « Adopté ». Le décalage n'était
 * visible que hors du site — aperçus Twitter/Slack, extraits Google, données
 * structurées — d'où sa persistance, et un retour utilisateur parlant de
 * « falsification » sur un scrutin partagé.
 *
 * Ce helper est l'unique source de vérité : ne pas comparer la chaîne à la
 * main. Il ignore les accents pour rester juste si la source venait à en
 * réintroduire.
 */
export function isScrutinAdopte(sort: string | null | undefined): boolean {
  if (!sort) return false;
  return sort.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'adopte';
}

/** Libellé affichable du sort d'un scrutin. */
export function scrutinSortLabel(sort: string | null | undefined): 'Adopté' | 'Rejeté' {
  return isScrutinAdopte(sort) ? 'Adopté' : 'Rejeté';
}
