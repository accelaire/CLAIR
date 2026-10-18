/**
 * Un seul libellé par secteur HATVP.
 *
 * Les deux vocabulaires de la HATVP (secteurs d'activité des représentants,
 * domaines d'intervention des actions) écrivent parfois le même secteur avec ou
 * sans accent : « Education, enseignement, formation » et « Éducation,
 * enseignement, formation » donnent le même identifiant. Chaque libellé était
 * écrit à son tour sur la même ligne, qui changeait donc deux fois par passage.
 *
 * On retient la graphie la plus accentuée (la plus soignée), puis, à égalité,
 * la première dans l'ordre lexical : le choix ne dépend pas de l'ordre des
 * fichiers.
 */
export function libelleRetenu(libelles: Iterable<string>): string {
  const accents = (l: string) => l.normalize('NFD').replace(/[^̀-ͯ]/g, '').length;
  const tries = [...libelles].sort((a, b) => accents(b) - accents(a) || (a < b ? -1 : a > b ? 1 : 0));
  const premier = tries[0];
  if (premier === undefined) throw new Error('libelleRetenu : aucun libellé');
  return premier;
}
