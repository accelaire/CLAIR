import type {
  AmendementDuDossier,
  DossierDetail,
  EtapeParcoursDossier,
  PageMeta,
  ScrutinDuDossier,
} from "@clair/data";

/**
 * Données FICTIVES pour les tests et les stories (« Camille Exemple », textes inventés) :
 * jamais présentées comme réelles.
 */
export const scrutinExemple: ScrutinDuDossier = {
  id: "scrutin-exemple-1",
  numero: 42,
  chambre: "senat",
  session: "2025",
  date: "2026-03-10T00:00:00.000Z",
  titre: "Scrutin d'exemple sur l'ensemble de la proposition de loi relative aux jardins partagés",
  sort: "adopte",
  typeVote: "ordinaire",
  natureVote: "ensemble",
  nombrePour: 200,
  nombreContre: 100,
  nombreAbstention: 10,
  nombreVotants: 310,
};

export const amendementExemple: AmendementDuDossier = {
  id: "amendement-exemple-1",
  uid: "AMEXEMPLE1",
  numero: "7",
  auteurLibelle: "Camille Exemple",
  articleVise: "Article 2",
  dispositif: "Texte d'exemple du dispositif.",
  exposeSommaire: "Exposé sommaire d'exemple.",
  texteRef: null,
  sort: "Adopté",
  dateDepot: "2026-03-01T00:00:00.000Z",
  scrutins: [
    {
      id: "scrutin-exemple-1",
      numero: 42,
      chambre: "senat",
      session: "2025",
      sort: "adopte",
      date: "2026-03-10T00:00:00.000Z",
    },
  ],
};

export const dossierDetailExemple: DossierDetail = {
  id: "dossier-exemple-1",
  uid: "DLEXEMPLE1",
  titre: "relative aux jardins partagés (texte d'exemple)",
  titreCourt: "DLEXEMPLE1",
  legislature: 17,
  chambre: "assemblee",
  procedureCode: "2",
  procedureLibelle: "Proposition de loi ordinaire",
  urlAN: "https://www.assemblee-nationale.fr/exemple",
  urlSenat: null,
  etat: "en_cours",
  dateDepot: "2026-01-15T00:00:00.000Z",
  dateAdoption: null,
  loiNumero: null,
  loiTitre: null,
  loiDateJO: null,
  urlLegifrance: null,
  urlJournalOfficiel: null,
  resumeIA: "Résumé d'exemple : ce texte fictif organise les jardins partagés.",
  sujet: null,
  commissions: [
    {
      slug: "commission-exemple",
      nom: "Commission d'exemple",
      chambre: "assemblee",
      type: "permanente",
      role: "fond",
    },
  ],
  scrutins: [scrutinExemple],
  amendements: [amendementExemple],
  scrutinsCount: 1,
  amendementsCount: 1,
  votedAmendementsCount: 1,
  amendementsGroupes: [{ slug: "groupe-exemple", nom: "EXE", couleur: null, count: 1 }],
  stats: { totalAdopte: 1, totalRejete: 0 },
  naturesCount: { ensemble: 1 },
  travauxApplication: [],
  loiAppliquee: null,
};

export const etapeExemple: EtapeParcoursDossier = {
  uid: "SEANCEEXEMPLE1",
  type: "seance",
  date: "2026-03-10T14:00:00.000Z",
  chambre: "senat",
  commission: null,
  nbPrises: 12,
  nbAvis: null,
  consultable: true,
  scrutins: [
    {
      id: "scrutin-exemple-1",
      numero: 42,
      titre: scrutinExemple.titre,
      date: scrutinExemple.date,
      sort: "adopte",
      chambre: "senat",
      session: "2025",
      nombrePour: 200,
      nombreContre: 100,
      nombreAbstention: 10,
    },
  ],
};

export const page = <T>(items: T[], total = items.length): PageMeta<T> => ({
  data: items,
  meta: { total, page: 1, limit: 20, totalPages: Math.max(1, Math.ceil(total / 20)) },
});
