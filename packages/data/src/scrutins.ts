import type { Chambre } from "./common.ts";

/** Sort d'un scrutin tel que l'écrit l'API (« adopté », « rejeté »…). */
export type SortScrutin = string;

/** Scrutin dans une liste (`/scrutins`). Relevé sur l'API le 2026-10-26. */
export type ScrutinListItem = {
  id: string;
  numero: number;
  chambre: Chambre;
  session: string | null;
  legislature: number | null;
  date: string;
  titre: string;
  typeVote: string | null;
  natureVote: string | null;
  sort: SortScrutin;
  nombreVotants: number;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  tags: string[];
  importance: number | null;
  objetLibelle: string | null;
  demandeurTexte: string | null;
  dossierId: string | null;
  /** Résumé généré par IA : à signaler comme tel. */
  resumeIA: string | null;
  sourceUrl: string | null;
  votesCount: number;
};

/** Adopté ou rejeté, d'après le sort écrit par la source. */
export const estAdopte = (sort: SortScrutin) => /adopt/i.test(sort);
