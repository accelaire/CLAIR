import type { Chambre } from "./common.ts";

/**
 * Sujets (grands textes suivis de bout en bout), tels que les renvoie l'API (apps/api, module
 * sujets). Relevé le 2026-10-26 d'après `sujets.service.ts` et `chronologie.ts` (base locale sans
 * sujet) ; seuls les champs utiles au site sont typés.
 */

/** État global d'un sujet : `en_cours`, `adopte`, `rejete`, `promulgue`, `caduc`, `retire`. */
export type StatutSujet = string;

/** Sujet dans une liste (`/sujets`). */
export type SujetListItem = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  category: string | null;
  dossierCount: number;
  scrutinCount: number;
  /** `cross_ref` : sujet qui rassemble un dossier de chaque chambre. */
  matchMethod: string | null;
  status: StatutSujet;
  dateDebut: string | null;
  dateFin: string | null;
  dateDernierVote: string | null;
  featured: boolean;
  featuredOrder: number;
  createdAt: string;
};

/** Lien sortant d'un sujet (documents officiels, ressources de contexte). */
export type SujetLien = {
  id: string;
  famille: string;
  titre: string;
  url: string;
  source: string;
  sourceLabel: string | null;
  datePublication: string | null;
  ordre: number;
};

/** Sujet détaillé (`/sujets/:slug`, réponse `{ data }`). */
export type SujetDetail = SujetListItem & {
  /** Résumé généré par IA : à signaler comme tel. */
  resume: string | null;
  /** Enjeux générés par IA : à signaler comme tels. */
  enjeux: string | null;
  liens?: { construction: SujetLien[]; contexte: SujetLien[] };
};

/** Étape officielle du parcours d'un dossier (actes législatifs). */
export type SujetEtapeLegislative = {
  code: string;
  label: string;
  chambre: "assemblee" | "senat" | "both" | null;
  status: "done" | "active" | "pending";
  outcome?:
    | "adopted"
    | "adopted_modified"
    | "adopted_conforme"
    | "rejected"
    | "adopted_49_3"
    | "adopted_definitive"
    | "cmp_accord"
    | "cmp_desaccord"
    | "cc_conforme"
    | "cc_partiel"
    | "cc_reserve"
    | null;
  date?: string | null;
  detail?: string | null;
};

/** Dossier législatif d'un sujet (`/sujets/:slug/dossiers`). */
export type SujetDossier = {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  chambre: Chambre;
  procedureCode: string | null;
  procedureLibelle: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  etat: string | null;
  dateDepot: string | null;
  dateAdoption: string | null;
  loiNumero: string | null;
  loiTitre: string | null;
  loiDateJO: string | null;
  urlLegifrance: string | null;
  urlJournalOfficiel: string | null;
  scrutinCount: number;
  legislativeSteps: SujetEtapeLegislative[];
};

/** Scrutin d'un sujet (`/sujets/:slug/scrutins`). */
export type SujetScrutin = {
  id: string;
  numero: number;
  chambre: Chambre;
  session: string | null;
  date: string;
  titre: string;
  typeVote: string | null;
  natureVote: string | null;
  sort: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  tags: string[];
  importance: number | null;
};

/** Document sans vote lié à la loi du sujet (`/sujets/:slug/documents-lies`). */
export type SujetDocumentLie = {
  uid: string;
  titre: string;
  procedureLibelle: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  chambre: Chambre;
  dateDepot: string | null;
  loiRef: string;
};

/** Article de presse (`/sujets/:slug/presse`, Google Actualités, liens seulement). */
export type SujetArticlePresse = {
  titre: string;
  media: string | null;
  url: string;
  date: string | null;
};

/** Décompte des votes et des amendements d'un groupe sur un sujet (`/sujets/:slug/stats`). */
export type SujetStatsGroupe = {
  nom: string;
  slug: string;
  couleur: string | null;
  chambre: Chambre;
  votes: { pour: number; contre: number; abstention: number; absent: number };
  amendements: number;
};

export type SujetStatsResponse = {
  data: SujetStatsGroupe[];
  /** Positions des groupes rédigées par IA, indexées par `slug-chambre`. */
  groupeAmendementDescriptions: Record<string, string>;
};

/** Vote annoncé sous une étape du parcours. */
export type SujetVoteEtape = {
  id: string;
  numero: number;
  titre: string;
  date: string;
  sort: string;
  chambre: Chambre;
  session: string | null;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
};

/** Séance ou réunion de commission où un texte a été examiné (`/sujets/:slug/chronologie`). */
export type SujetEtapeParcours = {
  uid: string;
  /** Textes examinés à cette étape (vide sur la page d'un dossier). */
  textes?: { uid: string; titre: string }[];
  type: "seance" | "commission";
  date: string;
  chambre: Chambre | null;
  commission: { slug: string; nom: string } | null;
  nbPrises: number | null;
  nbAvis: number | null;
  /** Vrai quand `/reunions/:uid` a une page ; absent : ne pas lier. */
  consultable?: boolean;
  scrutins: SujetVoteEtape[];
};
