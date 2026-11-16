import type { Chambre } from "./common.ts";

/**
 * Parlementaires et groupes, tels que les renvoie l'API (apps/api, modules parlementaires,
 * deputes, senateurs). Relevé sur l'API le 2026-10-26 ; seuls les champs utiles au site sont
 * typés.
 */

/** Groupe politique (résumé inclus dans un parlementaire). */
export type GroupeResume = {
  id: string;
  slug: string;
  chambre: Chambre;
  nom: string;
  nomComplet: string;
  /** Couleur fournie par l'API (hex), prioritaire sur la couleur de repli des tokens. */
  couleur: string | null;
  position: string | null;
};

/** Groupe politique avec ses statistiques (`/parlementaires/groupes`). */
export type GroupePolitique = GroupeResume & {
  nomCourt: string | null;
  logoUrl: string | null;
  ordre: number;
  actif: boolean;
  legislature: number | null;
  membresCount: number;
  statsMembresActifs: number | null;
  statsPresenceMoyenne: number | null;
  statsLoyauteMoyenne: number | null;
  statsCohesion: number | null;
  statsParticipation: number | null;
  statsCalculatedAt: string | null;
};

export type Circonscription = {
  id: string;
  departement: string;
  numero: number;
  nom: string;
  type: string;
};

/**
 * Statistiques calculées par CLAIR (pourcentages ou nombres), sur la période demandée (mandat en
 * cours, ou carrière avec `periode=carriere`). Donnée calculée, pas officielle. Relu sur l'API
 * (`parlementaires.service.ts`, `getParlementaires`) le 2026-11-14.
 */
export type StatsParlementaire = {
  /** Participation aux scrutins publics, en % ; au Sénat, ce n'est pas une présence. */
  presence: number | null;
  /** Présence aux scrutins solennels, en % ; seule mesure de la présence au Sénat. */
  presenceSolennel?: number | null;
  loyaute: number | null;
  participation: number | null;
  interventions: number | null;
  amendements: number | null;
  /** Scrutins sur lesquels porte la présence. */
  scrutins?: number | null;
  /**
   * Faux sous 50 scrutins : l'élu ne figure pas dans les classements (loyauté, présence des
   * députés). Le seuil ne vaut pas pour la présence des sénateurs, mesurée aux solennels.
   */
  classable?: boolean | null;
};

/** Parlementaire dans une liste (`/deputes`, `/senateurs`). */
export type ParlementaireListItem = {
  id: string;
  slug: string;
  chambre: Chambre;
  nom: string;
  prenom: string;
  /** « F » ou « M » ; nul si la source ne le dit pas. */
  sexe: string | null;
  photoUrl: string | null;
  actif: boolean;
  profession: string | null;
  groupe: GroupeResume | null;
  circonscription: Circonscription | null;
  /** Sénat : série de renouvellement (« 1 », « 2 ») ; nul à l'Assemblée. */
  serie: string | null;
  votesCount: number;
  interventionsCount: number;
  amendementsCount: number;
  /** Nul tant que les statistiques n'ont pas été calculées. */
  stats: StatsParlementaire | null;
};

/** Fiche d'un parlementaire (`/deputes/:slug`, `/senateurs/:slug`). */
export type ParlementaireFiche = Omit<
  ParlementaireListItem,
  "stats" | "groupe" | "votesCount" | "interventionsCount" | "amendementsCount"
> & {
  dateNaissance: string | null;
  lieuNaissance: string | null;
  email: string | null;
  twitter: string | null;
  facebook: string | null;
  siteWeb: string | null;
  groupe: Omit<GroupePolitique, "membresCount"> | null;
  commissionPermanente: string | null;
  statsPresence: number | null;
  statsPresenceSolennel: number | null;
  statsLoyaute: number | null;
  statsParticipation: number | null;
  statsInterventions: number | null;
  statsAmendements: number | null;
  statsAmendementsAdoptes: number | null;
  statsQuestions: number | null;
  statsCalculatedAt: string | null;
  /** Résumés générés par IA (Mistral) : toujours signalés comme tels dans l'interface. */
  resumeIA: string | null;
  parcoursIA: string | null;
  positionsClesIA: string | null;
  faitsNotablesIA: string | null;
  iaGeneratedAt: string | null;
};

/** « Camille Exemple » → « Camille Exemple » ; ordre d'affichage prénom puis nom. */
export const nomComplet = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom}`;
