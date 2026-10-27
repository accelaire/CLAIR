/**
 * Rubrique Sénatoriales 2026 : écrans, et fonctions pures partagées avec les routes de
 * l'application (métadonnées, données structurées, images Open Graph).
 */
export {
  type CirconscriptionInitial,
  CirconscriptionScreen,
  type CirconscriptionScreenProps,
} from "./CirconscriptionScreen.tsx";
export {
  type GraphiqueInitial,
  GraphiqueScreen,
  type GraphiqueScreenProps,
} from "./GraphiqueScreen.tsx";
export { DIRECT_RESULTATS, resultatsEnDirect, SENATORIALES_2026 } from "./lib/calendrier.ts";
export { libelleCirconscription, modeDeScrutin } from "./lib/circonscription.ts";
export {
  codeDepuisSlug,
  locutionDepuisCode,
  SLUGS_DEPARTEMENTS,
  slugDepuisCode,
} from "./lib/departements.ts";
export { accorde, pluriel } from "./lib/format.ts";
export { CHEMINS_DEPARTEMENTS, VIEWBOX_DEPARTEMENTS } from "./lib/geo-departements.ts";
export {
  bandesBilan,
  COULEUR_GROUPE_DEFAUT,
  type Comptage,
  couleurCarte,
  estMetropole,
  estSlugGraphique,
  GRAPHIQUES,
  mediane,
  type PointActivite,
  parCommission,
  parFamilleProfession,
  partsRemisesEnJeu,
  pointsActivite,
  pointsDistribution,
  pyramideAges,
  type SiegesDepartement,
  SLUGS_GRAPHIQUES,
  type SlugGraphique,
  siegesParDepartement,
} from "./lib/graphiques.ts";
export {
  directCirconscription,
  directNational,
  resultatsPublies,
  scrutinCommence,
} from "./lib/resultats.ts";
export {
  listeRestreinte,
  parseSenatorialesParams,
  type SenatorialesParams,
  senatorialesParamsOf,
  sortantsCirconscriptionQuery,
  sortantsQueryOf,
} from "./params.ts";
export {
  type SenatorialesInitial,
  SenatorialesScreen,
  type SenatorialesScreenProps,
} from "./SenatorialesScreen.tsx";
