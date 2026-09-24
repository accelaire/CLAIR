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

/**
 * Une seule émission par clé canonique, choisie sans dépendre de l'ordre de
 * l'archive.
 *
 * Les deux émissions d'un même amendement tombent sur la même ligne mais ne
 * portent pas la même empreinte : leur `uid` diffère. Les écrire toutes les
 * deux faisait alterner la ligne d'une nuit à l'autre, et le saut des lignes
 * inchangées ne se stabilisait jamais pour elles. On garde l'émission dont
 * l'uid est déjà la forme canonique ; à défaut, le premier uid dans l'ordre
 * lexicographique.
 */
export function uneEmissionParAmendement<T extends { uid: string }>(emissions: T[]): T[] {
  const retenues = new Map<string, T>();
  for (const e of emissions) {
    const cle = uidCanoniqueAmendement(e.uid);
    const deja = retenues.get(cle);
    if (!deja || preferer(e.uid, deja.uid, cle)) retenues.set(cle, e);
  }
  return [...retenues.values()];
}

function preferer(candidat: string, actuel: string, cle: string): boolean {
  if ((candidat === cle) !== (actuel === cle)) return candidat === cle;
  return candidat < actuel;
}
