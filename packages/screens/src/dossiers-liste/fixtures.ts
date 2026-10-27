import type { DossierListItem, DossiersFilters, PageMeta } from "@clair/data";

/**
 * Données FICTIVES pour les tests et les stories : les textes sont des exemples inventés,
 * jamais présentés comme réels.
 */
export const dossierExemple: DossierListItem = {
  id: "dossier-exemple-1",
  uid: "DLEXEMPLE1",
  titre: "Proposition de loi d'exemple relative aux jardins partagés",
  titreCourt: null,
  legislature: 17,
  chambre: "assemblee",
  procedureCode: "2",
  procedureLibelle: "Proposition de loi ordinaire",
  etat: "en_cours",
  dateDepot: "2026-01-15T00:00:00.000Z",
  loiNumero: null,
  lastScrutinDate: "2026-03-10T00:00:00.000Z",
  _count: { scrutins: 4, amendements: 12 },
};

export const dossierExempleSenat: DossierListItem = {
  ...dossierExemple,
  id: "dossier-exemple-2",
  uid: "DLEXEMPLE2",
  titre: "Projet de loi d'exemple sur les bibliothèques de quartier",
  chambre: "senat",
  legislature: 0,
  procedureLibelle: "Projet de loi ordinaire",
  etat: "promulgue",
  loiNumero: "2026-1",
  _count: { scrutins: 1, amendements: 0 },
};

export const pageDossiers = (
  items: DossierListItem[],
  { page = 1, totalPages = 1 }: { page?: number; totalPages?: number } = {},
): PageMeta<DossierListItem> => ({
  data: items,
  meta: { total: items.length * totalPages, page, limit: 20, totalPages },
});

export const filtresDossiers: DossiersFilters = {
  procedures: [
    { label: "Proposition de loi ordinaire", count: 3 },
    { label: "Projet de loi ordinaire", count: 1 },
  ],
};
