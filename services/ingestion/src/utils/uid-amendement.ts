// =============================================================================
// Clé canonique d'un amendement
// =============================================================================
//
// L'uid publié par l'Assemblée encode la référence du texte visé. Quand le
// texte passe du projet initial au texte de la commission, l'AN REPUBLIE
// l'amendement sous un nouvel uid — et laisse l'ancien fichier dans son
// archive :
//
//   json/DLR5L17N51670/PIONANR5L17BTC1364/AMANR5L17PO838901B1364P0D2N000001.json
//   json/DLR5L17N51670/PIONANR5L17BTC1364/AMANR5L17PO838901BTC1364P0D2N000001.json
//
// Les deux fichiers ne diffèrent que par l'uid, l'URI du PDF qui en dérive, la
// date de publication et un horodatage interne. Dispositif, exposé, auteur,
// sort, article visé et `texteLegislatifRef` sont identiques. 346 amendements
// de la 17e législature sont dans ce cas, sur 123 224.
//
// Un upsert sur l'uid brut crée donc deux lignes pour un même amendement. La
// clé canonique retire le `TC` du segment de texte : les deux émissions
// retombent sur la même ligne, et l'uid brut reste stocké tel que reçu.
// =============================================================================

/**
 * Segment de texte d'un uid d'amendement AN : un `B` éventuellement suivi de
 * `TC`, le numéro du texte, puis le marqueur de délibération.
 *
 * Ancré sur `P0D` pour ne pas mordre ailleurs dans l'uid : `PO838901` contient
 * un `O` et non un `0`, mais la prudence ne coûte rien ici.
 */
const SEGMENT_TEXTE = /BTC(\d+)P0D/;

/**
 * Clé de déduplication d'un amendement.
 *
 * Sans effet sur les uid qui ne portent pas la forme « texte de commission » —
 * ceux de l'AN sur texte initial, et tout le Sénat, dont le schéma d'uid est
 * entièrement différent.
 */
export function uidCanoniqueAmendement(uid: string): string {
  return uid.replace(SEGMENT_TEXTE, 'B$1P0D');
}
