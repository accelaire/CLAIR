import type { PageMeta, ScrutinListItem } from "@clair/data";

/**
 * Scrutins FICTIFS pour les tests : numéros, titres et résultats inventés, présentés comme des
 * exemples. Aucune donnée parlementaire réelle.
 */
export const scrutinExemple = (patch: Partial<ScrutinListItem> = {}): ScrutinListItem => ({
  id: "scrutin-exemple-1",
  numero: 101,
  chambre: "assemblee",
  session: "17",
  legislature: 17,
  date: "2026-03-12T00:00:00.000Z",
  titre: "l'ensemble de la proposition de loi d'exemple sur les jardins partagés",
  typeVote: "ordinaire",
  natureVote: "ensemble",
  sort: "adopte",
  nombreVotants: 120,
  nombrePour: 80,
  nombreContre: 30,
  nombreAbstention: 10,
  tags: ["environnement"],
  importance: 2,
  objetLibelle: null,
  demandeurTexte: null,
  dossierId: null,
  resumeIA: null,
  sourceUrl: null,
  votesCount: 120,
  ...patch,
});

export const pageScrutins = (
  items: ScrutinListItem[],
  { page = 1, totalPages = 1, total = items.length } = {},
): PageMeta<ScrutinListItem> => ({
  data: items,
  meta: { total, page, limit: 20, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
});

export const scrutinsExemples = [
  scrutinExemple(),
  scrutinExemple({
    id: "scrutin-exemple-2",
    numero: 12,
    chambre: "senat",
    session: "2025",
    legislature: null,
    titre: "l'amendement d'exemple n° 3 sur l'éclairage public",
    natureVote: "amendement",
    sort: "rejete",
    nombrePour: 100,
    nombreContre: 200,
    nombreAbstention: 5,
  }),
];
