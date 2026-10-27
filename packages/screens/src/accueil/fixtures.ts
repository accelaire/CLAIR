import type { AgendaEvenement, HomepageResponse, HomepageReunion } from "@clair/data";

/**
 * Données FICTIVES de l'accueil pour les tests et les stories : intitulés inventés, présentés
 * comme exemples ; les chiffres ne sont pas ceux de la base.
 */

export const reunionSeance: HomepageReunion = {
  id: "reunion-exemple-1",
  uid: "RUANR5L17S2026IDS00001",
  type: "seance",
  dateDebut: "2026-03-03T14:00:00.000Z",
  dateFin: null,
  lieu: "Palais Bourbon",
  odjResume: "Exemple : questions au Gouvernement",
  etat: "confirme",
  captationVideo: true,
  compteRenduRef: "CRSANR5L17S2026O1N001",
  commission: null,
};

export const reunionCommission: HomepageReunion = {
  ...reunionSeance,
  id: "reunion-exemple-2",
  uid: "RUANR5L17S2026IDC00002",
  type: "commission",
  dateDebut: "2026-03-03T08:30:00.000Z",
  odjResume: "Exemple : audition sur les jardins partagés",
  compteRenduRef: null,
  commission: {
    slug: "commission-exemple",
    nom: "Commission des exemples",
    nomCourt: "Exemples",
    chambre: "senat",
    organeRef: "PO000001",
  },
};

/** Quatre réunions le même jour : la quatrième n'est pas affichée d'office. */
export const reunionsDuMardi: HomepageReunion[] = [
  reunionCommission,
  reunionSeance,
  { ...reunionCommission, id: "reunion-exemple-3", dateDebut: "2026-03-03T15:00:00.000Z" },
  { ...reunionCommission, id: "reunion-exemple-4", dateDebut: "2026-03-03T16:00:00.000Z" },
];

export const reunionMercredi: HomepageReunion = {
  ...reunionSeance,
  id: "reunion-exemple-5",
  dateDebut: "2026-03-04T13:00:00.000Z",
};

export const echeanceExemple: AgendaEvenement = {
  id: "evenement-exemple-1",
  slug: "exemple-echeance",
  type: "election",
  titre: "Exemple : élection fictive",
  description: null,
  dateDebut: "2026-04-12T00:00:00.000Z",
  dateFin: null,
  datePrecise: true,
  chambre: null,
  sources: null,
  important: true,
};

export const homepageExemple: HomepageResponse = {
  stats: {
    deputes: 577,
    senateurs: 348,
    deputesTotal: 1200,
    senateursTotal: 900,
    scrutins: 12000,
    dossiers: 800,
    lobbyistes: 3000,
    actionsLobby: 50000,
    interventions: 1_234_567,
    amendements: 90000,
  },
  trendingDossiers: [
    {
      id: "dossier-exemple-1",
      uid: "DLR5L17N00001",
      titre: "Exemple : réforme des jardins partagés",
      titreCourt: null,
      chambre: "assemblee",
      etat: "en_cours",
      procedureLibelle: "Proposition de loi",
      scrutinsCount: 4,
      amendementsCount: 30,
      lastScrutinDate: "2026-02-20T00:00:00.000Z",
      voteStats: { adopte: 3, rejete: 1 },
    },
  ],
  lastUpdate: "2026-03-02T05:12:00.000Z",
  upcoming: {
    events: [...reunionsDuMardi, reunionMercredi],
    evenements: [],
    echeances: [echeanceExemple],
  },
};
