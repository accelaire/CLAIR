import type { ApiData, PageVotes, ParlementaireCompare, VoteDuParlementaire } from "@clair/data";

/** Données FICTIVES (« Camille Exemple ») : jamais présentées comme réelles. */

const elu = (
  slug: string,
  prenom: string,
  nom: string,
  presence: number,
): ParlementaireCompare => ({
  id: `id-${slug}`,
  slug,
  chambre: "assemblee",
  nom,
  prenom,
  sexe: "F",
  photoUrl: null,
  actif: true,
  profession: null,
  groupe: {
    id: "groupe-exemple",
    slug: "exemple",
    chambre: "assemblee",
    nom: "EXE",
    nomComplet: "Groupe Exemple",
    couleur: null,
    position: null,
  },
  circonscription: null,
  serie: null,
  stats: {
    presence,
    presenceSolennel: null,
    loyaute: 90,
    participation: 100,
    interventions: 0,
    amendements: { proposes: 2, adoptes: 1 },
    questions: 0,
  },
});

/** Renvoyés dans l'ordre inverse de l'URL, comme l'API peut le faire. */
export const compareExemple: ApiData<ParlementaireCompare[]> = {
  data: [
    elu("dominique-test", "Dominique", "Test", 40),
    elu("camille-exemple", "Camille", "Exemple", 60),
  ],
};

const vote = (id: string, numero: number, position: string): VoteDuParlementaire => ({
  id: `${id}-${numero}`,
  position,
  groupePosition: null,
  scrutin: {
    id: `scrutin-${numero}`,
    numero,
    chambre: "assemblee",
    session: "17",
    date: `2026-10-0${numero}T00:00:00.000Z`,
    titre: `Scrutin exemple ${numero}`,
    sort: "adopte",
    typeVote: null,
    tags: [],
    importance: null,
    nombrePour: 1,
    nombreContre: 1,
    nombreAbstention: 0,
  },
});

const page = (data: VoteDuParlementaire[]): PageVotes => ({
  data,
  meta: { total: data.length, page: 1, limit: 100, totalPages: 1 },
});

export const votesCamille = page([vote("c", 1, "pour"), vote("c", 2, "pour")]);
export const votesDominique = page([
  vote("d", 1, "pour"),
  vote("d", 2, "contre"),
  vote("d", 3, "pour"),
]);
