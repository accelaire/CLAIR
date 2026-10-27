import type { Chambre, PageMeta } from "./common.ts";
import type {
  GroupePolitique,
  ParlementaireFiche,
  ParlementaireListItem,
} from "./parlementaires.ts";

/**
 * Activité d'un parlementaire (votes, amendements, interventions), mandats, déclarations HATVP
 * et comparaison, tels que les renvoie l'API (apps/api, module parlementaires, monté sous
 * `/deputes` et `/senateurs`). Relevé sur l'API le 2026-10-26 ; seuls les champs utiles au site
 * sont typés.
 */

/** Réponse enveloppée dans `data` (`/deputes/:slug`, `/deputes/compare`, `/deputes/groupes`…). */
export type ApiData<T> = { data: T };

/** Législature disponible à l'Assemblée (`/deputes/legislatures`), la plus récente d'abord. */
export type LegislatureDisponible = { legislature: number; count: number };

/** Session disponible au Sénat (`/senateurs/sessions`, « 2026-2027 »), la plus récente d'abord. */
export type SessionDisponible = { session: string; count: number };

/** Groupe proposé dans le filtre d'une liste (`/deputes/groupes`, `/senateurs/groupes`). */
export type GroupeOption = Pick<
  GroupePolitique,
  "id" | "slug" | "chambre" | "nom" | "nomComplet" | "couleur" | "membresCount"
>;

/** Statistiques d'une fiche (`?include=stats`) et du comparateur. Donnée calculée par CLAIR. */
export type StatsParlementaireDetail = {
  /** Taux de présence, en %, tous scrutins. */
  presence: number;
  /** Taux de présence aux scrutins solennels, en % ; nul au Sénat. */
  presenceSolennel: number | null;
  /** Part des votes conformes à la position majoritaire du groupe, en %. */
  loyaute: number;
  /** Nombre de votes. */
  participation: number;
  interventions: number;
  amendements: { proposes: number; adoptes: number };
  questions: number;
};

/** Mandat parlementaire : une législature (Assemblée) ou une mandature (Sénat). */
export type MandatParlementaire = {
  id: string;
  chambre: Chambre;
  legislature: number | null;
  mandature: number | null;
  serie: string | null;
  dateDebut: string;
  dateFin: string | null;
  commissionPermanente: string | null;
  /** Groupe de la période du mandat (pas le groupe actuel). */
  groupe: { slug: string; nom: string; couleur: string | null; legislature: number | null } | null;
  circonscription: { nom: string; departement: string; numero: number } | null;
};

/** Fonction exercée dans un organe (commission, délégation, groupe d'études…). */
export type FonctionParlementaire = {
  id: string;
  /** Code de l'organe dans la source (« COMPER », « GE », « COMMISSION »…). */
  typeOrgane: string;
  /** Libellé de l'organe quand il n'est pas une commission connue. */
  institution: string | null;
  qualite: string | null;
  dateDebut: string;
  dateFin: string | null;
  commission: { slug: string; nom: string; chambre: Chambre } | null;
};

/** Déclaration publiée par la Haute Autorité pour la transparence de la vie publique. */
export type DeclarationHatvp = {
  id: string;
  /** `di`, `dia`, `diam`, `dsp`, `dspm`, `dspfm`. */
  typeDocument: string;
  datePublication: string | null;
  dateDepot: string | null;
  /** Page de la déclaration sur hatvp.fr. */
  urlDossier: string | null;
  statut: string | null;
};

/** Fiche complète (`/deputes/:slug?include=stats`). `sourceData` (brut de la source) est ignoré. */
export type ParlementaireDetail = ParlementaireFiche & {
  mandatsParlementaires: MandatParlementaire[];
  mandats: FonctionParlementaire[];
  declarations: DeclarationHatvp[];
  /** Présentes avec `include=stats`. */
  stats?: StatsParlementaireDetail;
};

/** Scrutin tel qu'il accompagne un vote d'un parlementaire. */
export type ScrutinDuVote = {
  id: string;
  numero: number;
  chambre: Chambre;
  /** Session (Sénat) ou numéro de législature (Assemblée) : identifie le scrutin avec le numéro. */
  session: string | null;
  date: string;
  titre: string;
  sort: string;
  typeVote: string | null;
  tags: string[];
  importance: number | null;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
};

/** Vote d'un parlementaire (`/deputes/:slug/votes`). */
export type VoteDuParlementaire = {
  id: string;
  /** `pour`, `contre`, `abstention`, `absent`. */
  position: string;
  /** Position majoritaire du groupe sur ce scrutin. */
  groupePosition: string | null;
  scrutin: ScrutinDuVote;
};

/** Amendement déposé ou cosigné (`/deputes/:slug/amendements`). */
export type AmendementParlementaire = {
  id: string;
  uid: string;
  numero: string;
  legislature: number | null;
  chambre: Chambre;
  texteRef: string | null;
  articleVise: string | null;
  alinea: string | null;
  dispositif: string | null;
  exposeSommaire: string | null;
  auteurLibelle: string | null;
  sort: string | null;
  dateDepot: string | null;
  dateSort: string | null;
  amendementParent: {
    id: string;
    uid: string;
    numero: string;
    auteurLibelle: string | null;
  } | null;
  scrutins: Array<{
    id: string;
    numero: number;
    chambre: Chambre;
    session: string | null;
    titre: string;
    date: string;
    sort: string;
  }>;
  dossier: { uid: string; titre: string; titreCourt: string | null } | null;
};

/** Prise de parole en séance (aperçu : `contenu` tronqué si `hasMore`). */
export type InterventionSeance = {
  id: string;
  date: string;
  type: string;
  contenu: string;
  hasMore: boolean;
  motsCles: string[];
  sourceUrl: string | null;
  ordre: number | null;
  articleVise: string | null;
  dossier: { uid: string; titre: string } | null;
  scrutinIds: string[];
};

/** Interventions d'un parlementaire regroupées par séance (`/deputes/:slug/interventions`). */
export type SeanceInterventions = {
  seanceId: string;
  date: string;
  interventions: InterventionSeance[];
  scrutins: Array<{
    id: string;
    numero: number;
    titre: string;
    date: string;
    sort: string;
    chambre: Chambre;
    session: string | null;
  }>;
  ordreDuJour: Array<{ ordre: number; titre: string }>;
};

/** Parlementaire comparé (`/deputes/compare?slugs=a,b`). */
export type ParlementaireCompare = Omit<
  ParlementaireListItem,
  "stats" | "votesCount" | "interventionsCount" | "amendementsCount"
> & {
  /** Nulles tant que les statistiques n'ont pas été calculées. Donnée calculée par CLAIR. */
  stats: StatsParlementaireDetail | null;
};

export type PageVotes = PageMeta<VoteDuParlementaire>;
export type PageAmendements = PageMeta<AmendementParlementaire>;
export type PageSeances = PageMeta<SeanceInterventions>;
