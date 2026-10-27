import type { Chambre, PagePagination } from "./common.ts";

/**
 * Commissions parlementaires (`/commissions`, `/commissions/:slug`, `/commissions/:slug/reunions`,
 * `/commissions/:slug/dossiers`). Formes relevées sur l'API le 2026-10-26.
 */

/** Types d'organes acceptés par le filtre `type` de `/commissions`. */
export const COMMISSION_TYPES = [
  "permanente",
  "enquete",
  "speciale",
  "mixte_paritaire",
  "delegation",
  "mission_info",
  "office",
  "hemicycle",
  "autre",
  "groupe_etudes",
  "groupe_amitie",
  "assemblee_internationale",
] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

/** Commission dans la liste. */
export type CommissionListItem = {
  id: string;
  uid: string;
  slug: string;
  chambre: Chambre;
  /** Un des `COMMISSION_TYPES` ; gardé en chaîne pour ne pas casser sur un type nouveau. */
  type: string;
  nom: string;
  /** Souvent un code (« CION-SOC »), pas un nom court lisible. */
  nomCourt: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  actif: boolean;
  nbMembres: number;
  nbReunions: number;
};

export type CommissionsPage = PagePagination<CommissionListItem>;

/** Parlementaire membre d'une commission ou participant à une réunion. */
export type MembreParlementaire = {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  photoUrl: string | null;
  chambre: string;
  /** `nom` porte le sigle du groupe (« LFI-NFP »). */
  groupe: { nom: string; couleur: string | null; slug: string } | null;
};

export type CommissionMembre = {
  /** « Président », « Vice-présidente », « Secrétaire », « Membre »… */
  qualite: string | null;
  parlementaire: MembreParlementaire;
};

export type CommissionAncienMembre = CommissionMembre & {
  dateDebut: string;
  dateFin: string | null;
};

/** Réunion d'une commission (prochaines réunions et historique). */
export type CommissionReunion = {
  id: string;
  uid: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  /** Points de l'ordre du jour séparés par « | », plafonné à 500 caractères. */
  odjResume: string | null;
  /** Points de l'ordre du jour séparés par des retours à la ligne. */
  odjComplet: string | null;
  etat: string | null;
  captationVideo: boolean | null;
  urlVideo: string | null;
  compteRenduRef: string | null;
  /** Historique seulement. */
  nbParticipants?: number;
  /** Historique d'une commission de type `hemicycle` : les scrutins de la séance. */
  scrutins?: ScrutinDeReunion[];
};

/** Scrutin rattaché à une séance (historique de l'hémicycle, agenda). */
export type ScrutinDeReunion = {
  id: string;
  numero: number;
  titre: string;
  sort: string;
  chambre: string;
  session?: string | null;
  date?: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  dossier: {
    id: string;
    uid: string;
    titre: string;
    titreCourt: string | null;
    procedureLibelle?: string | null;
  } | null;
};

export type CommissionDetail = Omit<CommissionListItem, "nbReunions"> & {
  nbReunions: number;
  nbDossiers: number;
  membres: CommissionMembre[];
  anciensMembres?: CommissionAncienMembre[];
  /** Les cinq prochaines réunions non annulées. */
  prochainesReunions: CommissionReunion[];
};

export type CommissionReunionsPage = PagePagination<CommissionReunion>;

/** Rôle de la commission sur un texte : saisie au fond ou pour avis. */
export type RoleSaisine = "fond" | "avis";

/** Dossier législatif dont une commission a été saisie. */
export type CommissionDossier = {
  uid: string;
  titre: string;
  titreCourt: string | null;
  etat: string | null;
  dateDepot: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  procedureLibelle: string | null;
  loiNumero: string | null;
  nbScrutins: number;
  nbAmendements: number;
  role: RoleSaisine;
};

export type CommissionDossiersPage = PagePagination<CommissionDossier>;
