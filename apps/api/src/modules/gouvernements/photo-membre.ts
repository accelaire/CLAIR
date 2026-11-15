// Photo d'un membre du Gouvernement sans fiche (#136) : image principale de la
// personne sur Wikidata, hébergée sur Wikimedia Commons, toujours accompagnée
// de son crédit, que la plupart des licences de Commons exigent.
//
// Quand la personne a une fiche, c'est la photo de la fiche qui compte
// (`parlementaire.photoUrl`) : `photo` vaut alors null.

/** Champs à lire sur `membres_gouvernement`. */
export const selectionPhotoMembre = {
  photoUrl: true,
  photoAuteur: true,
  photoLicence: true,
  photoLicenceUrl: true,
  photoSource: true,
} as const;

export interface PhotoMembreLue {
  photoUrl: string | null;
  photoAuteur: string | null;
  photoLicence: string | null;
  photoLicenceUrl: string | null;
  photoSource: string | null;
}

export interface PhotoMembre {
  url: string;
  /** Auteur tel que Commons le crédite ; null pour une image du domaine public sans auteur connu */
  auteur: string | null;
  licence: string;
  licenceUrl: string | null;
  /** Page du fichier sur Wikimedia Commons */
  source: string;
}

export function photoMembre(p: PhotoMembreLue, aUneFiche: boolean): PhotoMembre | null {
  // Le crédit est garanti par check-quality ; sans lui, pas de photo.
  if (aUneFiche || !p.photoUrl || !p.photoLicence || !p.photoSource) return null;
  return { url: p.photoUrl, auteur: p.photoAuteur, licence: p.photoLicence, licenceUrl: p.photoLicenceUrl, source: p.photoSource };
}
