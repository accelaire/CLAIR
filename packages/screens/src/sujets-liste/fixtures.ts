import type { PageMeta, SujetListItem } from "@clair/data";

/**
 * Sujets FICTIFS pour les tests et les stories : intitulés inventés, présentés comme exemples.
 */
export const sujetEnCours: SujetListItem = {
  id: "sujet-exemple-1",
  slug: "exemple-reforme-des-jardins-partages",
  label: "Exemple : réforme des jardins partagés",
  description: "Texte fictif servant d'exemple.",
  category: "Exemple",
  dossierCount: 2,
  scrutinCount: 12,
  matchMethod: "cross_ref",
  status: "en_cours",
  dateDebut: "2026-01-15T00:00:00.000Z",
  dateFin: null,
  dateDernierVote: "2026-05-20T00:00:00.000Z",
  featured: false,
  featuredOrder: 0,
  createdAt: "2026-01-16T00:00:00.000Z",
};

export const sujetPromulgue: SujetListItem = {
  ...sujetEnCours,
  id: "sujet-exemple-2",
  slug: "exemple-horaires-des-bibliotheques",
  label: "Exemple : horaires des bibliothèques",
  status: "promulgue",
  scrutinCount: 3,
  dateFin: "2026-09-01T00:00:00.000Z",
  dateDernierVote: "2026-07-10T00:00:00.000Z",
};

export const sujetRejete: SujetListItem = {
  ...sujetEnCours,
  id: "sujet-exemple-3",
  slug: "exemple-signalisation-des-pistes-cyclables",
  label: "Exemple : signalisation des pistes cyclables",
  status: "rejete",
  scrutinCount: 1,
  dateDernierVote: "2026-03-02T00:00:00.000Z",
};

export const sujetsExemple: SujetListItem[] = [sujetEnCours, sujetPromulgue, sujetRejete];

export const pageSujets = (sujets: SujetListItem[]): PageMeta<SujetListItem> => ({
  data: sujets,
  meta: {
    total: sujets.length,
    page: 1,
    limit: 100,
    totalPages: sujets.length > 0 ? 1 : 0,
    hasNext: false,
    hasPrev: false,
  },
});
