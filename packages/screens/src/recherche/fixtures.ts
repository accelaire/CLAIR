import type {
  SearchAllResponse,
  SearchCategorie,
  SearchCounts,
  SearchPageResponse,
  SearchParlementaire,
  SearchResult,
} from "@clair/data";

/**
 * Résultats FICTIFS pour les tests et les stories : noms et intitulés inventés, présentés comme
 * exemples.
 */

export const deputeExemple: SearchParlementaire = {
  _type: "depute",
  id: "parl-exemple-1",
  slug: "camille-exemple",
  chambre: "assemblee",
  nom: "Exemple",
  prenom: "Camille",
  nomComplet: "Camille Exemple",
  photoUrl: null,
  groupe: "EX",
  groupeCouleur: "#336699",
  circonscription: "1re circonscription",
  departement: "Exempleland",
  actif: true,
  ancien: false,
  sexe: "F",
  dernierMandat: null,
};

export const ancienneDeputee: SearchParlementaire = {
  ...deputeExemple,
  id: "parl-exemple-2",
  slug: "dominique-exemple",
  prenom: "Dominique",
  nomComplet: "Dominique Exemple",
  actif: false,
  ancien: true,
  dernierMandat: {
    chambre: "assemblee",
    legislature: 16,
    mandature: null,
    dateDebut: "2022-06-22T00:00:00.000Z",
    dateFin: "2024-06-09T00:00:00.000Z",
  },
};

export const scrutinExemple: SearchResult = {
  _type: "scrutin",
  id: "scrutin-exemple-1",
  numero: 42,
  chambre: "senat",
  session: "2025",
  date: "2026-02-10T00:00:00.000Z",
  titre: "Exemple : l'ensemble du projet de loi sur les jardins partagés",
  sort: "adopte",
  typeVote: "ordinaire",
  importance: 3,
  nombrePour: 200,
  nombreContre: 100,
};

export const commissionDissoute: SearchResult = {
  _type: "commission",
  id: "commission-exemple-1",
  slug: "commission-exemple",
  nom: "Commission d'enquête exemple",
  nomCourt: null,
  chambre: "assemblee",
  type: "enquete",
  actif: false,
};

const vides = (): Record<SearchCategorie, SearchResult[]> => ({
  deputes: [],
  senateurs: [],
  groupes: [],
  commissions: [],
  scrutins: [],
  sujets: [],
  lobbyistes: [],
  dossiers: [],
});

export const countsDe = (partiel: Partial<Record<SearchCategorie, number>>): SearchCounts => {
  const counts = {
    deputes: 0,
    senateurs: 0,
    groupes: 0,
    commissions: 0,
    scrutins: 0,
    sujets: 0,
    lobbyistes: 0,
    dossiers: 0,
    ...partiel,
  };
  return { ...counts, total: Object.values(counts).reduce((somme, n) => somme + n, 0) };
};

export const apercuExemple = (q = "exemple"): SearchAllResponse => ({
  sections: { ...vides(), deputes: [deputeExemple], scrutins: [scrutinExemple] },
  meta: {
    query: q,
    counts: countsDe({ deputes: 12, scrutins: 1 }),
    inclureAnciens: false,
    anciensDisponibles: 3,
  },
});

export const apercuVide = (q = "zzz"): SearchAllResponse => ({
  sections: vides(),
  meta: { query: q, counts: countsDe({}), inclureAnciens: false, anciensDisponibles: 0 },
});

export const pageDeputes = (
  data: SearchResult[],
  { page = 1, total = data.length, hasNext = false, inclureAnciens = false } = {},
): SearchPageResponse => ({
  data,
  meta: {
    query: "exemple",
    counts: countsDe({ deputes: total }),
    inclureAnciens,
    anciensDisponibles: 0,
    type: "deputes",
    page,
    limit: 30,
    total,
    totalPages: Math.ceil(total / 30),
    hasNext,
  },
});
