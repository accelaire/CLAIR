// =============================================================================
// Ce qu'on appelle « une intervention » quand on la compte
// =============================================================================

/**
 * Type réservé aux interruptions de séance.
 *
 * Le compte rendu de l'Assemblée publie les interruptions comme des
 * paragraphes nominatifs — « Quel scandale ! », « Mais oui, bien sûr ! » —
 * qui pèsent un cinquième du corpus. Ce sont de vraies prises de parole, on
 * les garde et on les montre à part ; elles n'entrent pas dans les compteurs
 * d'activité, où elles ajouteraient des milliers de lignes qui ne disent rien
 * du travail d'un parlementaire.
 *
 * Pendant de `INTERVENTIONS_DE_FOND` côté API (apps/api/src/utils).
 */
export const TYPE_INTERRUPTION = 'interruption';

/**
 * Réponse d'un membre du Gouvernement à une question parlementaire.
 *
 * Le compte rendu range questions et réponses sous la même rubrique : sans ce
 * type, la réponse d'un ministre comptait comme une question qu'il aurait
 * posée. Les ministres qui sont aussi députés ont une fiche, et y voyaient
 * leurs réponses gonfler un compteur qui n'est pas le leur.
 *
 * C'est une prise de parole de fond, qui reste affichée et comptée comme
 * telle — seul le compteur de questions posées l'écarte.
 */
export const TYPE_REPONSE = 'reponse_gouvernement';
