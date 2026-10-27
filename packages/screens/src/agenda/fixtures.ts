import type { AgendaEvenement, AgendaResponse, AgendaReunion } from "@clair/data";

/** Données FICTIVES pour les tests : réunions, organes et événements inventés. */
export const reunionAgendaExemple: AgendaReunion = {
  id: "agenda-reunion-1",
  uid: "RUANREXEMPLE2",
  type: "commission",
  dateDebut: "2026-03-03T08:30:00.000Z",
  dateFin: null,
  lieu: "Salle d'exemple",
  etat: "confirme",
  odjResume: "Audition d'une personne fictive|Examen d'un texte d'exemple",
  captationVideo: true,
  compteRenduRef: "CRCANREXEMPLE2",
  urlVideo: "https://video.exemple.test/agenda-1",
  commission: {
    id: "commission-exemple-1",
    slug: "assemblee-commission-des-jardins-partages",
    nom: "Commission des jardins partagés",
    nomCourt: "CION-JARD",
    chambre: "assemblee",
    type: "permanente",
    organeRef: "POEXEMPLE1",
  },
  nbParticipants: 4,
  scrutins: [],
};

export const seanceAgendaExemple: AgendaReunion = {
  ...reunionAgendaExemple,
  id: "agenda-seance-1",
  uid: "RUSNREXEMPLE3",
  type: "seance",
  dateDebut: "2026-03-03T13:00:00.000Z",
  commission: null,
  compteRenduRef: "CRSSNREXEMPLE20260303",
  odjResume: null,
  urlVideo: null,
  nbParticipants: 0,
  scrutins: [
    {
      id: "scrutin-exemple-1",
      numero: 42,
      titre: "l'ensemble d'un texte d'exemple",
      sort: "adopte",
      chambre: "senat",
      session: "2025",
      nombrePour: 200,
      nombreContre: 100,
      nombreAbstention: 10,
      dossier: null,
    },
  ],
};

export const evenementExemple: AgendaEvenement = {
  id: "evenement-exemple-1",
  slug: "evenement-exemple",
  type: "session",
  titre: "Ouverture d'une session d'exemple",
  description: "Repère fictif pour les tests.",
  dateDebut: "2026-03-10T00:00:00.000Z",
  dateFin: null,
  datePrecise: true,
  chambre: null,
  sources: [{ label: "Source d'exemple", url: "https://source.exemple.test" }],
  important: true,
};

export const periodeExemple: AgendaEvenement = {
  ...evenementExemple,
  id: "evenement-exemple-2",
  slug: "suspension-exemple",
  type: "suspension",
  titre: "Suspension d'exemple",
  dateDebut: "2026-03-20T00:00:00.000Z",
  dateFin: "2026-03-31T00:00:00.000Z",
};

export const agendaExemple = (
  byDay: Record<string, AgendaReunion[]> = {
    "2026-03-03": [seanceAgendaExemple, reunionAgendaExemple],
  },
  evenements: AgendaEvenement[] = [evenementExemple, periodeExemple],
): AgendaResponse => {
  const total = Object.values(byDay).flat().length;
  return {
    dateFrom: "2026-03-01T00:00:00.000Z",
    dateTo: "2026-03-31T23:59:59.999Z",
    total,
    pagination: { page: 1, limit: 1000, total, totalPages: total > 0 ? 1 : 0 },
    byDay,
    evenements,
  };
};
