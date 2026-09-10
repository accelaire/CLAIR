// =============================================================================
// Ce qu'on appelle « une intervention » quand on la montre ou qu'on la compte
// =============================================================================

/**
 * Type réservé aux interruptions de séance.
 *
 * Le compte rendu de l'Assemblée publie les interruptions comme des
 * paragraphes nominatifs — « Quel scandale ! », « Mais oui, bien sûr ! », une
 * quarantaine de caractères en moyenne. Elles pèsent un cinquième du corpus.
 */
export const TYPE_INTERRUPTION = 'interruption';

/**
 * Réponse d'un membre du Gouvernement à une question parlementaire.
 *
 * Questions et réponses partagent la même rubrique au compte rendu ; les
 * distinguer évite qu'un ministre qui répond voie sa réponse comptée comme une
 * question qu'il aurait posée. C'est une prise de parole de fond : elle
 * s'affiche et se compte comme les autres, seul le compteur de questions
 * posées l'écarte.
 */
export const TYPE_REPONSE = 'reponse_gouvernement';

/**
 * Le filtre des interventions de fond : ce qu'un lecteur attend quand il
 * demande « les interventions » d'un parlementaire ou d'une séance.
 *
 * Deux choses en sont écartées, pour deux raisons différentes :
 *
 * - `estPresidence` — la mécanique de séance (« La parole est à M. X »,
 *   « Je mets aux voix… »). Ce n'est pas une prise de position, c'est de la
 *   plomberie ; on l'ingère parce qu'elle porte la segmentation du débat.
 * - `type: interruption` — le chahut. Ce sont de vraies prises de parole,
 *   attribuées à leur auteur, et on les garde : elles se lisent à part. Mais
 *   les mêler aux interventions de fond gonflerait l'activité d'un député de
 *   plusieurs milliers de lignes qui ne disent rien de son travail.
 *
 * Les deux restent en base et interrogeables ; ce filtre ne décide que de ce
 * qui est montré et compté par défaut.
 */
export const INTERVENTIONS_DE_FOND = {
  estPresidence: false,
  type: { not: TYPE_INTERRUPTION },
} as const;

/**
 * Fenêtre correspondant à la journée de séance d'une date donnée.
 *
 * Les scrutins sont datés à minuit, les interventions à l'heure d'ouverture de
 * la séance dont elles relèvent — 9 h, 15 h, 21 h 30. Comparer les deux par
 * égalité stricte ne rapproche donc jamais rien côté Assemblée : il faut
 * cadrer sur la journée. L'heure de séance est une information réelle, qui
 * distingue les séances du matin, de l'après-midi et du soir ; on l'interroge
 * par intervalle plutôt que de l'écraser à minuit.
 */
export function journeeDeSeance(date: Date): { gte: Date; lt: Date } {
  const debut = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const lendemain = new Date(debut);
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);
  return { gte: debut, lt: lendemain };
}
