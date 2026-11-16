import type { Chambre } from "./common.ts";

/**
 * Gouvernements, postes ministériels et présidences de la République (`/gouvernements`,
 * `/gouvernements/:slug`, `/gouvernements/membres/:slug`), et leur trace sur la fiche d'un
 * parlementaire (`fonctionsGouvernementales`). Écrits d'après le service de l'API
 * (apps/api, module gouvernements) et les types relevés par l'ancien front le 2026-11-14.
 *
 * Les dates sont des dates civiles de la source (`YYYY-MM-DD`), sans heure ni fuseau. La source
 * est l'open data de l'Assemblée nationale (fichier AMO30) ; le bilan (projets de loi, 49.3,
 * motions de censure) n'existe que depuis juin 2017.
 */

/** Une personne membre d'un gouvernement : son nom, et sa fiche CLAIR quand elle en a une. */
export type PersonneGouvernement = {
  acteurUid: string;
  /** « Mme » ou « M. », telle que publiée. */
  civilite: string | null;
  prenom: string;
  nom: string;
  parlementaire: { slug: string; chambre: Chambre | string; photoUrl: string | null } | null;
};

/** « depuis_2017 » : bilan disponible ; « avant_2017 » : pas de données (et non zéro). */
export type CouvertureBilan = "depuis_2017" | "avant_2017";

/** Un gouvernement dans la liste (`/gouvernements`), du plus récent au plus ancien. */
export type GouvernementResume = {
  uid: string;
  slug: string;
  /** « Valls II », « Borne » : sans le mot « Gouvernement ». */
  nom: string;
  numero: number;
  dateDebut: string;
  dateFin: string | null;
  enCours: boolean;
  premierMinistre: PersonneGouvernement | null;
  /** Présidence de la République au début du gouvernement. */
  presidence: { uid: string; civilite: string | null; prenom: string; nom: string } | null;
  nbPostes: number;
  nbMembres: number;
  /** Membres dont la civilité publiée est « Mme ». Absent d'une réponse ancienne en cache. */
  nbFemmes?: number;
  couverture?: CouvertureBilan;
  /** Recours au 49.3 et motions de censure ; null avant juin 2017. Calculé par CLAIR. */
  bilan?: { engagements: number; motions: number } | null;
};

/** Source citée par les réponses (`source`, `sourceBilan`). */
export type SourceGouvernements = { nom: string; url: string };

/** Réponse de `/gouvernements`. */
export type GouvernementsReponse = { data: GouvernementResume[]; source: SourceGouvernements };

export type NatureProjet =
  | "ordinaire"
  | "ratification_ordonnance"
  | "convention"
  | "finances"
  | "constitutionnelle"
  | "organique";

export type StadeProjet = "promulgue" | "adopte" | "examine" | "depose";

/** Un projet de loi déposé par un gouvernement. */
export type ProjetLoi = {
  dossier: { uid: string; titre: string };
  nature: NatureProjet;
  stade: StadeProjet;
  chambreDepot: Chambre;
  dateDepot: string;
  loi: { numero: string; urlLegifrance: string | null } | null;
};

/** Comptes des projets de loi d'un gouvernement ou d'un poste. */
export type ComptesProjets = {
  total: number;
  /** Hors ratifications d'ordonnances et conventions, comptées à part. */
  portes: number;
  parNature: Record<NatureProjet, number>;
  parStadePortes: Record<StadeProjet, number>;
};

/** Une motion de censure et son scrutin. */
export type MotionCensure = {
  date: string;
  /** 2 : motion spontanée (49.2) ; 3 : en réponse à un 49.3. */
  alinea: number;
  premierSignataire: string | null;
  pour: number;
  majoriteRequise: number | null;
  adoptee: boolean;
  scrutin: { numero: number; chambre: Chambre | string; session: string };
  engagementDossierUid: string | null;
};

/** Un recours à l'article 49, alinéa 3. */
export type Engagement = {
  date: string;
  dossier: { uid: string; titre: string };
  texte: { uid: string; titre: string } | null;
};

/** Chef de file d'un projet de loi (le premier ministre signataire après le Premier ministre). */
export type ChefDeFile = {
  posteUid: string;
  intitule: string;
  intituleCourt: string | null;
  domaine: string | null;
  membre: PersonneGouvernement;
};

/** Bilan d'un gouvernement (depuis juin 2017). Comptes calculés par CLAIR. */
export type BilanGouvernement = {
  textes: ComptesProjets & { liste: Array<ProjetLoi & { chefDeFile: ChefDeFile | null }> };
  engagements: Array<Engagement & { motions: MotionCensure[] }>;
  motions: {
    total: number;
    alinea2: number;
    alinea3: number;
    adoptees: number;
    liste: MotionCensure[];
  };
};

/** Un poste ministériel tenu par une personne, avec ses dates. */
export type PosteMinisteriel = {
  /** Identifiant du mandat dans la source (`PM…`). */
  uid: string;
  organeUid: string;
  qualite: string;
  rangProtocolaire: number;
  intitule: string;
  intituleCourt: string | null;
  intituleComplement: string | null;
  /** Clé du domaine (« economie », « sante »), null pour un intitulé nouveau. */
  domaine: string | null;
  dateDebut: string;
  dateFin: string | null;
  datePublication: string | null;
  membre: PersonneGouvernement;
};

/** Un domaine de portefeuille ; le classement est celui de CLAIR (la source n'en donne pas). */
export type DomaineMinisteriel = { cle: string; libelle: string };

/** Un gouvernement en détail (`/gouvernements/:slug`). */
export type GouvernementDetail = Omit<GouvernementResume, "bilan"> & {
  precedent: { slug: string; nom: string } | null;
  suivant: { slug: string; nom: string } | null;
  postes: PosteMinisteriel[];
  /** null avant juin 2017 (`couverture` « avant_2017 »). */
  bilan?: BilanGouvernement | null;
};

/** Réponse de `/gouvernements/:slug`. */
export type GouvernementDetailReponse = {
  data: GouvernementDetail;
  domaines?: DomaineMinisteriel[];
  source: SourceGouvernements;
  sourceBilan?: SourceGouvernements;
};

/** Un gouvernement désigné depuis une autre page (dossier, sujet, scrutin). */
export type RepereGouvernement = { slug: string; nom: string };

/**
 * Contexte gouvernemental d'un dossier ou d'un sujet (`gouvernement` de `/dossiers/:uid` et
 * `/sujets/:slug`) : le projet de loi et ses signataires, les recours au 49.3 sur ce texte et
 * leurs motions de censure.
 */
export type ContexteGouvernemental = {
  projets: Array<
    ProjetLoi & {
      gouvernement: RepereGouvernement | null;
      signataires: Array<{
        role: "premier_ministre" | "chef_de_file" | "cosignataire";
        qualite: string;
        intitule: string;
        intituleCourt: string | null;
        membre: PersonneGouvernement & { slug: string };
      }>;
    }
  >;
  engagements: Array<
    Engagement & {
      gouvernement: RepereGouvernement | null;
      premierMinistre: PersonneGouvernement & { slug: string };
      motions: MotionCensure[];
    }
  >;
};

/** Une motion de censure vue depuis son scrutin (`motionCensure` de `/scrutins/:numero`). */
export type MotionDuScrutin = MotionCensure & {
  gouvernement: RepereGouvernement | null;
  engagement: {
    date: string;
    dossierUid: string;
    texte: { uid: string; titre: string } | null;
  } | null;
};

/** Bilan d'un poste : comptes sur la fiche, listes dans `/gouvernements/membres/:slug`. */
export type BilanPoste = {
  textes: {
    chefDeFile: ComptesProjets;
    cosignataire: number;
    liste?: Array<ProjetLoi & { role: string }>;
  } | null;
  /** Réponses en séance (questions au Gouvernement), par chambre. */
  reponses: { assemblee: number; senat: number };
  premierMinistre: {
    engagements: number;
    motions: number;
    motionsAdoptees: number;
    listeEngagements?: Engagement[];
    listeMotions?: MotionCensure[];
  } | null;
};

/** Une fonction gouvernementale ou présidentielle sur la fiche d'un parlementaire. */
export type FonctionGouvernementale = {
  type: "poste_ministeriel" | "presidence";
  uid: string;
  qualite: string;
  intitule: string;
  intituleCourt: string | null;
  dateDebut: string;
  dateFin: string | null;
  gouvernement: { uid: string; slug: string; nom: string } | null;
  /** Slug du membre (`/gouvernements/membres/:slug`). */
  membreSlug?: string | null;
  /** Comptes du poste ; null avant juin 2017 ou pour une présidence. */
  bilan?: BilanPoste | null;
};

/** Réponse de `/gouvernements/membres/:slug` (seuls les champs utiles au site). */
export type MembreGouvernementReponse = {
  data: {
    slug: string;
    postes: Array<{ uid: string; bilan: BilanPoste | null }>;
  };
};
