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
