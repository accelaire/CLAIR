import type {
  ApiData,
  GroupeOption,
  LegislatureDisponible,
  PageMeta,
  ParlementaireListItem,
} from "@clair/data";

/** Données FICTIVES (« Camille Exemple ») : jamais présentées comme réelles. */

const groupeExemple = {
  id: "groupe-exemple",
  slug: "exemple",
  chambre: "assemblee" as const,
  nom: "EXE",
  nomComplet: "Groupe Exemple",
  couleur: null,
  position: null,
};

export const eluExemple = (
  slug: string,
  prenom: string,
  nom: string,
  departement = "99",
): ParlementaireListItem => ({
  id: `id-${slug}`,
  slug,
  chambre: "assemblee",
  nom,
  prenom,
  sexe: "F",
  photoUrl: null,
  actif: true,
  profession: null,
  groupe: groupeExemple,
  circonscription: {
    id: `circo-${slug}`,
    departement,
    numero: 1,
    nom: "Exemple-sur-Mer",
    type: "legislative",
  },
  serie: null,
  votesCount: 10,
  interventionsCount: 0,
  amendementsCount: 0,
  stats: null,
});

export const pageListe = (
  items: ParlementaireListItem[],
  { total = items.length, page = 1, totalPages = 1 } = {},
): PageMeta<ParlementaireListItem> => ({
  data: items,
  meta: { total, page, limit: 24, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
});

export const listeExemple = pageListe(
  [
    eluExemple("camille-exemple", "Camille", "Exemple"),
    eluExemple("dominique-test", "Dominique", "Test"),
  ],
  { total: 30, totalPages: 2 },
);

export const groupesExemple: ApiData<GroupeOption[]> = {
  data: [{ ...groupeExemple, membresCount: 2 }],
};

export const legislaturesExemple: ApiData<LegislatureDisponible[]> = {
  data: [{ legislature: 17, count: 30 }],
};
