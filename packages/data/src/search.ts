/**
 * Réponses de `/search` (recherche globale). Forme relevée sur
 * `apps/api/src/modules/search/search.controller.ts` le 2026-10-27.
 */

/** Catégories de la recherche, dans le vocabulaire du paramètre `type`. */
export type SearchCategorie =
  | "deputes"
  | "senateurs"
  | "groupes"
  | "commissions"
  | "scrutins"
  | "sujets"
  | "lobbyistes"
  | "dossiers";

export type SearchCounts = Record<SearchCategorie, number> & { total: number };

/** Député ou sénateur ; pour un mandat clos, groupe et circonscription sont ceux du dernier mandat. */
export type SearchParlementaire = {
  _type: "depute" | "senateur";
  id: string;
  slug: string;
  chambre: string;
  nom: string;
  prenom: string;
  nomComplet: string;
  photoUrl: string | null;
  /** Sigle du groupe. */
  groupe?: string | null;
  groupeCouleur?: string | null;
  circonscription?: string | null;
  departement?: string | null;
  actif: boolean;
  ancien: boolean;
  sexe: string | null;
  dernierMandat: {
    chambre: string;
    legislature: number | null;
    mandature: number | null;
    dateDebut: string;
    dateFin: string | null;
  } | null;
};

export type SearchScrutin = {
  _type: "scrutin";
  id: string;
  numero: number;
  chambre: string;
  session: string | null;
  date: string;
  titre: string;
  sort: string;
  typeVote: string | null;
  importance: number | null;
  nombrePour: number;
  nombreContre: number;
};

export type SearchLobbyiste = {
  _type: "lobbyiste";
  id: string;
  nom: string;
  type: string | null;
  secteur: string | null;
  ville?: string | null;
};

export type SearchDossier = {
  _type: "dossier";
  id: string;
  uid: string;
  titre: string;
  legislature: number;
  etat: string | null;
  procedureLibelle: string | null;
  loiNumero: string | null;
};

export type SearchGroupe = {
  _type: "groupe";
  id: string;
  slug: string;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  chambre: string;
  actif: boolean;
  statsMembresActifs: number | null;
};

export type SearchCommission = {
  _type: "commission";
  id: string;
  slug: string;
  nom: string;
  nomCourt: string | null;
  chambre: string;
  type: string | null;
  actif: boolean;
};

export type SearchSujet = {
  _type: "sujet";
  id: string;
  slug: string;
  label: string;
  description: string | null;
  category: string | null;
  status: string | null;
  dossierCount: number;
  scrutinCount: number;
};

export type SearchResult =
  | SearchParlementaire
  | SearchScrutin
  | SearchLobbyiste
  | SearchDossier
  | SearchGroupe
  | SearchCommission
  | SearchSujet;

type SearchMetaBase = {
  query: string;
  counts: SearchCounts;
  inclureAnciens: boolean;
  /** Mandats clos et organes dissous qui correspondent aussi (0 quand ils sont inclus). */
  anciensDisponibles: number;
};

/** `type=all` : cinq résultats au plus par catégorie, et le compte de chacune. */
export type SearchAllResponse = {
  sections: Record<SearchCategorie, SearchResult[]>;
  meta: SearchMetaBase;
};

/** Une seule catégorie, paginée. */
export type SearchPageResponse = {
  data: SearchResult[];
  meta: SearchMetaBase & {
    type: SearchCategorie;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
};
