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

/**
 * Une qualité de membre du Gouvernement, telle que le compte rendu l'imprime.
 *
 * Sert à distinguer, sous une rubrique de questions, celui qui interroge de
 * celui qui répond : la rubrique vaut pour toute la séquence, si bien que sans
 * cette distinction les réponses des ministres tombaient dans leur propre
 * compteur de questions posées — 745 pour Gabriel Attal à l'Assemblée, dont
 * 539 prononcées comme Premier ministre ; au Sénat, 454 sur 454 pour Sébastien
 * Lecornu, sénateur un mois en 2020 et qui n'y a depuis parlé que comme
 * ministre.
 *
 * Les limites de mot autour de « ministre » ne sont pas décoratives : 562
 * paragraphes ont pour qualité « rapporteur de la commission des lois
 * constitutionnelles, de la législation et de l'administration générale de la
 * République », où « administration » contient la sous-chaîne. Ce sont des
 * députés, et les compter comme gouvernement effacerait leurs questions.
 */
const QUALITE_GOUVERNEMENT =
  /\bministres?\b|\bsecr[ée]taire\s+d[’']?[EÉ]tat\b|\bgarde\s+des\s+sceaux\b|\bporte-parole\s+du\s+gouvernement\b/i;

/**
 * La même règle pour Postgres (`~*`), là où le type se pose en SQL : la
 * segmentation des débats du Sénat réécrit le type de milliers de lignes d'un
 * coup. `\m` et `\M` y sont les limites de mot. Vérifiée le 24/10/2026 sur
 * toutes les qualités distinctes de la prod : les deux règles retiennent
 * exactement les mêmes.
 */
export const QUALITE_GOUVERNEMENT_SQL =
  "\\m(ministres?|secr[éeÉE]taire\\s+d['’]?[éeÉE]tat|garde\\s+des\\s+sceaux|porte-parole\\s+du\\s+gouvernement)\\M";

export function estMembreDuGouvernement(qualite: string | null | undefined): boolean {
  return !!qualite && QUALITE_GOUVERNEMENT.test(qualite);
}

/**
 * Le type d'une prise de parole, une fois connu celui qui parle : une
 * « question » prononcée par un membre du Gouvernement est sa réponse.
 *
 * C'est la qualité imprimée au compte rendu qui décide, pas la fiche : un
 * ministre qui est aussi parlementaire pose des questions quand il siège, et
 * y répond quand il est au banc du Gouvernement.
 */
export function typeSelonOrateur(type: string, qualite: string | null | undefined): string {
  return type === 'question' && estMembreDuGouvernement(qualite) ? TYPE_REPONSE : type;
}
