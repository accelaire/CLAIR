import type { AgendaEvenement } from "./agenda.ts";

/**
 * Réponse de `/homepage` : chiffres clés, dossiers récemment discutés et agenda des jours à venir.
 * Forme relevée sur `apps/api/src/modules/homepage/homepage.controller.ts` le 2026-10-27.
 */

/** Décomptes de la base : mandats en cours, et toutes législatures confondues pour les `…Total`. */
export type HomepageStats = {
  deputes: number;
  senateurs: number;
  /** Absents d'une réponse servie depuis un cache antérieur à leur ajout. */
  deputesTotal?: number;
  senateursTotal?: number;
  scrutins: number;
  dossiers: number;
  lobbyistes: number;
  actionsLobby: number;
  interventions: number;
  amendements: number;
};

/** Dossier législatif récemment discuté. */
export type HomepageDossier = {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  chambre: "assemblee" | "senat";
  etat: string | null;
  procedureLibelle: string | null;
  scrutinsCount: number;
  amendementsCount: number;
  lastScrutinDate: string | null;
  voteStats: { adopte: number; rejete: number };
};

/** Séance publique ou réunion de commission confirmée, à venir. */
export type HomepageReunion = {
  id: string;
  uid: string;
  /** `seance` ou `commission`. */
  type: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  odjResume: string | null;
  etat: string;
  captationVideo: boolean | null;
  compteRenduRef: string | null;
  commission: {
    slug: string;
    nom: string;
    nomCourt: string | null;
    chambre: string;
    organeRef: string | null;
  } | null;
};

export type HomepageUpcoming = {
  /** Réunions des sept prochains jours qui en comptent. */
  events: HomepageReunion[];
  /** Repères institutionnels des jours affichés (absents d'un ancien cache). */
  evenements?: AgendaEvenement[];
  /** Trois prochaines échéances majeures, même au-delà des jours affichés. */
  echeances?: AgendaEvenement[];
};

export type HomepageResponse = {
  stats: HomepageStats;
  trendingDossiers: HomepageDossier[];
  /** Fin de la dernière synchronisation réussie. */
  lastUpdate: string | null;
  upcoming: HomepageUpcoming | null;
};
