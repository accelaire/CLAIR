import type { Chambre } from "./common.ts";

/**
 * Dossiers législatifs, tels que les renvoie l'API (apps/api, module dossiers) : liste
 * (`/dossiers`), filtres (`/dossiers/filters`), tendances (`/dossiers/trending`), détail
 * (`/dossiers/:uid`), parcours (`/dossiers/:uid/chronologie`), scrutins et amendements paginés.
 * Relevé sur l'API le 2026-10-26 ; seuls les champs utiles au site sont typés.
 */

/** État d'un dossier tel que l'écrit l'API (`en_cours`, `adopte`, `promulgue`…). */
export type EtatDossier = string;

/** Dossier dans une liste (`/dossiers`). La liste ne garde que les dossiers ayant un scrutin. */
export type DossierListItem = {
  id: string;
  uid: string;
  titre: string;
  /** Titre court ; parfois un code technique (uid, « PLF2025 »), pas toujours lisible. */
  titreCourt: string | null;
  legislature: number;
  chambre: Chambre;
  procedureCode: string | null;
  procedureLibelle: string | null;
  etat: EtatDossier | null;
  dateDepot: string | null;
  loiNumero: string | null;
  lastScrutinDate: string | null;
  _count: { scrutins: number; amendements: number };
};

/** Procédures proposées en filtre (`/dossiers/filters`). */
export type DossiersFilters = { procedures: Array<{ label: string; count: number }> };

/** Dossier en tendance (`/dossiers/trending`, réponse `{ data }`). */
export type DossierTrending = {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  chambre: Chambre;
  etat: EtatDossier | null;
  procedureLibelle: string | null;
  dateDepot: string | null;
  lastScrutinDate: string | null;
  _count: { scrutins: number };
};

/** Scrutin d'un dossier (détail et `/dossiers/:uid/scrutins`). */
export type ScrutinDuDossier = {
  id: string;
  numero: number;
  chambre: Chambre;
  session: string;
  date: string;
  titre: string;
  sort: string;
  typeVote: string | null;
  natureVote: string | null;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  nombreVotants: number;
  /** Amendements mis aux voix par ce scrutin (détail seulement). */
  amendements?: Array<{
    id: string;
    numero: string;
    auteurLibelle: string | null;
    sort: string | null;
  }>;
};

/** Amendement d'un dossier (détail et `/dossiers/:uid/amendements`). */
export type AmendementDuDossier = {
  id: string;
  uid: string;
  numero: string;
  chambre?: string | null;
  auteurLibelle: string | null;
  articleVise: string | null;
  alinea?: string | null;
  alineaNumero?: number | null;
  dispositif: string | null;
  exposeSommaire: string | null;
  texteRef: string | null;
  sort: string | null;
  dateDepot: string | null;
  amendementParentId?: string | null;
  amendementParent?: {
    id: string;
    uid: string;
    numero: string;
    auteurLibelle: string | null;
  } | null;
  sousAmendementsCount?: number;
  /** Scrutins publics où l'amendement a été mis aux voix. */
  scrutins: Array<{
    id: string;
    numero: number;
    chambre: Chambre;
    session: string;
    sort: string;
    date: string;
  }>;
};

/** Commission saisie d'un dossier : au fond ou pour avis. */
export type CommissionSaisie = {
  slug: string;
  nom: string;
  chambre: Chambre;
  type: string;
  role: "fond" | "avis" | string;
};

/** Dossier détaillé (`/dossiers/:uid`). Les 20 premiers scrutins et amendements sont inclus. */
export type DossierDetail = {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  legislature: number;
  chambre: Chambre;
  procedureCode: string | null;
  procedureLibelle: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  etat: EtatDossier | null;
  dateDepot: string | null;
  dateAdoption: string | null;
  loiNumero: string | null;
  loiTitre: string | null;
  loiDateJO: string | null;
  urlLegifrance: string | null;
  urlJournalOfficiel: string | null;
  /** Résumé généré par IA : à signaler comme tel. */
  resumeIA: string | null;
  sujet: { slug: string; label: string; status: string } | null;
  commissions: CommissionSaisie[];
  scrutins: ScrutinDuDossier[];
  amendements: AmendementDuDossier[];
  scrutinsCount: number;
  amendementsCount: number;
  votedAmendementsCount: number;
  /** Groupes des auteurs d'amendements, au moment du dépôt. */
  amendementsGroupes: Array<{ slug: string; nom: string; couleur: string | null; count: number }>;
  stats: { totalAdopte: number; totalRejete: number };
  /** Nombre de scrutins par objet du vote, sur tout le dossier. */
  naturesCount?: Record<string, number>;
  /** Rapports et missions d'application citant la loi de ce dossier. */
  travauxApplication: Array<{
    uid: string;
    titre: string;
    procedureLibelle: string | null;
    chambre: Chambre;
    urlAN: string | null;
    urlSenat: string | null;
  }>;
  /** Loi que ce dossier applique, quand il s'agit d'un rapport ou d'une mission. */
  loiAppliquee: {
    uid: string;
    titre: string;
    loiNumero: string | null;
    sujetSlug: string | null;
  } | null;
};

/** Étape du parcours d'un dossier (`/dossiers/:uid/chronologie`, réponse `{ data }`). */
export type EtapeParcoursDossier = {
  /** Identifiant de la séance ou de la réunion (`/reunions/:uid`). */
  uid: string;
  textes?: Array<{ uid: string; titre: string }>;
  type: "seance" | "commission";
  date: string;
  chambre: Chambre | null;
  commission: { slug: string; nom: string } | null;
  nbPrises: number | null;
  nbAvis: number | null;
  /** Vrai quand la page de la séance ou de la réunion existe sur le site. */
  consultable?: boolean;
  scrutins: Array<{
    id: string;
    numero: number;
    titre: string;
    date: string;
    sort: string;
    chambre: Chambre;
    session: string;
    nombrePour: number;
    nombreContre: number;
    nombreAbstention: number;
  }>;
};
