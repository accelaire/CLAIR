import type { Chambre } from "./common.ts";

/**
 * Fiche d'un groupe politique et ses données calculées (votes, alliances, thématiques), telles
 * que les renvoie l'API (apps/api, module groupes : `/groupes/:chambre/:slug` et ses
 * sous-routes). Relevé sur l'API le 2026-10-26 ; seuls les champs utiles au site sont typés.
 * La liste des groupes (`/parlementaires/groupes`) est typée par `GroupePolitique`.
 */

/** Membre d'un groupe, avec ses statistiques calculées par CLAIR (en %). */
export type GroupeMembre = {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  photoUrl: string | null;
  circonscription: { departement: string; numero: number; nom: string } | null;
  statsPresence: number | null;
  statsLoyaute: number | null;
};

/** Fiche d'un groupe (`/groupes/:chambre/:slug`, réponse enveloppée dans `data`). */
export type GroupeDetail = {
  id: string;
  slug: string;
  chambre: Chambre;
  /** Législature de l'Assemblée ; nulle au Sénat. */
  legislature: number | null;
  /** Sénat : session affichée (« 2020 ») ; nulle pour la session courante et à l'Assemblée. */
  session: string | null;
  /** Sénat : la session affichée est la session courante. */
  sessionCourante: boolean;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  logoUrl: string | null;
  position: string | null;
  ordre: number;
  actif: boolean;
  membresCount: number;
  membresActifsCount: number;
  /** Rang du groupe par effectif dans sa chambre. */
  rang: number | null;
  totalGroupes: number | null;
  totauxAmendements: number;
  membres: GroupeMembre[];
  /** Moyennes calculées par CLAIR, en %. */
  stats: {
    presenceMoyenne: number;
    presenceSolennelMoyenne: number | null;
    loyauteMoyenne: number;
    participationMoyenne: number;
  };
};

/** Décompte des voix d'un groupe. */
export type GroupeDecompte = { pour: number; contre: number; abstention: number; absent: number };

/** Scrutin récent vu par un groupe (`/groupes/:chambre/:slug/votes`). */
export type GroupeScrutinRecent = {
  id: string;
  numero: number;
  titre: string;
  date: string;
  sort: string;
  typeVote: string;
  session?: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  groupeVotes: GroupeDecompte;
  totalGroupeVotes: number;
  /** « pour », « contre », « abstention » ; nul en cas d'égalité ou sans vote. */
  positionMajoritaire: string | null;
  /** Part des membres votants alignés sur la position majoritaire, en %. */
  cohesion: number;
};

/** Votes d'un groupe (`/groupes/:chambre/:slug/votes`). Donnée calculée par CLAIR. */
export type GroupeVotes = {
  totalVotes: number;
  positions: GroupeDecompte;
  tauxParticipation: number;
  cohesionMoyenne: number;
  scrutinsRecents: GroupeScrutinRecent[];
};

/** Groupe comparé dans les alliances. */
export type GroupeAllie = {
  id: string;
  slug: string;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  position: string | null;
  logoUrl: string | null;
};

/** Taux d'accord avec un autre groupe, en % des scrutins où les deux ont voté. */
export type GroupeAlliance = {
  groupe: GroupeAllie;
  tauxAccord: number;
  votesCommuns: number;
  votesTotaux: number;
};

/**
 * Proximité de vote avec les autres groupes (`/groupes/:chambre/:slug/alliances`), calculée par
 * CLAIR : `allies` au-dessus de 60 % d'accord, `opposes` en dessous de 40 %.
 */
export type GroupeAlliances = {
  groupeId: string;
  groupeNom: string;
  groupeCouleur: string | null;
  allies: GroupeAlliance[];
  neutres: GroupeAlliance[];
  opposes: GroupeAlliance[];
  calculatedAt: string | null;
};

/** Cohésion d'un groupe sur une thématique de scrutins. */
export type GroupeThematique = {
  thematique: string;
  position: number;
  /** En %. */
  cohesion: number;
  votesTotaux: number;
  votesPour: number;
  votesContre: number;
  votesAbstention: number;
};

/** Cohésion par thématique (`/groupes/:chambre/:slug/thematiques`). Donnée calculée par CLAIR. */
export type GroupeThematiques = {
  groupeId: string;
  groupeNom: string;
  groupeCouleur: string | null;
  thematiques: GroupeThematique[];
  calculatedAt: string | null;
};
