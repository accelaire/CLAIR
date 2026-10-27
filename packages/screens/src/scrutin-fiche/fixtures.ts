import type { InterventionsScrutinResponse, ScrutinDetail, VoteParlementaire } from "@clair/data";

/**
 * Scrutin FICTIF pour les tests : élus (« Camille Exemple »…), groupes, amendement et débat
 * inventés, présentés comme des exemples. Aucune donnée parlementaire réelle.
 */
const vote = (
  id: string,
  position: VoteParlementaire["position"],
  prenom: string,
  nom: string,
  sigle: string,
): VoteParlementaire => ({
  id,
  position,
  parlementaire: {
    id: `p-${id}`,
    slug: `${prenom}-${nom}`.toLowerCase(),
    chambre: "assemblee",
    nom,
    prenom,
    photoUrl: null,
    groupe: { slug: sigle.toLowerCase(), nom: sigle, couleur: null },
  },
});

export const interventionExemple = {
  id: "intervention-1",
  type: "intervention",
  contenu: "Texte d'exemple : cette prise de parole est inventée pour les tests.",
  hasMore: false,
  date: "2026-03-12T00:00:00.000Z",
  ordre: 1,
  sourceUrl: null,
  orateurNom: "Exemple",
  orateurPrenom: "Camille",
  orateurQualite: null,
  articleVise: null,
  amendementsVises: ["7"],
  texteNumero: null,
  parlementaire: {
    id: "p-v1",
    slug: "camille-exemple",
    nom: "Exemple",
    prenom: "Camille",
    photoUrl: null,
    groupe: { nom: "GPA", couleur: null },
  },
};

export const scrutinDetailExemple = (patch: Partial<ScrutinDetail> = {}): ScrutinDetail => ({
  id: "scrutin-exemple-1",
  numero: 101,
  chambre: "assemblee",
  session: "17",
  legislature: 17,
  date: "2026-03-12T00:00:00.000Z",
  titre: "l'amendement d'exemple n° 7 sur les jardins partagés",
  typeVote: "ordinaire",
  natureVote: "amendement",
  sort: "adopte",
  nombreVotants: 3,
  nombrePour: 2,
  nombreContre: 1,
  nombreAbstention: 0,
  tags: ["environnement"],
  importance: 1,
  objetLibelle: null,
  demandeurTexte: "Président du groupe « Groupe parlementaire d'exemple »",
  resumeIA: "Résumé d'exemple : ce texte est inventé pour les tests.",
  sourceUrl: "https://example.org/scrutin-101",
  texteNumero: null,
  texteTitre: null,
  seanceRef: null,
  iaGeneratedAt: "2026-03-13T00:00:00.000Z",
  dossier: {
    id: "dossier-exemple",
    uid: "DOSSIER-EXEMPLE",
    titre: "Proposition de loi d'exemple sur les jardins partagés",
    titreCourt: "Jardins partagés",
    procedureLibelle: "Proposition de loi ordinaire",
    urlAN: null,
    urlSenat: null,
    etat: "en_cours",
    dateDepot: null,
    loiNumero: null,
    loiTitre: null,
    urlLegifrance: null,
    _count: { scrutins: 4, amendements: 12 },
  },
  amendements: [
    {
      id: "amendement-1",
      uid: "AMDT-EXEMPLE-7",
      numero: "7",
      articleVise: "Article 1er",
      dispositif: "Texte d'exemple du dispositif.",
      exposeSommaire: "Exposé d'exemple.",
      auteurLibelle: "Camille Exemple",
      sort: "Adopté",
      dateDepot: null,
      dossier: { uid: "DOSSIER-EXEMPLE" },
      defense: interventionExemple,
    },
  ],
  votesByPosition: {
    pour: [
      vote("v1", "pour", "Camille", "Exemple", "GPA"),
      vote("v2", "pour", "Dominique", "Modèle", "GPB"),
    ],
    contre: [vote("v3", "contre", "Alex", "Fictif", "GPB")],
    abstention: [],
    absent: [],
  },
  votesByGroupe: {
    GPA: { pour: 1, contre: 0, abstention: 0, absent: 0 },
    GPB: { pour: 1, contre: 1, abstention: 0, absent: 0 },
  },
  totalVotes: 3,
  totalInterventions: 1,
  debatRattache: true,
  seance: null,
  ...patch,
});

export const interventionsExemple: InterventionsScrutinResponse = {
  data: [interventionExemple],
  meta: {
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
    rattachement: "scrutin",
    precision: "amendement",
    parType: { intervention: 1 },
  },
};
