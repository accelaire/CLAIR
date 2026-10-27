import type { MembreParlementaire, ScrutinDeReunion } from "./commissions.ts";
import type { Chambre, PaginationMeta } from "./common.ts";

/**
 * Agenda parlementaire et réunions (`/agenda`, `/agenda/:uid`, `/agenda/:uid/debat`).
 * Formes relevées sur l'API et ses services le 2026-10-26.
 */

/** Organe réuni, tel que l'agenda le joint à une réunion. */
export type AgendaCommission = {
  id: string;
  slug: string;
  nom: string;
  nomCourt: string | null;
  chambre: string;
  type: string;
  organeRef?: string | null;
};

/** Réunion de commission ou séance publique d'un jour de l'agenda. */
export type AgendaReunion = {
  id: string;
  uid: string;
  /** `commission` ou `seance`. */
  type: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  etat: string | null;
  odjResume: string | null;
  captationVideo: boolean | null;
  compteRenduRef: string | null;
  urlVideo: string | null;
  commission: AgendaCommission | null;
  nbParticipants: number;
  scrutins?: ScrutinDeReunion[];
};

export type AgendaEvenementType = "election" | "session" | "suspension" | "budget" | "institution";

/** Repère institutionnel : ponctuel (`dateFin` nul) ou période. */
export type AgendaEvenement = {
  id: string;
  slug: string;
  type: AgendaEvenementType;
  titre: string;
  description: string | null;
  dateDebut: string;
  dateFin: string | null;
  /** `false` : date non fixée par décret, seul le mois est sûr. */
  datePrecise: boolean;
  chambre: Chambre | null;
  sources: { label: string; url?: string }[] | null;
  important: boolean;
};

/** Réponse de `/agenda` : les réunions rangées par jour (`YYYY-MM-DD`) et les repères. */
export type AgendaResponse = {
  dateFrom: string;
  dateTo: string;
  total: number;
  pagination: PaginationMeta;
  byDay: Record<string, AgendaReunion[]>;
  evenements: AgendaEvenement[];
};

/** Vote d'une séance, tel que le détail de la réunion le sert. */
export type ScrutinDeSeance = {
  id: string;
  numero: number;
  titre: string;
  date: string;
  sort: string;
  chambre: string;
  session: string | null;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
};

/** Point du sommaire d'une séance : annoncé par la présidence ou reconstitué texte par texte. */
export type EntreeDuSommaire = {
  cle: string;
  source: "annonce" | "dossier" | "autres";
  titre: string;
  ordre: number | null;
  dossiers: { id: string; uid: string; titre: string; procedureLibelle: string | null }[];
  nbPrises: number | null;
  scrutins: ScrutinDeSeance[];
};

/** Avis rendu par une commission sur un amendement (article 88). */
export type AvisCommission = {
  id: string;
  numero: string;
  /** Libellé du compte rendu (« Favorable », « Accepté »…). */
  position: string;
  /** `favorable`, `defavorable` ou `autre`. */
  sens: string;
  place: string | null;
  auteur: string | null;
  groupe: string | null;
  ordre: number;
  amendement: { id: string; numero: string; sort: string | null; dossierId: string | null } | null;
};

/** Détail d'une réunion ou d'une séance. Les champs optionnels manquent des réponses en cache. */
export type ReunionDetail = {
  id: string;
  uid: string;
  type: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  etat: string | null;
  odjResume: string | null;
  odjComplet: string | null;
  captationVideo: boolean | null;
  urlVideo: string | null;
  compteRenduRef: string | null;
  compteRenduUrl?: string | null;
  commission: Omit<AgendaCommission, "organeRef"> | null;
  participants: { presence: string | null; parlementaire: MembreParlementaire }[];
  nbInterventions?: number;
  scrutins?: ScrutinDeSeance[];
  sommaire?: EntreeDuSommaire[];
  votesDuJour?: boolean;
  /** Uid de la page de la journée, quand cette séance n'en est qu'une des tenues. */
  seanceCanonique?: string | null;
  avisCommission: AvisCommission[];
};

/** Prise de parole d'un débat de réunion (contenu tronqué à 500 caractères si `hasMore`). */
export type PriseDeParoleReunion = {
  id: string;
  type: string;
  contenu: string;
  hasMore: boolean;
  date: string;
  ordre: number | null;
  sourceUrl: string | null;
  orateurNom: string | null;
  orateurPrenom: string | null;
  orateurQualite: string | null;
  orateurGroupe: string | null;
  estPresidence: boolean;
  articleVise: string | null;
  amendementsVises: string[] | null;
  texteNumero: string | null;
  dossier: { uid: string; titre: string } | null;
  scrutinIds: string[];
  parlementaire:
    | (Omit<MembreParlementaire, "groupe"> & {
        groupe: { nom: string; couleur: string | null } | null;
      })
    | null;
};

export type DebatDeReunionPage = {
  data: PriseDeParoleReunion[];
  meta: PaginationMeta & { hasNext: boolean };
};

/** Texte intégral d'une prise de parole (`/scrutins/interventions/:id`). */
export type InterventionComplete = {
  data: { id: string; contenu: string; sourceUrl: string | null };
};
