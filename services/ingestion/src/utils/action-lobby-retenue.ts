/**
 * Plusieurs activités HATVP peuvent tomber sur la même ligne `actions_lobby` :
 * la clé de la table est (lobbyiste, description), et deux activités d'un même
 * représentant d'intérêts partagent souvent leur objet. Leurs cibles et leurs
 * textes visés, eux, diffèrent.
 *
 * Chaque activité était comparée à la base, et la dernière écrite l'emportait.
 * La nuit suivante, la base portait ses valeurs : c'était l'autre activité qui
 * différait, et qui l'emportait à son tour. Mesuré en prod le 18/10/2026 : les
 * mêmes 1 674 actions basculaient d'une valeur à l'autre chaque nuit.
 *
 * On retient donc une activité par clé, selon une règle qui ne dépend ni de
 * l'ordre du fichier ni de l'état de la base : la publication la plus récente,
 * puis, à date égale ou inconnue, la plus petite valeur dans l'ordre lexical.
 * Seul compte qu'elle soit stable d'une nuit à l'autre.
 */
export interface ActionCandidate {
  /** Date de publication de l'activité, `null` quand la source n'en donne pas. */
  datePublication: Date | null;
  cible: string | null;
  cibleTypeId: number | null;
  texteVise: string | null;
  texteViseNom: string | null;
}

export function actionRetenue<T extends ActionCandidate>(a: T, b: T): T {
  const da = a.datePublication?.getTime() ?? -Infinity;
  const db = b.datePublication?.getTime() ?? -Infinity;
  if (da !== db) return da > db ? a : b;
  return valeurs(a) <= valeurs(b) ? a : b;
}

function valeurs(c: ActionCandidate): string {
  return JSON.stringify([c.cible, c.cibleTypeId, c.texteVise, c.texteViseNom]);
}
