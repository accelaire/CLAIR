/**
 * Sénatoriales du 27 septembre 2026, telles que les renvoie l'API (apps/api, module
 * senatoriales : `/senatoriales/2026`, `/sortants`, `/candidats`, `/resultats`). Repris des types
 * de apps/web (`app/senatoriales-2026/PageClient.tsx` et `lib/senatoriales/resultats.ts`).
 *
 * Les résultats sont PROVISOIRES : ils viennent du site de résultats du ministère de l'Intérieur,
 * publiés « sous réserve d'éventuelles corrections et des décisions du juge de l'élection ».
 */

/** Groupe du Sénat dans la répartition des sièges sortants. */
export type GroupeRepartition = {
  slug: string;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  position: string | null;
  /** Sièges du groupe remis en jeu. */
  sieges: number;
  /**
   * Sièges du groupe dans le Sénat entier, série 1 comprise. Optionnel : l'aperçu est mis en
   * cache une heure par l'API, une réponse antérieure à ce champ peut encore être servie.
   */
  siegesSenat?: number;
};

/** Aperçu du renouvellement (`/senatoriales/2026`). */
export type ApercuSenatoriales = {
  scrutin: {
    date: string;
    priseDeFonction: string;
    serie: string;
    mandatureSortante: number;
    mandatureEntrante: number;
    nbSieges: number;
    nbCirconscriptions: number;
    sources: { label: string; url?: string }[];
  };
  sortants: {
    total: number;
    mandatComplet: number;
    arriveesEnCours: number;
    parGroupe: GroupeRepartition[];
  };
  circonscriptions: {
    /** Code INSEE (« 33 », « 2A », « 997 »). */
    departement: string;
    nom: string;
    nbSieges: number;
    /** `null` tant que les candidatures ne sont pas publiées ; absent d'une réponse ancienne. */
    nbListes?: number | null;
    nbCandidats?: number | null;
  }[];
  /**
   * Chiffres des candidatures, `null` (ou absent) avant leur publication. Tranche entre les deux
   * sens de `Sortant.candidature === null` : tant qu'il est nul, rien n'est affirmé sur personne.
   */
  candidatures?: {
    listes: number;
    candidats: number;
    circonscriptions: number;
    sortantsCandidats: number;
    sortantsNonCandidats: number;
    anciensParlementaires: number;
  } | null;
};

/** Candidature d'un sortant au renouvellement. */
export type CandidatureSortant = {
  circonscription: { departement: string; nom: string };
  modeScrutin: string;
  libelle: string | null;
  nuance: string | null;
  nuanceLibelle: string | null;
  famille: string | null;
  /** Rang sur la liste : au proportionnel, être 1er ou dernier n'est pas pareil. */
  ordre: number;
  role: "titulaire" | "suppleant";
};

/** Sénateur sortant de la série 2 et son bilan de mandature (`/senatoriales/2026/sortants`). */
export type Sortant = {
  mandatId: string;
  personne: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    profession: string | null;
    dateNaissance: string | null;
    /** « M » ou « F », déduit de la civilité par la source. */
    sexe: string | null;
  };
  groupe: {
    slug: string;
    nom: string;
    nomComplet: string | null;
    couleur: string | null;
    position: string | null;
  } | null;
  /** `departement` est le code INSEE (« 01 », « 997 »), `nom` le libellé (« Ain »). */
  circonscription: { departement: string; nom: string } | null;
  commissionPermanente: string | null;
  mandat: {
    dateDebut: string;
    dateFin: string | null;
    mandatComplet: boolean;
    dureeMois: number;
    segments: number;
    interrompu: boolean;
  };
  /**
   * `null` ne veut pas dire « ne se représente pas » à lui seul : il veut aussi dire « les
   * candidatures ne sont pas encore publiées » (voir `ApercuSenatoriales.candidatures`).
   */
  candidature?: CandidatureSortant | null;
  /** Statistiques de carrière, identiques à celles de la fiche du sénateur (calculées). */
  bilan: {
    presence: number | null;
    loyaute: number | null;
    participation: number | null;
    interventions: number | null;
    amendements: number | null;
    calculatedAt: string | null;
  };
};

/** Réponse de `/senatoriales/2026/sortants` (sans pagination). */
export type ListeSortants = { data: Sortant[]; meta: { total: number } };

/** Tris acceptés par `/senatoriales/2026/sortants`, dans l'ordre du sélecteur de la page. */
export type TriSortants =
  | "departement"
  | "groupe"
  | "commission"
  | "profession"
  | "nom"
  | "age"
  | "presence"
  | "loyaute"
  | "amendements"
  | "interventions";

/** Candidat (l'API n'expose que l'année de naissance, délibérément). */
export type Candidat = {
  id: string;
  nom: string;
  prenom: string;
  sexe: string | null;
  anneeNaissance: number | null;
  profession: string | null;
  ordre: number;
  role: "titulaire" | "suppleant";
  /** Sénateur sortant dont le siège est remis en jeu. */
  sortant: boolean;
  /** Fiche de la personne si elle est déjà passée par le Parlement. */
  personne: { slug: string; chambre: string; photoUrl: string | null } | null;
};

/** Unité de vote : une liste au proportionnel, un binôme titulaire-remplaçant au majoritaire. */
export type ListeCandidature = {
  id: string;
  circonscription: { departement: string; nom: string };
  modeScrutin: string;
  libelle: string | null;
  /** Code de nuance de la préfecture. N'est pas un groupe politique. */
  nuance: string | null;
  /** Libellé publié par le ministère ; c'est lui qu'on affiche. */
  nuanceLibelle: string | null;
  famille: string | null;
  candidats: Candidat[];
};

/** Réponse de `/senatoriales/2026/candidats`. */
export type ListeCandidats = {
  data: ListeCandidature[];
  meta: { total: number; candidats: number };
};

export type StatutCirconscription =
  | "pas_ouvert"
  | "vote_en_cours"
  | "resultats_attendus"
  | "second_tour"
  | "partielle"
  | "pourvue";

export type EtapeSecondTour = "a_venir" | "en_cours" | "clos";

export type HorairesScrutin = {
  ouverture: string;
  cloture: string;
  ouvertureT2: string | null;
  clotureT2: string | null;
};

/** État d'une circonscription le jour du scrutin. */
export type ResumeCirconscription = {
  departement: string;
  nom: string;
  nbSieges: number;
  modeScrutin: string;
  statut: StatutCirconscription;
  secondTour: EtapeSecondTour | null;
  /** Un élément par siège : la famille de l'élu, ou `null` tant que le siège n'est pas attribué. */
  sieges: ({ famille: string | null; nuance: string | null } | null)[];
  horaires: HorairesScrutin;
};

/** Réponse de `/senatoriales/2026/resultats`. */
export type ResultatsNationaux = {
  maintenant: string;
  verifieA: string | null;
  publieA: string | null;
  source: string;
  compteurs: Record<StatutCirconscription, number> & {
    circonscriptions: number;
    sieges: number;
    siegesAttribues: number;
  };
  circonscriptions: ResumeCirconscription[];
  hemicycle: {
    avant: Record<string, number>;
    apres: Record<string, number>;
    total: number;
    notes: string[];
  };
  /** Absent d'une réponse servie par une API d'avant son ajout. */
  elus?: {
    total: number;
    reelus: number;
    parlementaires: number;
    nouveaux: number;
    femmes: number;
  };
};

export type PersonneElu = {
  slug: string;
  chambre: string;
  actif: boolean;
  photoUrl: string | null;
};

/** Mandats locaux du Répertoire national des élus. */
export type MandatsLocaux = {
  /** Date de mise à jour du répertoire lu (AAAA-MM-JJ). */
  source: string;
  mandats: { type: string; libelle: string; depuis: string | null }[];
};

export type Elu = {
  nom: string;
  prenom: string;
  sexe: string | null;
  anneeNaissance: number | null;
  profession: string | null;
  tour: number;
  liste: string | null;
  nuance: string | null;
  nuanceLibelle: string | null;
  famille: string | null;
  parcours: "reelu" | "parlementaire" | "nouveau";
  personne: PersonneElu | null;
  /** Dernier mandat parlementaire commencé avant le scrutin. */
  avant: { chambre: string; enCours: boolean } | null;
  /** Slug de la fiche provisoire d'un élu qui n'a pas encore de fiche ; `null` sinon. */
  slug: string | null;
  mandatsLocaux: MandatsLocaux | null;
};

export type CandidatResultat = {
  nom: string;
  prenom: string;
  sexe: string | null;
  anneeNaissance: number | null;
  profession: string | null;
  ordre: number;
  role: string;
  sortant: boolean;
  elu: boolean;
  personne: PersonneElu | null;
};

export type LigneResultat = {
  sourceUid: string;
  libelle: string;
  nuance: string | null;
  nuanceLibelle: string | null;
  famille: string | null;
  voix: number;
  pctInscrits: number | null;
  pctExprimes: number | null;
  sieges: number | null;
  elu: boolean | null;
  candidats: CandidatResultat[];
};

export type Participation = {
  inscrits: number;
  abstentions: number;
  votants: number;
  blancs: number;
  nuls: number;
  exprimes: number;
};

export type TourResultat = {
  tour: number;
  publieA: string;
  verifieA: string;
  sourceUrl: string;
  participation: Participation;
  lignes: LigneResultat[];
};

export type SortDuSortant = "reelu" | "battu" | "ne_se_representait_pas" | "en_attente";

/** Réponse de `/senatoriales/2026/resultats/:departement`. */
export type ResultatsCirconscription = {
  maintenant: string;
  source: string;
  circonscription: ResumeCirconscription & { grandsElecteurs: number | null };
  tours: TourResultat[];
  elus: Elu[];
  repartition: {
    listes: {
      sourceUid: string;
      libelle: string;
      famille: string | null;
      voix: number;
      moyennes: number[];
      sieges: number;
    }[];
    attributions: { sourceUid: string; diviseur: number; rang: number }[];
  } | null;
  sortants: (Sortant & { sort: SortDuSortant })[];
};
