import { chartPalette } from "@clair/theme";
import { COULEUR_GROUPE_DEFAUT } from "./graphiques.ts";

/**
 * Couleurs des graphiques de la rubrique, prises dans la palette des graphiques de @clair/theme
 * (les mêmes teintes que apps/web : bleu, violet, rose). Toujours accompagnées d'un libellé.
 */
export const COULEUR_PRINCIPALE = chartPalette[0];
export const COULEUR_SECONDAIRE = chartPalette[1];
export const COULEUR_FEMMES = chartPalette[10];
export const COULEUR_HOMMES = chartPalette[0];
/** Sexe non renseigné, repli de groupe : le gris de apps/web. */
export const COULEUR_NEUTRE = COULEUR_GROUPE_DEFAUT;
