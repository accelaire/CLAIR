import type { CommissionListItem, CommissionsPage } from "@clair/data";

/**
 * Données FICTIVES pour les tests : noms et chiffres inventés, jamais présentés comme réels.
 */
export const commissionExemple: CommissionListItem = {
  id: "commission-exemple-1",
  uid: "POEXEMPLE1",
  slug: "assemblee-commission-des-jardins-partages",
  chambre: "assemblee",
  type: "permanente",
  nom: "Commission des jardins partagés",
  nomCourt: "CION-JARD",
  dateDebut: "2024-07-18T00:00:00.000Z",
  dateFin: null,
  actif: true,
  nbMembres: 12,
  nbReunions: 3,
};

export const commissionExempleSenat: CommissionListItem = {
  ...commissionExemple,
  id: "commission-exemple-2",
  uid: "POEXEMPLE2",
  slug: "senat-groupe-etudes-bibliotheques",
  chambre: "senat",
  type: "groupe_etudes",
  nom: "Groupe d'études sur les bibliothèques de quartier",
  nomCourt: null,
  nbMembres: 1,
  nbReunions: 0,
};

export const pageCommissions = (items: CommissionListItem[]): CommissionsPage => ({
  data: items,
  pagination: { page: 1, limit: 500, total: items.length, totalPages: items.length > 0 ? 1 : 0 },
});
