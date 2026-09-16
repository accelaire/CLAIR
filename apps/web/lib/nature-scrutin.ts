// =============================================================================
// Nature d'un scrutin — libellés d'affichage
// =============================================================================
//
// La nature dit sur QUOI porte le vote (l'ensemble d'un texte, un article, un
// amendement…), là où `typeVote` dit COMMENT on vote (solennel, ordinaire,
// motion). Les deux axes sont indépendants : un vote sur l'ensemble d'un texte
// est le plus souvent « ordinaire », et une motion de censure n'est pas typée
// « motion » par l'Assemblée dans la majorité des cas.
//
// La valeur est calculée à l'ingestion depuis l'objet publié par les chambres
// (services/ingestion/src/utils/nature-scrutin.ts) et stockée en base.

export const NATURES_SCRUTIN = [
  'ensemble',
  'article',
  'amendement',
  'credits',
  'motion',
  'declaration',
  'autre',
] as const;

export type NatureScrutin = (typeof NATURES_SCRUTIN)[number];

/** Libellé complet, là où la place ne manque pas (puces de la page dossier). */
export const natureLabels: Record<NatureScrutin, string> = {
  ensemble: 'Ensemble du texte',
  article: 'Article',
  amendement: 'Amendement',
  credits: 'Crédits budgétaires',
  motion: 'Motion ou procédure',
  declaration: 'Déclaration du Gouvernement',
  autre: 'Autre',
};

/**
 * Libellés pour les menus déroulants.
 *
 * Un `<select>` natif se dimensionne sur son option la plus longue, pas sur la
 * valeur affichée : « Déclaration du Gouvernement » suffisait à faire 285 px de
 * large et à renvoyer le filtre de période à la ligne suivante. Ces libellés
 * tiennent tous dans la largeur fixe du champ.
 */
export const natureLabelsCourts: Record<NatureScrutin, string> = {
  ensemble: 'Ensemble du texte',
  article: 'Article',
  amendement: 'Amendement',
  credits: 'Crédits',
  motion: 'Motion',
  declaration: 'Déclaration',
  autre: 'Autre',
};

/**
 * Ordre d'affichage dans les filtres : du vote qui engage le plus (l'adoption
 * du texte) au plus procédural. Ce n'est pas l'ordre de fréquence — les
 * amendements représentent 75 % des scrutins mais sont rarement ce qu'on cherche.
 */
export const NATURES_FILTRABLES: NatureScrutin[] = [
  'ensemble',
  'article',
  'amendement',
  'credits',
  'motion',
  'declaration',
];

/** Libellé sûr pour une valeur venue de l'API, y compris absente ou inconnue. */
export function natureLabel(nature: string | null | undefined): string | null {
  if (!nature) return null;
  return natureLabels[nature as NatureScrutin] ?? null;
}
