import type { GroupeClasse, PageMeta, ParlementaireListItem } from "@clair/data";

/**
 * Données FICTIVES pour les tests et les stories : personnes, groupes et chiffres inventés,
 * jamais présentés comme réels.
 */
export const parlementaireClasse = (
  id: number,
  stats: { presence: number; loyaute: number } = { presence: 90 - id, loyaute: 80 },
): ParlementaireListItem => ({
  id: `parlementaire-${id}`,
  slug: `personne-exemple-${id}`,
  chambre: "assemblee",
  nom: `Exemple${id}`,
  prenom: "Camille",
  sexe: null,
  photoUrl: null,
  actif: true,
  profession: null,
  groupe: {
    id: "groupe-exemple-1",
    slug: "gex",
    chambre: "assemblee",
    nom: "GEX",
    nomComplet: "Groupe d'exemple",
    couleur: null,
    position: null,
  },
  circonscription: null,
  serie: null,
  votesCount: 10,
  interventionsCount: 0,
  amendementsCount: 0,
  stats: { ...stats, participation: 10, interventions: 2, amendements: 3 },
});

export const pageClassement = (
  items: ParlementaireListItem[],
  { page = 1, totalPages = 1 }: { page?: number; totalPages?: number } = {},
): PageMeta<ParlementaireListItem> => ({
  data: items,
  meta: { total: items.length * totalPages, page, limit: 50, totalPages },
});

export const groupeClasse = (id: number, presence: number): GroupeClasse => ({
  id: `groupe-${id}`,
  slug: `g${id}`,
  chambre: "assemblee",
  legislature: 17,
  nom: `G${id}`,
  nomComplet: `Groupe d'exemple numéro ${id}`,
  couleur: null,
  logoUrl: null,
  position: null,
  ordre: id,
  actif: true,
  membresCount: 10 * id,
  membresActifsCount: 10 * id,
  statsPresenceMoyenne: presence,
  statsPresenceSolennelMoyenne: null,
  statsLoyauteMoyenne: 90,
  statsCohesion: 80,
});
