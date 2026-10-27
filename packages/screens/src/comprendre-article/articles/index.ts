import type { ComprendreArticle } from "../types.ts";
import { commissions } from "./commissions.ts";
import { dossierLegislatif } from "./dossier-legislatif.ts";
import { groupesPolitiques } from "./groupes-politiques.ts";
import { lobbying } from "./lobbying.ts";
import { parlement } from "./parlement.ts";
import { parlementaire } from "./parlementaire.ts";
import { scrutin } from "./scrutin.ts";

/** Fiches « Comprendre » par adresse, dans l'ordre de la rubrique. */
export const COMPRENDRE_ARTICLES = {
  parlement,
  parlementaire,
  scrutin,
  "dossier-legislatif": dossierLegislatif,
  "groupes-politiques": groupesPolitiques,
  lobbying,
  commissions,
} as const satisfies Record<string, ComprendreArticle>;

export type ComprendreSlug = keyof typeof COMPRENDRE_ARTICLES;

/** Fiches dans l'ordre de la rubrique (accueil, liens précédent / suivant). */
export const COMPRENDRE_ORDER: readonly ComprendreArticle[] = Object.values(COMPRENDRE_ARTICLES);
