import type {
  ApiData,
  CommissionDetail,
  CommissionDossier,
  CommissionDossiersPage,
  CommissionReunion,
  CommissionReunionsPage,
} from "@clair/data";
import { commissionExemple } from "../commissions-liste/fixtures.ts";

/** Données FICTIVES pour les tests : personnes, textes et réunions inventés. */
export const reunionExemple: CommissionReunion = {
  id: "reunion-exemple-1",
  uid: "RUANREXEMPLE1",
  dateDebut: "2026-03-03T08:30:00.000Z",
  dateFin: "2026-03-03T10:00:00.000Z",
  lieu: "Salle d'exemple",
  odjResume: null,
  odjComplet:
    "- Audition d'une personne fictive\n- Examen d'un texte d'exemple ;\n- Nomination d'un rapporteur\n- Questions diverses",
  etat: "confirme",
  captationVideo: true,
  urlVideo: "https://video.exemple.test/reunion-1",
  compteRenduRef: "CRCANREXEMPLE",
  nbParticipants: 7,
};

export const commissionDetailExemple: CommissionDetail = {
  ...commissionExemple,
  nbDossiers: 1,
  membres: [
    {
      qualite: "Membre",
      parlementaire: {
        id: "parl-exemple-2",
        slug: "dominique-exemple",
        nom: "Exemple",
        prenom: "Dominique",
        photoUrl: null,
        chambre: "assemblee",
        groupe: { nom: "GRP", couleur: null, slug: "grp" },
      },
    },
    {
      qualite: "Présidente",
      parlementaire: {
        id: "parl-exemple-1",
        slug: "camille-fictive",
        nom: "Fictive",
        prenom: "Camille",
        photoUrl: null,
        chambre: "assemblee",
        groupe: null,
      },
    },
  ],
  anciensMembres: [
    {
      qualite: "Membre",
      dateDebut: "2024-07-18T00:00:00.000Z",
      dateFin: "2025-01-10T00:00:00.000Z",
      parlementaire: {
        id: "parl-exemple-3",
        slug: "alex-ancien",
        nom: "Ancien",
        prenom: "Alex",
        photoUrl: null,
        chambre: "assemblee",
        groupe: null,
      },
    },
  ],
  prochainesReunions: [],
};

export const commissionHemicycle: CommissionDetail = {
  ...commissionDetailExemple,
  slug: "assemblee-hemicycle-exemple",
  type: "hemicycle",
  nom: "Assemblée d'exemple",
  membres: [],
  anciensMembres: [],
};

export const detail = (commission: CommissionDetail): ApiData<CommissionDetail> => ({
  data: commission,
});

export const dossierCommissionExemple: CommissionDossier = {
  uid: "DLEXEMPLE9",
  titre: "Proposition de loi d'exemple relative aux potagers",
  titreCourt: null,
  etat: "en_cours",
  dateDepot: "2026-01-15T00:00:00.000Z",
  urlAN: null,
  urlSenat: null,
  procedureLibelle: "Proposition de loi ordinaire",
  loiNumero: null,
  nbScrutins: 2,
  nbAmendements: 5,
  role: "fond",
};

export const pageReunions = (
  items: CommissionReunion[],
  totalPages = 1,
): CommissionReunionsPage => ({
  data: items,
  pagination: { page: 1, limit: 20, total: items.length * totalPages, totalPages },
});

export const pageDossiersCommission = (items: CommissionDossier[]): CommissionDossiersPage => ({
  data: items,
  pagination: { page: 1, limit: 20, total: items.length, totalPages: items.length > 0 ? 1 : 0 },
});
