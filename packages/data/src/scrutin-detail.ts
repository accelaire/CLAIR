import type { Chambre } from "./common.ts";
import type { ScrutinListItem } from "./scrutins.ts";

/**
 * Scrutin détaillé (`/scrutins/:numero?chambre=…&session=…`), ses prises de parole
 * (`/scrutins/:numero/interventions`), et filtres de la liste des scrutins (`/scrutins/tags`,
 * `/scrutins/periodes`, `/scrutins/annees`). Relevé sur l'API le 2026-10-26 ; seuls les champs
 * utiles au site sont typés.
 */

/** Position d'un parlementaire sur un scrutin, telle que l'écrit l'API. */
export type PositionVote = "pour" | "contre" | "abstention" | "absent";

/** Vote d'un parlementaire, avec son groupe à la date du scrutin. */
export type VoteParlementaire = {
  id: string;
  position: PositionVote;
  parlementaire: {
    id: string;
    slug: string;
    chambre: Chambre;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    /** Groupe au moment du vote ; `nom` est le sigle (« RN », « SOC »). */
    groupe: { id?: string; slug: string; nom: string; couleur: string | null } | null;
  };
};

/** Décompte des positions d'un groupe, indexé par sigle dans `votesByGroupe`. */
export type DecompteGroupe = { pour: number; contre: number; abstention: number; absent: number };

/** Prise de parole d'un débat (contenu tronqué à 500 caractères, `hasMore` sinon). */
export type InterventionScrutin = {
  id: string;
  type: string;
  contenu: string;
  hasMore?: boolean;
  date: string;
  ordre: number | null;
  sourceUrl: string | null;
  orateurNom: string | null;
  orateurPrenom: string | null;
  orateurQualite: string | null;
  articleVise: string | null;
  amendementsVises: string[] | null;
  texteNumero: string | null;
  parlementaire: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    groupe: { nom: string; couleur: string | null } | null;
  } | null;
};

/** Amendement mis aux voix par le scrutin. */
export type AmendementScrutin = {
  id: string;
  uid: string;
  numero: string;
  articleVise: string | null;
  alinea?: string | null;
  dispositif: string | null;
  exposeSommaire: string | null;
  auteurLibelle: string | null;
  sort: string | null;
  dateDepot: string | null;
  dossier?: { uid: string } | null;
  amendementParent?: {
    id: string;
    uid: string;
    numero: string;
    auteurLibelle: string | null;
  } | null;
  /** Prise de parole où l'amendement a été défendu en séance, si elle est connue. */
  defense?: InterventionScrutin | null;
};

/** Dossier législatif auquel le scrutin se rattache. */
export type DossierDuScrutin = {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  procedureLibelle: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  etat: string | null;
  dateDepot: string | null;
  loiNumero: string | null;
  loiTitre: string | null;
  urlLegifrance: string | null;
  _count?: { scrutins: number; amendements: number };
};

/** Séance du vote, quand elle a une page sur le site (`/reunions/:uid`). */
export type SeanceDuVote = { uid: string; rang: number | null };

/** Scrutin détaillé (`/scrutins/:numero`, réponse `{ data }`). */
export type ScrutinDetail = Omit<ScrutinListItem, "votesCount" | "dossierId"> & {
  dossierId?: string | null;
  texteNumero: string | null;
  texteTitre: string | null;
  seanceRef: string | null;
  /** Date de génération du résumé IA. */
  iaGeneratedAt: string | null;
  dossier: DossierDuScrutin | null;
  amendements: AmendementScrutin[];
  votesByPosition: Record<PositionVote, VoteParlementaire[]>;
  votesByGroupe: Record<string, DecompteGroupe>;
  totalVotes: number;
  totalInterventions: number;
  /** `true` : le débat est celui du vote ; `false` : celui de la journée. */
  debatRattache?: boolean;
  seanceADesDebats?: boolean;
  seance?: SeanceDuVote | null;
};

/** Finesse du rattachement d'un débat à son scrutin. */
export type PrecisionDebat =
  | "amendement"
  | "article"
  | "ensemble"
  | "motion"
  | "fenetre"
  | "finances";

/** Page de prises de parole d'un scrutin. */
export type InterventionsScrutinResponse = {
  data: InterventionScrutin[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext?: boolean;
    /** `scrutin` : débat du vote ; `journee` : faute de rattachement, toute la journée. */
    rattachement?: "scrutin" | "journee";
    precision?: PrecisionDebat | null;
    /** Nombre de prises de parole par nature, filtre de nature exclu. */
    parType?: Record<string, number>;
  };
};

/** Thématique de scrutin (`/scrutins/tags`). */
export type ScrutinTag = { name: string; count: number };

/** Période institutionnelle (`/scrutins/periodes`) : législature (AN) ou session (Sénat). */
export type PeriodeScrutins = {
  chambre: Chambre;
  legislature: number | null;
  session: string;
  /** Jour `YYYY-MM-DD`. */
  dateDebut: string;
  dateFin: string;
  count: number;
};

/** Année d'archives (`/scrutins/annees`). */
export type AnneeScrutins = { year: number; count: number };
