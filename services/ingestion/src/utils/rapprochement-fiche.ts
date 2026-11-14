// Rapprochement d'un député de la source avec une fiche existante.
//
// La recherche combinait par un OU, sans priorité, l'identifiant, le slug et le
// nom « contenu dans » : la fiche retenue pouvait être celle d'un homonyme, que
// l'ingestion écrasait alors (identifiant, bio, chambre). C'est ainsi que
// Jean-Louis Masson, député du Var, a pris la fiche du sénateur de Moselle, et
// « Masson » trouvait aussi « Masson-Maret ».
//
// Ordre désormais : identifiant de la source, puis identifiant rangé (élu passé
// au Sénat), puis seulement slug ou nom EXACT dans la même chambre, à condition
// que la date de naissance soit la même. Sans certitude, aucune fiche : mieux
// vaut une fiche de plus qu'une personne écrasée.

export interface CandidatFiche {
  id: string;
  chambre: string;
  sourceId: string | null;
  slug: string;
  prenom: string;
  nom: string;
  dateNaissance: Date | null;
  /** La fiche porte cet identifiant dans `parlementaires_identifiants`. */
  identifiantRange: boolean;
}

export interface PersonneSource {
  uid: string;
  chambre: string;
  slug: string;
  prenom: string;
  nom: string;
  dateNaissance: Date | null;
}

/** « Le Pen », « LE PEN », « le-pen » → « le pen ». */
export function normaliserNom(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-'’\s]+/g, ' ')
    .trim();
}

const jour = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export function choisirFiche(candidats: readonly CandidatFiche[], p: PersonneSource): CandidatFiche | null {
  const parIdentifiant = candidats.find((c) => c.sourceId === p.uid);
  if (parIdentifiant) return parIdentifiant;
  const parIdentifiantRange = candidats.find((c) => c.identifiantRange);
  if (parIdentifiantRange) return parIdentifiantRange;

  const naissance = jour(p.dateNaissance);
  if (!naissance) return null;
  const memes = candidats.filter(
    (c) =>
      c.chambre === p.chambre &&
      jour(c.dateNaissance) === naissance &&
      (c.slug === p.slug ||
        (normaliserNom(c.prenom) === normaliserNom(p.prenom) && normaliserNom(c.nom) === normaliserNom(p.nom))),
  );
  return memes.length === 1 ? memes[0]! : null;
}

/** Slug d'une nouvelle fiche : celui de la personne, suffixé de son identifiant s'il est pris. */
export function slugLibre(slug: string, uid: string, pris: boolean): string {
  return pris ? `${slug}-${uid.toLowerCase()}` : slug;
}
